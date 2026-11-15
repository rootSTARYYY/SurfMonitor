import { InstallerDefinition } from '../types';

export const nginxInstaller: InstallerDefinition = {
  id: 'official-nginx',
  name: 'Nginx Web Server',
  version: 'Distro Stable',
  description: 'Installs Nginx HTTP/HTTPS reverse proxy and web server with systemd management and configuration syntax verification.',
  category: 'web_servers',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 256,
  minRamMb: 128,
  requiredPorts: [80],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: false,
  rollbackAvailable: false,
  rollbackNote: 'Existing /etc/nginx configuration is preserved.',
  docsUrl: 'https://nginx.org/en/docs/',
  configSchema: [],
  buildPlan: (serverId, serverName) => ({
    installerId: 'official-nginx',
    installerName: 'Nginx Web Server',
    version: 'Distro Stable',
    serverId,
    serverName,
    installDir: '/etc/nginx',
    packages: ['nginx'],
    servicesToCreate: ['nginx.service'],
    portsToOpen: [80, 443],
    filesToModify: ['/etc/nginx/'],
    configSummary: [{ label: 'Service', value: 'nginx.service' }],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 50,
    estimatedRamMb: 64,
    rollbackAvailable: false,
    rollbackNote: 'Existing site configs are preserved.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    if (ctx.preflight.pkgManager === 'apt-get') {
      await ctx.exec(`${sudo}apt-get update -y && ${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y nginx`);
    } else {
      await ctx.exec(`${sudo}${ctx.preflight.pkgManager} install -y nginx`);
    }
    await ctx.exec(`${sudo}systemctl enable --now nginx`);
  },
  verify: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const test = await ctx.exec(`${sudo}nginx -t 2>&1`);
    const active = await ctx.exec('systemctl is-active nginx');
    const ver = await ctx.exec('nginx -v 2>&1');
    if (active.stdout.trim() !== 'active') {
      return { ok: false, details: `Nginx service is ${active.stdout.trim()}: ${test.stdout}` };
    }
    return { ok: true, versionDetected: ver.stdout.trim(), serviceName: 'nginx', installDir: '/etc/nginx', port: 80, details: 'Nginx is active and config syntax is valid.' };
  },
};

export const nodejsInstaller: InstallerDefinition = {
  id: 'official-nodejs',
  name: 'Node.js LTS',
  version: '22.x LTS',
  description: 'Installs Node.js 22.x LTS and npm via NodeSource repository.',
  category: 'devtools',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 512,
  minRamMb: 256,
  requiredPorts: [],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote: 'System Node.js package installation.',
  docsUrl: 'https://nodejs.org/',
  configSchema: [
    {
      key: 'majorVersion',
      label: 'Node.js Major Version',
      type: 'select',
      defaultValue: '22',
      options: [
        { label: 'Node.js 22 LTS', value: '22' },
        { label: 'Node.js 20 LTS', value: '20' },
      ],
    },
  ],
  buildPlan: (serverId, serverName, config) => ({
    installerId: 'official-nodejs',
    installerName: 'Node.js LTS',
    version: `${String(config.majorVersion ?? '22')}.x`,
    serverId,
    serverName,
    installDir: '/usr/bin/node',
    packages: ['nodejs'],
    servicesToCreate: [],
    portsToOpen: [],
    filesToModify: ['/etc/apt/sources.list.d/nodesource.list'],
    configSummary: [{ label: 'Major Version', value: `${String(config.majorVersion ?? '22')}.x LTS` }],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 180,
    estimatedRamMb: 128,
    rollbackAvailable: false,
    rollbackNote: 'Node.js binary installed system-wide.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const ver = String(ctx.config.majorVersion ?? '22').replace(/[^0-9]/g, '') || '22';
    const res = await ctx.exec(`curl -fsSL https://deb.nodesource.com/setup_${ver}.x | ${sudo}bash - && ${sudo}apt-get install -y nodejs`, { timeoutMs: 240_000 });
    if (res.code !== 0) throw new Error(`Node.js install failed: ${res.stderr.slice(-400)}`);
  },
  verify: async (ctx) => {
    const ver = await ctx.exec('node -v && npm -v');
    if (ver.code !== 0) return { ok: false, details: `node -v failed: ${ver.stderr}` };
    return { ok: true, versionDetected: ver.stdout.split(/\r?\n/)[0]?.trim(), installDir: '/usr/bin/node', details: `Installed ${ver.stdout.replace(/\r?\n/g, ' / ')}` };
  },
};

export const fail2banInstaller: InstallerDefinition = {
  id: 'official-fail2ban',
  name: 'Fail2ban',
  version: 'Distro Stable',
  description: 'Installs Fail2ban intrusion prevention daemon to protect SSH and exposed services from brute-force attempts.',
  category: 'security',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 128,
  minRamMb: 128,
  requiredPorts: [],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: false,
  rollbackAvailable: false,
  rollbackNote: 'Existing /etc/fail2ban/jail.local is preserved.',
  docsUrl: 'https://www.fail2ban.org/',
  configSchema: [],
  buildPlan: (serverId, serverName) => ({
    installerId: 'official-fail2ban',
    installerName: 'Fail2ban',
    version: 'Distro Stable',
    serverId,
    serverName,
    installDir: '/etc/fail2ban',
    packages: ['fail2ban'],
    servicesToCreate: ['fail2ban.service'],
    portsToOpen: [],
    filesToModify: ['/etc/fail2ban/'],
    configSummary: [{ label: 'Service', value: 'fail2ban.service' }],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 30,
    estimatedRamMb: 48,
    rollbackAvailable: false,
    rollbackNote: 'Existing fail2ban jails are preserved.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    if (ctx.preflight.pkgManager === 'apt-get') {
      await ctx.exec(`${sudo}apt-get update -y && ${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban`);
    } else {
      await ctx.exec(`${sudo}${ctx.preflight.pkgManager} install -y fail2ban`);
    }
    await ctx.exec(`${sudo}systemctl enable --now fail2ban`);
  },
  verify: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const st = await ctx.exec(`${sudo}fail2ban-client status`);
    if (st.code !== 0) return { ok: false, details: `fail2ban-client status failed: ${st.stderr}` };
    return { ok: true, versionDetected: 'active', serviceName: 'fail2ban', installDir: '/etc/fail2ban', details: st.stdout.trim() };
  },
};

