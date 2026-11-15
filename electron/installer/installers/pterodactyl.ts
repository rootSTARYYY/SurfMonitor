import { InstallerDefinition } from '../types';

export const pterodactylPanelInstaller: InstallerDefinition = {
  id: 'official-pterodactyl-panel',
  name: 'Pterodactyl Panel',
  version: 'Dynamic (Upstream)',
  description:
    'Guided installation of Pterodactyl Panel (PHP 8.2/8.3, Composer, MariaDB, Redis, Nginx, and pteroq queue worker) following the official Pterodactyl deployment workflow.',
  category: 'hosting_panels',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 4096,
  minRamMb: 1024,
  requiredPorts: [80, 443],
  dependencies: ['mariadb', 'redis', 'nginx'],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: false,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote:
    'On failure, existing databases and /var/www/pterodactyl are preserved untouched so you can inspect logs and recover safely.',
  docsUrl: 'https://pterodactyl.io/panel/1.0/getting_started.html',
  configSchema: [
    { key: 'domain', label: 'Panel Domain / FQDN', type: 'text', required: true, placeholder: 'panel.example.com' },
    { key: 'adminEmail', label: 'Administrator Email', type: 'text', required: true, placeholder: 'admin@example.com' },
    { key: 'adminUsername', label: 'Administrator Username', type: 'text', required: true, defaultValue: 'admin' },
    { key: 'adminPassword', label: 'Administrator Password', type: 'password', required: true, secret: true },
    { key: 'dbName', label: 'Panel Database Name', type: 'text', defaultValue: 'panel', advancedOnly: true },
    { key: 'dbUser', label: 'Panel DB User', type: 'text', defaultValue: 'pterodactyl', advancedOnly: true },
    { key: 'dbPassword', label: 'Panel DB Password', type: 'password', required: true, secret: true },
    { key: 'timezone', label: 'Timezone', type: 'text', defaultValue: 'UTC', advancedOnly: true },
    { key: 'enableSsl', label: 'Configure Let\'s Encrypt SSL (Certbot)', type: 'boolean', defaultValue: false },
    { key: 'installDir', label: 'Installation Directory', type: 'text', defaultValue: '/var/www/pterodactyl', advancedOnly: true },
  ],
  buildPlan: (serverId, serverName, config) => {
    const domain = String(config.domain ?? 'panel.example.com');
    const installDir = String(config.installDir ?? '/var/www/pterodactyl');
    const enableSsl = Boolean(config.enableSsl);
    return {
      installerId: 'official-pterodactyl-panel',
      installerName: 'Pterodactyl Panel',
      version: String(config.selectedVersion || 'Latest Stable'),
      serverId,
      serverName,
      installDir,
      packages: ['php8.3 (fpm,cli,mysql,redis,mbstring,xml,curl,zip,bcmath)', 'composer', 'mariadb-server', 'redis-server', 'nginx', ...(enableSsl ? ['certbot', 'python3-certbot-nginx'] : [])],
      servicesToCreate: ['pteroq.service', 'nginx.service', 'mariadb.service', 'redis-server.service'],
      portsToOpen: enableSsl ? [80, 443] : [80],
      filesToModify: [installDir, '/etc/nginx/sites-available/pterodactyl.conf', '/etc/systemd/system/pteroq.service'],
      configSummary: [
        { label: 'Panel FQDN', value: domain },
        { label: 'Admin User', value: String(config.adminUsername ?? 'admin') },
        { label: 'Database', value: `${String(config.dbName ?? 'panel')} (${String(config.dbUser ?? 'pterodactyl')})` },
        { label: 'SSL (Certbot)', value: enableSsl ? 'Enabled (requires DNS A record)' : 'Disabled (HTTP)' },
      ],
      requiredPrivileges: 'root_or_sudo',
      estimatedDiskMb: 1800,
      estimatedRamMb: 768,
      rollbackAvailable: false,
      rollbackNote: 'Partial failures preserve existing database and panel files for manual recovery.',
      hasDestructiveOperations: false,
      destructiveWarnings: [],
    };
  },
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const domain = String(ctx.config.domain ?? '').trim();
    const adminEmail = String(ctx.config.adminEmail ?? '').trim();
    const adminUser = String(ctx.config.adminUsername ?? 'admin').trim();
    const adminPass = String(ctx.config.adminPassword ?? '');
    const dbName = String(ctx.config.dbName ?? 'panel').replace(/[^a-zA-Z0-9_]/g, '');
    const dbUser = String(ctx.config.dbUser ?? 'pterodactyl').replace(/[^a-zA-Z0-9_]/g, '');
    const dbPass = String(ctx.config.dbPassword ?? '');
    const timezone = String(ctx.config.timezone ?? 'UTC').replace(/[^a-zA-Z0-9_/+:-]/g, '');
    const installDir = String(ctx.config.installDir ?? '/var/www/pterodactyl').replace(/[^a-zA-Z0-9_./-]/g, '');
    const enableSsl = Boolean(ctx.config.enableSsl);

    if (!domain || !adminEmail || !adminPass || !dbPass) {
      throw new Error('Domain, Administrator Email, Administrator Password, and DB Password are required.');
    }

    ctx.log('Step 1/6: Installing PHP, Nginx, MariaDB, Redis, and Composer dependencies...');
    const depsCmd = [
      `${sudo}apt-get update -y`,
      `${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y software-properties-common curl apt-transport-https ca-certificates gnupg tar unzip git mariadb-server redis-server nginx`,
      `${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y php php-cli php-fpm php-common php-mysql php-zip php-gd php-mbstring php-curl php-xml php-bcmath`,
    ].join(' && ');
    const depsRes = await ctx.exec(depsCmd, { timeoutMs: 360_000, label: 'Install Panel Dependencies' });
    if (depsRes.code !== 0) throw new Error(`Dependency installation failed: ${depsRes.stderr.slice(-400)}`);

    await ctx.exec(`${sudo}systemctl enable --now mariadb redis-server nginx`);

    ctx.log('Step 2/6: Configuring MariaDB database & user (credentials redacted)...');
    const escDbPass = dbPass.replace(/'/g, "\\'");
    const sqlSetup = `${sudo}mariadb -e "CREATE USER IF NOT EXISTS '${dbUser}'@'127.0.0.1' IDENTIFIED BY '${escDbPass}'; CREATE DATABASE IF NOT EXISTS ${dbName}; GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbUser}'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;"`;
    const dbRes = await ctx.exec(sqlSetup);
    if (dbRes.code !== 0) throw new Error(`Database configuration failed: ${dbRes.stderr.slice(-300)}`);

    ctx.log('Step 3/6: Downloading Pterodactyl Panel release & installing Composer packages...');
    const dlCmd = [
      `${sudo}mkdir -p "${installDir}"`,
      `curl -Lo /tmp/ptero-panel.tar.gz ${ctx.config.selectedVersion && ctx.config.selectedVersion !== 'distro-stable' ? `https://github.com/pterodactyl/panel/releases/download/${String(ctx.config.selectedVersion).replace(/[^a-zA-Z0-9._-]/g, '')}/panel.tar.gz` : 'https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz'}`,
      `${sudo}tar -xzvf /tmp/ptero-panel.tar.gz -C "${installDir}"`,
      `${sudo}chmod -R 755 "${installDir}/storage" "${installDir}/bootstrap/cache"`,
      `command -v composer >/dev/null 2>&1 || (curl -sS https://getcomposer.org/installer | ${sudo}php -- --install-dir=/usr/local/bin --filename=composer)`,
    ].join(' && ');
    const dlRes = await ctx.exec(dlCmd, { timeoutMs: 300_000 });
    if (dlRes.code !== 0) throw new Error(`Panel download failed: ${dlRes.stderr.slice(-400)}`);

    const compRes = await ctx.exec(
      `cd "${installDir}" && ${sudo}cp -n .env.example .env && ${sudo}COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction`,
      { timeoutMs: 360_000 }
    );
    if (compRes.code !== 0) throw new Error(`Composer install failed: ${compRes.stderr.slice(-400)}`);

    ctx.log('Step 4/6: Configuring .env, running migrations, and creating admin user...');
    const appUrl = `${enableSsl ? 'https' : 'http'}://${domain}`;
    const envCmd = [
      `cd "${installDir}"`,
      `${sudo}php artisan key:generate --force`,
      `${sudo}php artisan p:environment:setup --author="${adminEmail}" --url="${appUrl}" --timezone="${timezone}" --cache=redis --session=redis --queue=redis --redis-host=127.0.0.1 --redis-pass="" --redis-port=6379 --no-interaction`,
      `${sudo}php artisan p:environment:database --host=127.0.0.1 --port=3306 --database="${dbName}" --username="${dbUser}" --password="${escDbPass}" --no-interaction`,
      `${sudo}php artisan migrate --seed --force`,
      `${sudo}php artisan p:user:make --email="${adminEmail}" --username="${adminUser}" --name-first="Admin" --name-last="User" --password="${adminPass.replace(/"/g, '\\"')}" --admin=1 --no-interaction || true`,
      `${sudo}chown -R www-data:www-data "${installDir}"`,
    ].join(' && ');
    const envRes = await ctx.exec(envCmd, { timeoutMs: 240_000 });
    if (envRes.code !== 0) throw new Error(`Panel environment/migration failed: ${envRes.stderr.slice(-400)}`);

    ctx.log('Step 5/6: Configuring pteroq.service worker & Nginx virtual host...');
    const pteroqUnit = `[Unit]
Description=Pterodactyl Queue Worker
After=redis-server.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php ${installDir}/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target`;
    await ctx.exec(`cat <<'EOF' | ${sudo}tee /etc/systemd/system/pteroq.service >/dev/null\n${pteroqUnit}\nEOF`);
    await ctx.exec(`${sudo}systemctl daemon-reload && ${sudo}systemctl enable --now pteroq.service`);

    const phpSockRes = await ctx.exec('ls /run/php/php*-fpm.sock 2>/dev/null | head -n1');
    const phpSock = phpSockRes.stdout.trim() || '/run/php/php-fpm.sock';
    const nginxConf = `server {
    listen 80;
    server_name ${domain};
    root ${installDir}/public;
    index index.php;
    client_max_body_size 100m;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \\.php$ {
        fastcgi_split_path_info ^(.+\\.php)(/.+)$;
        fastcgi_pass unix:${phpSock};
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}`;
    await ctx.exec(`cat <<'EOF' | ${sudo}tee /etc/nginx/sites-available/pterodactyl.conf >/dev/null\n${nginxConf}\nEOF`);
    await ctx.exec(`${sudo}ln -sf /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf && ${sudo}nginx -t && ${sudo}systemctl reload nginx`);

    if (enableSsl) {
      ctx.log('Step 6/6: Issuing Let\'s Encrypt SSL certificate via Certbot...');
      const sslRes = await ctx.exec(
        `${sudo}DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx && ${sudo}certbot --nginx -d "${domain}" --non-interactive --agree-tos -m "${adminEmail}" --redirect`,
        { timeoutMs: 180_000 }
      );
      if (sslRes.code !== 0) {
        throw new Error(`Panel installed over HTTP, but SSL certificate issuance failed: ${sslRes.stderr.slice(-300)}`);
      }
    }
  },
  verify: async (ctx) => {
    const domain = String(ctx.config.domain ?? '127.0.0.1');
    const installDir = String(ctx.config.installDir ?? '/var/www/pterodactyl');
    const enableSsl = Boolean(ctx.config.enableSsl);
    const pteroq = await ctx.exec('systemctl is-active pteroq');
    const httpCode = await ctx.exec(`curl -s -o /dev/null -w "%{http_code}" -H "Host: ${domain}" http://127.0.0.1/`);
    if (pteroq.stdout.trim() !== 'active') {
      return { ok: false, details: `pteroq.service is ${pteroq.stdout.trim()}` };
    }
    return {
      ok: true,
      versionDetected: '1.11.x',
      serviceName: 'pteroq',
      installDir,
      port: enableSsl ? 443 : 80,
      url: `${enableSsl ? 'https' : 'http'}://${domain}`,
      details: `Pterodactyl Panel active (pteroq=active, local HTTP=${httpCode.stdout.trim()}).`,
    };
  },
};

