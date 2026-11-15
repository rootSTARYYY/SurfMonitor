import { describe, expect, it } from 'vitest';
import {
  ALL_NAV_ITEMS,
  DEFAULT_SIDEBAR_LAYOUT,
  resetSidebarLayout,
} from '../src/utils/sidebarConfig';

describe('Sidebar & Navigation Customization', () => {
  it('includes all v5.0.0 navigation items in default layout', () => {
    const inGroups = new Set(DEFAULT_SIDEBAR_LAYOUT.groups.flatMap((g) => g.itemIds));
    for (const item of ALL_NAV_ITEMS) {
      expect(inGroups.has(item.id)).toBe(true);
    }
  });

  it('restores default sidebar layout cleanly', () => {
    const restored = resetSidebarLayout();
    expect(restored.hiddenItemIds).toEqual([]);
    expect(restored.pinnedItemIds).toEqual([]);
    expect(restored.defaultLandingPage).toBe('overview');
    expect(restored.groups.length).toBe(DEFAULT_SIDEBAR_LAYOUT.groups.length);
  });
});
