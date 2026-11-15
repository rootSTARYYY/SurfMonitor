import { InstallerDefinition } from '../types';

export const postgresqlInstaller: InstallerDefinition = {
  id: 'official-postgresql',
  name: 'PostgreSQL',
  version: '16.x / Distro Stable',
  description:
    'Installs PostgreSQL server, preserves any existing clusters/databases, enables the systemd service, and verifies readiness via pg_isready.',
  category: 'databases',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 1024,
  minRamMb: 512,
  requiredPorts: [5432],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote: 'Database packages and existing data clusters are never auto-deleted on failure.',
  docsUrl: 'https://www.postgresql.org/docs/',
  configSchema: [
    { key: 'dbName', label: 'Initial Database (Optional)', type: 'text', defaultValue: 'app_db' },
    { key: 'dbUser', label: 'Database User (Optional)', type: 'text', defaultValue: 'app_user' },
    { key: 'dbPassword', label: 'Database Password', type: 'password', secret: true, required: false },
  ],
  buildPlan: (serverId, serverName, config) => ({
    installerId: 'official-postgresql',
    installerName: 'PostgreSQL',
    version: 'Distro Stable',
    serverId,
    serverName,
    installDir: '/var/lib/postgresql',
    packages: ['postgresql', 'postgresql-contrib'],
    servicesToCreate: ['postgresql.service'],
    portsToOpen: [5432],
    filesToModify: ['/etc/postgresql'],
    configSummary: [
      { label: 'Initial DB', value: String(config.dbName || 'none') },
      { label: 'DB User', value: String(config.dbUser || 'postgres') },
      { label: 'Password', value: config.dbPassword ? '********' : 'Not set', secret: true },
    ],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 350,
    estimatedRamMb: 256,
    rollbackAvailable: false,
    rollbackNote: 'Existing PostgreSQL clusters are preserved.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const existing = await ctx.exec('command -v psql >/dev/null 2>&1 && echo yes || echo no');
    if (existing.stdout.trim() === 'yes') {
      ctx.log('Existing PostgreSQL installation detected; preserving data and ensuring service is running...');
      await ctx.exec(`${sudo}systemctl enable --now postgresql`);
      return;
    }

    if (ctx.preflight.pkgManager === 'apt-get') {
      const res = await ctx.exec(
        `${sudo}apt-get update -y && ${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib`,
        { timeoutMs: 240_000, label: 'Install PostgreSQL' }
      );
      if (res.code !== 0) throw new Error(`PostgreSQL install failed: ${res.stderr.slice(-400)}`);
    } else if (ctx.preflight.pkgManager === 'dnf' || ctx.preflight.pkgManager === 'yum') {
      const pm = ctx.preflight.pkgManager;
      const res = await ctx.exec(`${sudo}${pm} install -y postgresql-server postgresql-contrib && ${sudo}postgresql-setup --initdb || true`, {
        timeoutMs: 240_000,
      });
      if (res.code !== 0) throw new Error(`PostgreSQL install failed: ${res.stderr.slice(-400)}`);
    } else {
      throw new Error(`Unsupported package manager: ${ctx.preflight.pkgManager}`);
    }

    await ctx.exec(`${sudo}systemctl enable --now postgresql`);

    const dbUser = String(ctx.config.dbUser ?? '').replace(/[^a-zA-Z0-9_]/g, '');
    const dbName = String(ctx.config.dbName ?? '').replace(/[^a-zA-Z0-9_]/g, '');
    const dbPassword = String(ctx.config.dbPassword ?? '');
    if (dbUser && dbPassword) {
      const escapedPass = dbPassword.replace(/'/g, "''");
      ctx.log(`Creating PostgreSQL role ${dbUser} (password redacted)...`);
      await ctx.exec(
        `${sudo}-u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${dbUser}'" | grep -q 1 || ${sudo}-u postgres psql -c "CREATE USER ${dbUser} WITH PASSWORD '${escapedPass}';"`
      );
    }
    if (dbName) {
      const ownerClause = dbUser ? ` OWNER ${dbUser}` : '';
      ctx.log(`Ensuring PostgreSQL database ${dbName} exists...`);
      await ctx.exec(
        `${sudo}-u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${dbName}'" | grep -q 1 || ${sudo}-u postgres psql -c "CREATE DATABASE ${dbName}${ownerClause};"`
      );
    }
  },
  verify: async (ctx) => {
    const check = await ctx.exec('pg_isready');
    const ver = await ctx.exec('psql --version');
    if (check.code !== 0) {
      return { ok: false, details: `pg_isready failed: ${check.stdout} ${check.stderr}` };
    }
    return {
      ok: true,
      versionDetected: ver.stdout.trim(),
      serviceName: 'postgresql',
      installDir: '/var/lib/postgresql',
      port: 5432,
      details: `PostgreSQL ready: ${check.stdout.trim()}`,
    };
  },
};

export const mariadbInstaller: InstallerDefinition = {
  id: 'official-mariadb',
  name: 'MariaDB Server',
  version: '10.x / 11.x Distro Stable',
  description:
    'Installs MariaDB Server, preserves existing databases, enables systemd service, and verifies availability via mariadb-admin / mysqladmin.',
  category: 'databases',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 1024,
  minRamMb: 512,
  requiredPorts: [3306],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote: 'Existing /var/lib/mysql data is never overwritten.',
  docsUrl: 'https://mariadb.com/kb/en/documentation/',
  configSchema: [
    { key: 'dbName', label: 'Initial Database (Optional)', type: 'text', defaultValue: '' },
    { key: 'dbUser', label: 'Database User (Optional)', type: 'text', defaultValue: '' },
    { key: 'dbPassword', label: 'Database Password', type: 'password', secret: true },
  ],
  buildPlan: (serverId, serverName) => ({
    installerId: 'official-mariadb',
    installerName: 'MariaDB Server',
    version: 'Distro Stable',
    serverId,
    serverName,
    installDir: '/var/lib/mysql',
    packages: ['mariadb-server'],
    servicesToCreate: ['mariadb.service'],
    portsToOpen: [3306],
    filesToModify: ['/etc/mysql'],
    configSummary: [{ label: 'Port', value: '3306 (localhost)' }],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 350,
    estimatedRamMb: 256,
    rollbackAvailable: false,
    rollbackNote: 'Existing MariaDB data is preserved.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const existing = await ctx.exec('command -v mariadbd >/dev/null 2>&1 || command -v mysqld >/dev/null 2>&1 && echo yes || echo no');
    if (existing.stdout.trim() === 'yes') {
      ctx.log('Existing MariaDB/MySQL detected; ensuring service is active...');
      await ctx.exec(`${sudo}systemctl enable --now mariadb || ${sudo}systemctl enable --now mysql`);
      return;
    }

    if (ctx.preflight.pkgManager === 'apt-get') {
      const res = await ctx.exec(
        `${sudo}apt-get update -y && ${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server`,
        { timeoutMs: 240_000 }
      );
      if (res.code !== 0) throw new Error(`MariaDB install failed: ${res.stderr.slice(-400)}`);
    } else if (ctx.preflight.pkgManager === 'dnf' || ctx.preflight.pkgManager === 'yum') {
      const res = await ctx.exec(`${sudo}${ctx.preflight.pkgManager} install -y mariadb-server`, { timeoutMs: 240_000 });
      if (res.code !== 0) throw new Error(`MariaDB install failed: ${res.stderr.slice(-400)}`);
    } else {
      throw new Error(`Unsupported package manager: ${ctx.preflight.pkgManager}`);
    }

    await ctx.exec(`${sudo}systemctl enable --now mariadb`);
  },
  verify: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const ping = await ctx.exec(`${sudo}mariadb-admin ping 2>/dev/null || ${sudo}mysqladmin ping`);
    const ver = await ctx.exec('mariadb --version 2>/dev/null || mysql --version');
    if (ping.code !== 0) {
      return { ok: false, details: `MariaDB ping failed: ${ping.stderr.trim()}` };
    }
    return {
      ok: true,
      versionDetected: ver.stdout.trim(),
      serviceName: 'mariadb',
      installDir: '/var/lib/mysql',
      port: 3306,
      details: `MariaDB active: ${ping.stdout.trim()}`,
    };
  },
};

export const redisInstaller: InstallerDefinition = {
  id: 'official-redis',
  name: 'Redis Server',
  version: '7.x / Distro Stable',
  description:
    'Installs Redis in-memory data store, enables systemd persistence, and verifies responsiveness with redis-cli ping.',
  category: 'databases',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian', 'rocky', 'almalinux', 'fedora'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 512,
  minRamMb: 256,
  requiredPorts: [6379],
  dependencies: [],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: true,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote: 'Existing /etc/redis configuration is preserved.',
  docsUrl: 'https://redis.io/docs/',
  configSchema: [],
  buildPlan: (serverId, serverName) => ({
    installerId: 'official-redis',
    installerName: 'Redis Server',
    version: 'Distro Stable',
    serverId,
    serverName,
    installDir: '/var/lib/redis',
    packages: ['redis-server'],
    servicesToCreate: ['redis-server.service'],
    portsToOpen: [6379],
    filesToModify: ['/etc/redis/redis.conf'],
    configSummary: [{ label: 'Bind Address', value: '127.0.0.1:6379' }],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 80,
    estimatedRamMb: 128,
    rollbackAvailable: false,
    rollbackNote: 'Existing Redis data is preserved.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const existing = await ctx.exec('command -v redis-server >/dev/null 2>&1 && echo yes || echo no');
    if (existing.stdout.trim() === 'yes') {
      ctx.log('Existing Redis detected; ensuring service is active...');
      await ctx.exec(`${sudo}systemctl enable --now redis-server || ${sudo}systemctl enable --now redis`);
      return;
    }

    if (ctx.preflight.pkgManager === 'apt-get') {
      const res = await ctx.exec(`${sudo}apt-get update -y && ${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server`);
      if (res.code !== 0) throw new Error(`Redis install failed: ${res.stderr.slice(-400)}`);
      await ctx.exec(`${sudo}systemctl enable --now redis-server`);
    } else if (ctx.preflight.pkgManager === 'dnf' || ctx.preflight.pkgManager === 'yum') {
      const res = await ctx.exec(`${sudo}${ctx.preflight.pkgManager} install -y redis`);
      if (res.code !== 0) throw new Error(`Redis install failed: ${res.stderr.slice(-400)}`);
      await ctx.exec(`${sudo}systemctl enable --now redis`);
    } else {
      throw new Error(`Unsupported package manager: ${ctx.preflight.pkgManager}`);
    }
  },
  verify: async (ctx) => {
    const pong = await ctx.exec('redis-cli ping');
    const ver = await ctx.exec('redis-server --version');
    if (pong.stdout.trim() !== 'PONG') {
      return { ok: false, details: `redis-cli ping returned "${pong.stdout.trim()}" (${pong.stderr.trim()})` };
    }
    return {
      ok: true,
      versionDetected: ver.stdout.trim(),
      serviceName: 'redis-server',
      installDir: '/var/lib/redis',
      port: 6379,
      details: 'Redis responded with PONG on 127.0.0.1:6379.',
    };
  },
};
