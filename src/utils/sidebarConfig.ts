import { PageId } from '@/types';

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
  pinnedItemIds: PageId[];
  defaultLandingPage: PageId;
  density: 'comfortable' | 'compact';
}

export const ALL_NAV_ITEMS: Array<{ id: PageId; label: string }> = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'monitors', label: 'Monitors' },
  { id: 'groups', label: 'Monitor Groups' },
  { id: 'services', label: 'Services' },
  { id: 'dependency-map', label: 'Dependency Map' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'servers', label: 'Servers' },
  { id: 'containers', label: 'Docker Containers' },
  { id: 'server-groups', label: 'Server Groups' },
  { id: 'pm2', label: 'PM2 Processes' },
  { id: 'terminal', label: 'SSH Terminal' },
  { id: 'sftp', label: 'SFTP Files' },
  { id: 'commands', label: 'Command Center' },
  { id: 'installer', label: 'Installation Center' },
  { id: 'apps', label: 'Application Manager' },
  { id: 'templates', label: 'Templates' },
  { id: 'ssl', label: 'SSL Certificates' },
  { id: 'dns', label: 'DNS Records' },
  { id: 'network', label: 'TCP / Network' },
  { id: 'heartbeats', label: 'Heartbeats' },
  { id: 'intelligence', label: 'Website Intelligence' },
  { id: 'backups', label: 'Backup Center' },
  { id: 'automation', label: 'Automation Center' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'settings', label: 'Settings' },
];

export const DEFAULT_SIDEBAR_LAYOUT: SidebarLayoutConfig = {
  groups: [
    {
      id: 'grp-overview',
      title: 'OVERVIEW',
      itemIds: ['overview', 'monitors', 'groups', 'services', 'dependency-map', 'incidents'],
    },
    {
      id: 'grp-infra',
      title: 'INFRASTRUCTURE',
      itemIds: ['servers', 'containers', 'server-groups', 'pm2'],
    },
    {
      id: 'grp-ops',
      title: 'OPERATIONS',
      itemIds: ['terminal', 'sftp', 'commands'],
    },
    {
      id: 'grp-deploy',
      title: 'DEPLOYMENT',
      itemIds: ['installer', 'apps', 'templates'],
    },
    {
      id: 'grp-monitoring',
      title: 'MONITORING',
      itemIds: ['ssl', 'dns', 'network', 'heartbeats', 'intelligence'],
    },
    {
      id: 'grp-maint',
      title: 'MAINTENANCE & SETTINGS',
      itemIds: ['backups', 'automation', 'notifications', 'reports', 'maintenance', 'settings'],
    },
  ],
  hiddenItemIds: [],
  pinnedItemIds: [],
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
      pinnedItemIds: Array.isArray(parsed.pinnedItemIds) ? parsed.pinnedItemIds : [],
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
