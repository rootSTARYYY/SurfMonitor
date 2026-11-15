import { describe, expect, it } from 'vitest';
import {
  ALL_NAV_ITEMS,
  DEFAULT_SIDEBAR_LAYOUT,
  findWorkspaceForPage,
  resetSidebarLayout,
  WORKSPACES,
} from '../src/utils/sidebarConfig';

describe('Workspace-Based Sidebar & Navigation Registry', () => {
  it('maps every registered navigation item to a valid workspace', () => {
    const wsIds = new Set(WORKSPACES.map((w) => w.id));
    const inWorkspaces = new Set(WORKSPACES.flatMap((w) => w.pages));
    for (const item of ALL_NAV_ITEMS) {
      expect(wsIds.has(item.workspace)).toBe(true);
      expect(inWorkspaces.has(item.id)).toBe(true);
    }
    expect(findWorkspaceForPage('terminal').id).toBe('remote');
    expect(findWorkspaceForPage('pm2-detail').id).toBe('infrastructure');
    expect(findWorkspaceForPage('monitor-detail').id).toBe('monitoring');
  });

  it('restores default sidebar layout cleanly', () => {
    const restored = resetSidebarLayout();
    expect(restored.hiddenItemIds).toEqual([]);
    expect(restored.pinnedItemIds).toEqual([]);
    expect(restored.defaultLandingPage).toBe('overview');
    expect(restored.groups.length).toBe(DEFAULT_SIDEBAR_LAYOUT.groups.length);
  });
});
