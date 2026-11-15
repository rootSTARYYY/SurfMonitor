import { InstallerDefinition } from '../types';

export const uptimeKumaInstaller: InstallerDefinition = {
  id: 'official-uptime-kuma',
  name: 'Uptime Kuma',
  version: '1.23.x',
  description:
    'Deploys self-hosted Uptime Kuma as an isolated Docker container with persistent volume storage and HTTP health verification.',
  category: 'monitoring',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'centos', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 1024,
  minRamMb: 256,
  requiredPorts: [3001],
  dependencies: ['docker'],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: true,
  rollbackAvailable: true,
  rollbackNote: 'Container can be stopped and removed; persistent data directory is preserved unless explicitly deleted.',
  docsUrl: 'https://github.com/louislam/uptime-kuma',
  configSchema: [
    {
      key: 'containerName',
      label: 'Container Name',
      type: 'text',
      defaultValue: 'uptime-kuma',
      required: true,
    },
    {
      key: 'port',
      label: 'Host Port',
      type: 'number',
      defaultValue: 3001,
      required: true,
    },
    {
      key: 'dataDir',
      label: 'Persistent Data Directory',
      type: 'text',
      defaultValue: '/opt/surf-apps/uptime-kuma/data',
      required: true,
      advancedOnly: true,
    },
  ],
  buildPlan: (serverId, serverName, config) => {
    const port = Number(config.port ?? 3001);
    const dataDir = String(config.dataDir ?? '/opt/surf-apps/uptime-kuma/data');
    const containerName = String(config.containerName ?? 'uptime-kuma');
    return {
      installerId: 'official-uptime-kuma',
      installerName: 'Uptime Kuma',
      version: '1.23.x',
      serverId,
      serverName,
      installDir: dataDir,
      packages: ['louislam/uptime-kuma:1 (Docker Image)'],
      servicesToCreate: [`docker:${containerName}`],
      portsToOpen: [port],
      filesToModify: [dataDir],
      configSummary: [
        { label: 'Container', value: containerName },
        { label: 'Host Port', value: String(port) },
        { label: 'Data Directory', value: dataDir },
      ],
      requiredPrivileges: 'root_or_sudo',
      estimatedDiskMb: 450,
      estimatedRamMb: 192,
      rollbackAvailable: true,
      rollbackNote: 'Container removal leaves persistent data directory intact.',
      hasDestructiveOperations: false,
      destructiveWarnings: [],
    };
  },
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const port = Number(ctx.config.port ?? 3001);
    const containerName = String(ctx.config.containerName ?? 'uptime-kuma').replace(/[^a-zA-Z0-9_.-]/g, '');
    const dataDir = String(ctx.config.dataDir ?? '/opt/surf-apps/uptime-kuma/data').replace(/[^a-zA-Z0-9_./-]/g, '');

    const hasDocker = await ctx.exec('command -v docker >/dev/null 2>&1 && echo yes || echo no');
    if (hasDocker.stdout.trim() !== 'yes') {
      throw new Error('Docker Engine is required before installing Uptime Kuma. Install Docker Engine first.');
    }

    ctx.log(`Creating persistent directory ${dataDir}...`);
    await ctx.exec(`${sudo}mkdir -p "${dataDir}"`);

    const existing = await ctx.exec(`${sudo}docker ps -a --format '{{.Names}}' | grep -Fx "${containerName}" || true`);
    if (existing.stdout.trim() === containerName) {
      ctx.log(`Container ${containerName} already exists; starting it...`);
      await ctx.exec(`${sudo}docker start "${containerName}"`);
      return;
    }

    ctx.log(`Pulling and starting louislam/uptime-kuma:1 on port ${port}...`);
    const runCmd = `${sudo}docker run -d --restart=always -p ${port}:3001 -v "${dataDir}:/app/data" --name "${containerName}" louislam/uptime-kuma:1`;
    const res = await ctx.exec(runCmd, { timeoutMs: 240_000, label: 'Start Uptime Kuma Container' });
    if (res.code !== 0) {
      throw new Error(`Failed to start Uptime Kuma container: ${res.stderr.slice(-400)}`);
    }
  },
  verify: async (ctx) => {
    const port = Number(ctx.config.port ?? 3001);
    const containerName = String(ctx.config.containerName ?? 'uptime-kuma').replace(/[^a-zA-Z0-9_.-]/g, '');
    const dataDir = String(ctx.config.dataDir ?? '/opt/surf-apps/uptime-kuma/data');

    await ctx.exec('sleep 3');
    const httpCheck = await ctx.exec(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/`);
    const code = Number(httpCheck.stdout.trim() || '0');
    if (code < 200 || code >= 400) {
      return {
        ok: false,
        details: `Uptime Kuma container started, but HTTP check on 127.0.0.1:${port} returned ${code}.`,
      };
    }
    return {
      ok: true,
      versionDetected: '1.x',
      containerName,
      installDir: dataDir,
      port,
      url: `http://127.0.0.1:${port}`,
      details: `Uptime Kuma is running and responding with HTTP ${code} on port ${port}.`,
    };
  },
  uninstall: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const containerName = String(ctx.config.containerName ?? 'uptime-kuma').replace(/[^a-zA-Z0-9_.-]/g, '');
    await ctx.exec(`${sudo}docker stop "${containerName}" && ${sudo}docker rm "${containerName}"`);
  },
};
