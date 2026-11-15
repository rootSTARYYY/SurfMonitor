import { InstallerDefinition } from '../types';

export const dockerInstaller: InstallerDefinition = {
  id: 'official-docker-engine',
  name: 'Docker Engine & Compose',
  version: '27.x (Latest Stable)',
  description:
    'Installs official Docker Engine, containerd, and Docker Compose v2 plugin using the distribution repository, preserving any existing /etc/docker/daemon.json.',
  category: 'containers',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'centos', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 2048,
  minRamMb: 512,
  requiredPorts: [],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote:
    'System package installation does not auto-rollback; existing /etc/docker/daemon.json is preserved untouched.',
  docsUrl: 'https://docs.docker.com/engine/install/',
  configSchema: [
    {
      key: 'installComposePlugin',
      label: 'Install Docker Compose v2 Plugin',
      type: 'boolean',
      defaultValue: true,
      description: 'Installs docker-compose-plugin alongside Docker Engine.',
    },
    {
      key: 'enableServiceOnBoot',
      label: 'Enable Docker Service on Boot',
      type: 'boolean',
      defaultValue: true,
    },
    {
      key: 'addSshUserToGroup',
      label: 'Add SSH User to docker Group',
      type: 'boolean',
      defaultValue: false,
      advancedOnly: true,
      description: 'Allows non-root SSH user to run docker CLI without sudo.',
    },
  ],
  buildPlan: (serverId, serverName, config) => ({
    installerId: 'official-docker-engine',
    installerName: 'Docker Engine & Compose',
    version: '27.x',
    serverId,
    serverName,
    installDir: '/var/lib/docker',
    packages: [
      'docker-ce',
      'docker-ce-cli',
      'containerd.io',
      ...(config.installComposePlugin !== false ? ['docker-compose-plugin'] : []),
    ],
    servicesToCreate: ['docker.service', 'containerd.service'],
    portsToOpen: [],
    filesToModify: ['/etc/apt/sources.list.d/docker.list (or dnf repo)'],
    configSummary: [
      { label: 'Compose v2 Plugin', value: String(config.installComposePlugin !== false) },
      { label: 'Enable on Boot', value: String(config.enableServiceOnBoot !== false) },
      { label: 'Add User to Group', value: String(Boolean(config.addSshUserToGroup)) },
    ],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 650,
    estimatedRamMb: 256,
    rollbackAvailable: false,
    rollbackNote: 'Existing Docker data and daemon.json are preserved if already installed.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const checkExisting = await ctx.exec('command -v docker >/dev/null 2>&1 && docker --version || true');
    if (checkExisting.stdout.trim()) {
      ctx.log(`Existing Docker detected: ${checkExisting.stdout.trim()}. Ensuring service is active...`);
      await ctx.exec(`${sudo}systemctl enable --now docker`);
      return;
    }

    if (ctx.preflight.pkgManager === 'apt-get') {
      ctx.log('Installing Docker Engine via official apt repository...');
      const script = [
        `${sudo}apt-get update -y`,
        `${sudo}apt-get install -y ca-certificates curl gnupg`,
        `${sudo}install -m 0755 -d /etc/apt/keyrings`,
        `curl -fsSL https://download.docker.com/linux/${ctx.preflight.osName}/gpg | ${sudo}gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg`,
        `${sudo}chmod a+r /etc/apt/keyrings/docker.gpg`,
        `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ctx.preflight.osName} $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | ${sudo}tee /etc/apt/sources.list.d/docker.list >/dev/null`,
        `${sudo}apt-get update -y`,
        `${sudo}apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin ${
          ctx.config.installComposePlugin !== false ? 'docker-compose-plugin' : ''
        }`,
      ].join(' && ');
      const res = await ctx.exec(script, { timeoutMs: 300_000, label: 'Install Docker Engine (apt)' });
      if (res.code !== 0) {
        throw new Error(`Docker apt installation failed (exit ${res.code}): ${res.stderr.slice(-400)}`);
      }
    } else if (ctx.preflight.pkgManager === 'dnf' || ctx.preflight.pkgManager === 'yum') {
      ctx.log(`Installing Docker Engine via ${ctx.preflight.pkgManager}...`);
      const pm = ctx.preflight.pkgManager;
      const script = [
        `${sudo}${pm} install -y dnf-plugins-core || true`,
        `${sudo}${pm} config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || true`,
        `${sudo}${pm} install -y docker-ce docker-ce-cli containerd.io ${
          ctx.config.installComposePlugin !== false ? 'docker-compose-plugin' : ''
        }`,
      ].join(' && ');
      const res = await ctx.exec(script, { timeoutMs: 300_000, label: `Install Docker Engine (${pm})` });
      if (res.code !== 0) {
        throw new Error(`Docker ${pm} installation failed (exit ${res.code}): ${res.stderr.slice(-400)}`);
      }
    } else {
      throw new Error(`Unsupported package manager: ${ctx.preflight.pkgManager}`);
    }

    if (ctx.config.enableServiceOnBoot !== false) {
      await ctx.exec(`${sudo}systemctl enable --now docker`);
    } else {
      await ctx.exec(`${sudo}systemctl start docker`);
    }

    if (ctx.config.addSshUserToGroup) {
      await ctx.exec(`${sudo}usermod -aG docker "$USER" || true`);
    }
  },
  verify: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const ver = await ctx.exec(`${sudo}docker version --format '{{.Server.Version}}'`);
    const active = await ctx.exec('systemctl is-active docker');
    if (ver.code !== 0 || active.stdout.trim() !== 'active') {
      return {
        ok: false,
        details: `Docker verification failed: service=${active.stdout.trim()}, err=${ver.stderr.trim()}`,
      };
    }
    return {
      ok: true,
      versionDetected: ver.stdout.trim(),
      serviceName: 'docker',
      installDir: '/var/lib/docker',
      details: `Docker Engine ${ver.stdout.trim()} is active and responding.`,
    };
  },
};