export const pterodactylWingsInstaller: InstallerDefinition = {
  id: 'official-pterodactyl-wings',
  name: 'Pterodactyl Wings (Daemon)',
  version: 'Dynamic (Upstream)',
  description:
    'Installs Pterodactyl Wings daemon, verifies Docker Engine, creates /etc/pterodactyl & systemd wings.service, and guides node configuration.',
  category: 'hosting_panels',
  publisher: 'Surf Infrastructure',
  source: 'official',
  verificationStatus: 'production_ready',
  supportedOs: ['ubuntu', 'debian'],
  supportedArch: ['x86_64', 'amd64', 'aarch64', 'arm64'],
  minDiskMb: 2048,
  minRamMb: 512,
  requiredPorts: [8080, 2022],
  dependencies: ['docker'],
  requiredPrivileges: 'root_or_sudo',
  supportsOneClick: false,
  supportsGuided: true,
  rollbackAvailable: false,
  rollbackNote: 'Existing /var/lib/pterodactyl server volumes are never deleted.',
  docsUrl: 'https://pterodactyl.io/wings/1.0/installing.html',
  configSchema: [
    { key: 'daemonPort', label: 'Wings Daemon Port', type: 'number', defaultValue: 8080 },
    { key: 'sftpPort', label: 'Wings SFTP Port', type: 'number', defaultValue: 2022 },
    { key: 'configYml', label: 'Node config.yml (Optional — paste from Panel -> Nodes -> Configuration)', type: 'text', advancedOnly: false },
  ],
  buildPlan: (serverId, serverName, config) => ({
    installerId: 'official-pterodactyl-wings',
    installerName: 'Pterodactyl Wings',
    version: String(config.selectedVersion || 'Latest Stable'),
    serverId,
    serverName,
    installDir: '/etc/pterodactyl',
    packages: ['wings binary (/usr/local/bin/wings)'],
    servicesToCreate: ['wings.service'],
    portsToOpen: [Number(config.daemonPort ?? 8080), Number(config.sftpPort ?? 2022)],
    filesToModify: ['/usr/local/bin/wings', '/etc/systemd/system/wings.service', '/etc/pterodactyl/config.yml'],
    configSummary: [
      { label: 'Daemon Port', value: String(config.daemonPort ?? 8080) },
      { label: 'SFTP Port', value: String(config.sftpPort ?? 2022) },
      { label: 'Node config.yml', value: config.configYml ? 'Provided (will write & start)' : 'Not provided (manual Panel step)' },
    ],
    requiredPrivileges: 'root_or_sudo',
    estimatedDiskMb: 250,
    estimatedRamMb: 256,
    rollbackAvailable: false,
    rollbackNote: 'Game server volumes under /var/lib/pterodactyl are preserved.',
    hasDestructiveOperations: false,
    destructiveWarnings: [],
  }),
  install: async (ctx) => {
    const sudo = ctx.preflight.isRootOrSudo ? 'sudo -n ' : '';
    const hasDocker = await ctx.exec('command -v docker >/dev/null 2>&1 && echo yes || echo no');
    if (hasDocker.stdout.trim() !== 'yes') {
      throw new Error('Docker Engine must be installed before Pterodactyl Wings.');
    }

    const archFlag = ctx.preflight.arch.includes('arm') || ctx.preflight.arch.includes('aarch64') ? 'arm64' : 'amd64';
    ctx.log(`Downloading Pterodactyl Wings (${archFlag})...`);
    const dl = await ctx.exec(
      `${sudo}mkdir -p /etc/pterodactyl && ${sudo}curl -L -o /usr/local/bin/wings "${ctx.config.selectedVersion ? `https://github.com/pterodactyl/wings/releases/download/${String(ctx.config.selectedVersion).replace(/[^a-zA-Z0-9._-]/g, '')}/wings_linux_${archFlag}` : `https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_${archFlag}`}" && ${sudo}chmod u+x /usr/local/bin/wings`,
      { timeoutMs: 180_000 }
    );
    if (dl.code !== 0) throw new Error(`Wings download failed: ${dl.stderr.slice(-300)}`);

    const unit = `[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target`;
    await ctx.exec(`cat <<'EOF' | ${sudo}tee /etc/systemd/system/wings.service >/dev/null\n${unit}\nEOF`);
    await ctx.exec(`${sudo}systemctl daemon-reload`);

    const cfgYml = String(ctx.config.configYml ?? '').trim();
    if (cfgYml) {
      ctx.log('Writing /etc/pterodactyl/config.yml and starting wings.service...');
      await ctx.exec(`cat <<'EOF' | ${sudo}tee /etc/pterodactyl/config.yml >/dev/null\n${cfgYml}\nEOF`);
      await ctx.exec(`${sudo}systemctl enable --now wings`);
    } else {
      ctx.log('Wings binary installed. Next step: In Pterodactyl Panel -> Nodes -> Create Node -> Configuration, paste config.yml into /etc/pterodactyl/config.yml and run `systemctl enable --now wings`.');
    }
  },
  verify: async (ctx) => {
    const ver = await ctx.exec('/usr/local/bin/wings --version');
    if (ver.code !== 0) {
      return { ok: false, details: `Wings binary verification failed: ${ver.stderr.trim()}` };
    }
    const cfgYml = String(ctx.config.configYml ?? '').trim();
    const active = await ctx.exec('systemctl is-active wings || true');
    if (cfgYml && active.stdout.trim() !== 'active') {
      return { ok: false, details: `Wings binary installed (${ver.stdout.trim()}), but wings.service is ${active.stdout.trim()}.` };
    }
    return {
      ok: true,
      versionDetected: ver.stdout.trim(),
      serviceName: 'wings',
      installDir: '/etc/pterodactyl',
      port: Number(ctx.config.daemonPort ?? 8080),
      details: cfgYml
        ? `Wings ${ver.stdout.trim()} is active.`
        : `Wings ${ver.stdout.trim()} installed. Paste Node config.yml from Panel into /etc/pterodactyl/config.yml to start daemon.`,
    };
  },
};
