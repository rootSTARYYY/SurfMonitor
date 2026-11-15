export interface DeploymentTemplateDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  installerIds: string[];
  estimatedRamMb: number;
  estimatedDiskMb: number;
  variables: Array<{
    key: string;
    label: string;
    defaultValue: string;
    secret?: boolean;
  }>;
  notes: string;
}

export const DEPLOYMENT_TEMPLATES: DeploymentTemplateDTO[] = [
  {
    id: 'tpl-docker-uptime',
    name: 'Docker + Uptime Kuma Stack',
    description: 'Installs Docker Engine with Compose v2, then deploys Uptime Kuma with persistent storage.',
    category: 'monitoring',
    installerIds: ['official-docker-engine', 'official-uptime-kuma'],
    estimatedRamMb: 512,
    estimatedDiskMb: 2600,
    variables: [
      { key: 'port', label: 'Uptime Kuma Port', defaultValue: '3001' },
      { key: 'dataDir', label: 'Uptime Kuma Data Directory', defaultValue: '/opt/surf-apps/uptime-kuma/data' },
    ],
    notes: 'Executes Docker Engine installation first, verifies daemon health, then deploys Uptime Kuma.',
  },
  {
    id: 'tpl-node-postgres-redis',
    name: 'Node.js Production Backend (Node + PostgreSQL + Redis + Nginx)',
    description: 'Complete backend runtime stack with Node.js LTS, PostgreSQL, Redis, and Nginx reverse proxy.',
    category: 'web_apps',
    installerIds: ['official-nodejs', 'official-postgresql', 'official-redis', 'official-nginx'],
    estimatedRamMb: 1024,
    estimatedDiskMb: 2500,
    variables: [
      { key: 'majorVersion', label: 'Node.js Major Version', defaultValue: '22' },
      { key: 'dbName', label: 'PostgreSQL Database Name', defaultValue: 'app_db' },
      { key: 'dbUser', label: 'PostgreSQL User', defaultValue: 'app_user' },
      { key: 'dbPassword', label: 'PostgreSQL Password', defaultValue: '', secret: true },
    ],
    notes: 'Installs Node.js, PostgreSQL, Redis, and Nginx sequentially with per-component verification.',
  },
  {
    id: 'tpl-pterodactyl-all-in-one',
    name: 'Pterodactyl Hosting Stack (Panel + Docker + Wings)',
    description: 'Deploys Pterodactyl Panel, Docker Engine, and Pterodactyl Wings on a single Ubuntu/Debian host.',
    category: 'hosting_panels',
    installerIds: ['official-docker-engine', 'official-pterodactyl-panel', 'official-pterodactyl-wings'],
    estimatedRamMb: 2048,
    estimatedDiskMb: 6000,
    variables: [
      { key: 'domain', label: 'Panel Domain (FQDN)', defaultValue: 'panel.example.com' },
      { key: 'adminEmail', label: 'Admin Email', defaultValue: 'admin@example.com' },
      { key: 'adminUsername', label: 'Admin Username', defaultValue: 'admin' },
      { key: 'adminPassword', label: 'Admin Password', defaultValue: '', secret: true },
      { key: 'dbPassword', label: 'Panel DB Password', defaultValue: '', secret: true },
    ],
    notes: 'After Panel and Wings install, create a Node in Panel -> Nodes and paste config.yml to link Wings.',
  },
  {
    id: 'tpl-hardened-vps',
    name: 'Hardened Baseline VPS (Fail2ban + UFW SSH-Safe)',
    description: 'Configures Fail2ban intrusion prevention and UFW firewall while explicitly preserving your SSH port.',
    category: 'security',
    installerIds: ['official-fail2ban', 'official-ufw'],
    estimatedRamMb: 128,
    estimatedDiskMb: 200,
    variables: [
      { key: 'sshPort', label: 'SSH Port to Preserve', defaultValue: '22' },
      { key: 'allowHttp', label: 'Allow HTTP/HTTPS (80/443)', defaultValue: 'true' },
    ],
    notes: 'UFW explicitly allows the configured SSH port before enabling firewall rules.',
  },
];