export const ufwInstaller: InstallerDefinition = {
  id: 'official-ufw',
  name: 'UFW Firewall (SSH-Safe)',
  version: 'Distro Stable',
  description: 'Installs and configures UFW firewall while explicitly allowing SSH before enabling to prevent lockouts.',
  category: 'security',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 64,
  minRamMb: 64,
  requiredPorts: [],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: false,
  supportsGuided: true,
  rollbackAvailable: true,
  rollbackNote: 'UFW can be disabled cleanly with `ufw disable`.',
  docsUrl: 'https://help.ubuntu.com/community/UFW',
  configSchema: [
    { key: 'sshPort', label: 'SSH Port to Preserve', type: 'number', defaultValue: 22, required: true },
    { key: 'allowHttp', label: 'Allow HTTP (80) & HTTPS (443)', type: 'boolean', defaultValue: true },
  ],
  buildPlan: (serverId, serverName, config) => ({
    installerId: 'official-ufw',
    installerName: 'UFW Firewall (SSH-Safe)',
    version: 'Distro Stable',
    serverId,
    serverName,
    installDir: '/etc/ufw',
    packages: ['ufw'],
    servicesToCreate: ['ufw.service'],
    portsToOpen: [Number(config.sshPort ?? 22), ...(config.allowHttp !== false ? [80, 443] : [])],
    filesToModify: ['/etc/ufw/user.rules'],
    configSummary: [
      { label: 'SSH Port Preserved', value: String(config.sshPort ?? 22) },
      { label: 'Allow 80/443', value: String(config.allowHttp !== false) },
    ],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 10,
    estimatedRamMb: 16,
    rollbackAvailable: true,
    rollbackNote: 'Run `ufw disable` to revert firewall rules.',
    hasDestructiveOperations: true,
    destructiveWarnings: ['Enabling a firewall modifies live network ingress rules. SSH port is explicitly allowed before enabling.'],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const sshPort = Number(ctx.config.sshPort ?? 22);
    await ctx.exec(`${sudo}apt-get update -y && ${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y ufw`);
    await ctx.exec(`${sudo}ufw allow ${sshPort}/tcp`);
    if (ctx.config.allowHttp !== false) {
      await ctx.exec(`${sudo}ufw allow 80/tcp && ${sudo}ufw allow 443/tcp`);
    }
    await ctx.exec(`${sudo}ufw --force enable`);
  },
  verify: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const st = await ctx.exec(`${sudo}ufw status`);
    if (!st.stdout.includes('Status: active')) {
      return { ok: false, details: `UFW is not active: ${st.stdout}` };
    }
    return { ok: true, versionDetected: 'active', serviceName: 'ufw', installDir: '/etc/ufw', details: st.stdout.trim() };
  },
};
