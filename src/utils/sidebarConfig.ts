import { PageId } from '@/types';

export type WorkspaceId =
  | 'overview'
  | 'infrastructure'
  | 'monitoring'
  | 'remote'
  | 'installations'
  | 'tools'
  | 'settings';

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  defaultPage: PageId;
  pages: PageId[];
}

export interface NavItemMeta {
  id: PageId;
  label: string;
  workspace: WorkspaceId;
  aliases?: string[];
}

export interface SidebarGroupConfig {
  id: string;
  title: string;
  collapsed?: boolean;
  hidden?: boolean;
  itemIds: PageId[];
}

export interface SidebarLayoutConfig {
  groups: SidebarGroupConfig[];
  hiddenItemIds: PageId[];
  hiddenWorkspaces: WorkspaceId[];
  pinnedItemIds: PageId[];
  showPinned: boolean;
  showRecent: boolean;
  defaultLandingPage: PageId;
  density: 'comfortable' | 'compact';
}

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    defaultPage: 'overview',
    pages: ['overview'],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    defaultPage: 'servers',
    pages: ['servers', 'agent', 'containers', 'pm2', 'server-groups'],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    defaultPage: 'monitors',
    pages: [
      'monitors',
      'groups',
      'services',
      'dependency-map',
      'incidents',
      'ssl',
      'dns',
      'network',
      'heartbeats',
      'reports',
      'notifications',
    ],
  },
  {
    id: 'remote',
    label: 'Remote Access',
    defaultPage: 'terminal',
    pages: ['terminal', 'sftp', 'commands'],
  },
  {
    id: 'installations',
    label: 'Installations',
    defaultPage: 'installer',
    pages: ['installer', 'apps', 'templates'],
  },
  {
    id: 'tools',
    label: 'Maintenance & Tools',
    defaultPage: 'backups',
    pages: ['backups', 'automation', 'maintenance', 'intelligence'],
  },
  {
    id: 'settings',
    label: 'Settings',
    defaultPage: 'settings',
    pages: ['settings'],
  },
];

export const ALL_NAV_ITEMS: NavItemMeta[] = [
  { id: 'overview', label: 'Dashboard', workspace: 'overview', aliases: ['home', 'summary'] },
  { id: 'servers', label: 'Servers', workspace: 'infrastructure', aliases: ['vps', 'hosts', 'ssh'] },
  { id: 'agent', label: 'Fleet & Agent', workspace: 'infrastructure', aliases: ['ddos', 'performance', 'protection', 'integrity'] },
  { id: 'containers', label: 'Docker Containers', workspace: 'infrastructure', aliases: ['docker'] },
  { id: 'pm2', label: 'PM2 Processes', workspace: 'infrastructure', aliases: ['node', 'daemon'] },
  { id: 'server-groups', label: 'Server Groups', workspace: 'infrastructure', aliases: ['fleet groups'] },
  { id: 'monitors', label: 'Monitors', workspace: 'monitoring', aliases: ['http', 'uptime'] },
  { id: 'groups', label: 'Monitor Groups', workspace: 'monitoring' },
  { id: 'services', label: 'Services', workspace: 'monitoring' },
  { id: 'dependency-map', label: 'Dependency Map', workspace: 'monitoring', aliases: ['graph'] },
  { id: 'incidents', label: 'Incidents', workspace: 'monitoring', aliases: ['outages', 'alerts'] },
  { id: 'ssl', label: 'SSL Certificates', workspace: 'monitoring', aliases: ['tls', 'https'] },
  { id: 'dns', label: 'DNS Records', workspace: 'monitoring' },
  { id: 'network', label: 'TCP / Network', workspace: 'monitoring', aliases: ['ping', 'icmp'] },
  { id: 'heartbeats', label: 'Heartbeats', workspace: 'monitoring', aliases: ['cron'] },
  { id: 'reports', label: 'Reports & Analytics', workspace: 'monitoring', aliases: ['charts'] },
  { id: 'notifications', label: 'Notifications', workspace: 'monitoring', aliases: ['discord', 'telegram', 'smtp', 'email'] },
  { id: 'terminal', label: 'SSH Terminal', workspace: 'remote', aliases: ['shell', 'pty', 'console', 'xterm'] },
  { id: 'sftp', label: 'SFTP Files', workspace: 'remote', aliases: ['files', 'upload', 'download'] },
  { id: 'commands', label: 'Command Center', workspace: 'remote', aliases: ['bulk', 'run'] },
  { id: 'installer', label: 'Installation Center', workspace: 'installations', aliases: ['pterodactyl', 'docker', 'postgres', 'install'] },
  { id: 'apps', label: 'Application Manager', workspace: 'installations', aliases: ['installed'] },
  { id: 'templates', label: 'Deployment Templates', workspace: 'installations', aliases: ['stacks'] },
  { id: 'backups', label: 'Backup Center', workspace: 'tools', aliases: ['restore', 'recovery'] },
  { id: 'automation', label: 'Automation Center', workspace: 'tools', aliases: ['rules'] },
  { id: 'maintenance', label: 'Maintenance Windows', workspace: 'tools', aliases: ['schedule'] },
  { id: 'intelligence', label: 'Website Intelligence', workspace: 'tools', aliases: ['broken links', 'headers'] },
  { id: 'settings', label: 'Settings', workspace: 'settings', aliases: ['theme', 'preferences', 'sidebar'] },
];

export function findWorkspaceForPage(pageId: PageId): WorkspaceDefinition {
  if (pageId === 'monitor-detail') return WORKSPACES.find((w) => w.id === 'monitoring')!;
  if (pageId === 'server-detail' || pageId === 'pm2-detail') {
    return WORKSPACES.find((w) => w.id === 'infrastructure')!;
  }
  return WORKSPACES.find((w) => w.pages.includes(pageId)) ?? WORKSPACES[0];
}

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayoutConfig = {
  groups: WORKSPACES.map((w) => ({
    id: `grp-${w.id}`,
    title: w.label.toUpperCase(),
    itemIds: [...w.pages],
  })),
  hiddenItemIds: [],
  hiddenWorkspaces: [],
  pinnedItemIds: [],
  showPinned: true,
  showRecent: true,
  defaultLandingPage: 'overview',
  density: 'comfortable',
};

export const SIDEBAR_STORAGE_KEY = 'surf_sidebar_layout_v5';

export function loadSidebarLayout(): SidebarLayoutConfig {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<SidebarLayoutConfig>;
    return {
      groups: Array.isArray(parsed.groups) && parsed.groups.length > 0 ? parsed.groups : DEFAULT_SIDEBAR_LAYOUT.groups,
      hiddenItemIds: Array.isArray(parsed.hiddenItemIds) ? parsed.hiddenItemIds : [],
      hiddenWorkspaces: Array.isArray(parsed.hiddenWorkspaces) ? parsed.hiddenWorkspaces : [],
      pinnedItemIds: Array.isArray(parsed.pinnedItemIds) ? parsed.pinnedItemIds : [],
      showPinned: parsed.showPinned !== false,
      showRecent: parsed.showRecent !== false,
      defaultLandingPage: parsed.defaultLandingPage ?? 'overview',
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
    };
  } catch {
    return DEFAULT_SIDEBAR_LAYOUT;
  }
}

export function resetSidebarLayout(): SidebarLayoutConfig {
  try {
    localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  } catch {}
  return {
    ...DEFAULT_SIDEBAR_LAYOUT,
    groups: DEFAULT_SIDEBAR_LAYOUT.groups.map((g) => ({ ...g, itemIds: [...g.itemIds] })),
  };
}
