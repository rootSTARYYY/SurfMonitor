import { describe, expect, it } from 'vitest';
import {
  auditThemeContrast,
  BUILT_IN_THEMES,
  cloneThemeAsCustom,
  createBlankCustomTheme,
  exportThemeToJson,
  getContrastRatio,
  mapLegacyPresetId,
  parseColorToRgba,
  rgbaToHex,
  rgbToHsl,
  validateAndMigrateTheme,
  validateCustomCss,
} from '../src/theme/themeEngine';

describe('Surf Monitor v4.1.0 Theme Engine', () => {
  it('preserves all 3 built-in presets and migrates legacy theme IDs', () => {
    expect(BUILT_IN_THEMES.length).toBe(3);
    expect(BUILT_IN_THEMES.every((t) => t.builtIn)).toBe(true);
    expect(mapLegacyPresetId('dark')).toBe('preset-dark');
    expect(mapLegacyPresetId('midnight')).toBe('preset-midnight');
    expect(mapLegacyPresetId('oled')).toBe('preset-oled');
  });

  it('creates blank and duplicated custom themes without mutating built-ins', () => {
    const blank = createBlankCustomTheme('Ocean Breeze');
    expect(blank.builtIn).toBe(false);
    expect(blank.name).toBe('Ocean Breeze');

    const copy = cloneThemeAsCustom(BUILT_IN_THEMES[1], 'My Midnight');
    expect(copy.builtIn).toBe(false);
    expect(copy.colors.primary).toBe(BUILT_IN_THEMES[1].colors.primary);
    expect(BUILT_IN_THEMES[1].builtIn).toBe(true);
  });

  it('converts HEX, RGB, and HSL colors accurately and audits WCAG contrast', () => {
    const rgba = parseColorToRgba('#10b981');
    expect(rgba).toEqual({ r: 16, g: 185, b: 129, a: 1 });
    expect(rgbaToHex(rgba.r, rgba.g, rgba.b)).toBe('#10b981');
    const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);
    expect(hsl.h).toBeGreaterThan(150);

    expect(getContrastRatio('#ffffff', '#000000')).toBe(21);

    const lowContrast = createBlankCustomTheme('Low Contrast');
    lowContrast.colors.textPrimary = '#111111';
    lowContrast.colors.appBackground = '#09090b';
    const warnings = auditThemeContrast(lowContrast);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('exports, validates, and imports surf-theme.json while filling missing optional props', () => {
    const theme = createBlankCustomTheme('Neon Ops');
    theme.colors.primary = '#22d3ee';
    const json = exportThemeToJson(theme);
    const reimported = validateAndMigrateTheme(JSON.parse(json));
    expect(reimported.name).toBe('Neon Ops');
    expect(reimported.colors.primary).toBe('#22d3ee');

    // Minimal partial theme with missing optional sections gets defaults
    const minimal = validateAndMigrateTheme({
      name: 'Minimal',
      schemaVersion: 1,
      colors: { primary: '#ff00aa' },
    });
    expect(minimal.colors.primary).toBe('#ff00aa');
    expect(minimal.typography.baseSizePx).toBe(14);
  });

  it('rejects malformed theme files, unsupported schema versions, and unsafe CSS', () => {
    expect(() => validateAndMigrateTheme('not-an-object')).toThrow();
    expect(() =>
      validateAndMigrateTheme({ name: 'Future', schemaVersion: 999 })
    ).toThrow(/Unsupported theme schemaVersion/);

    expect(validateCustomCss('.surf-app-shell { border-radius: 8px; }').valid).toBe(true);
    expect(validateCustomCss('@import url("https://evil.com/x.css");').valid).toBe(false);
    expect(validateCustomCss('body { background: url(file:///C:/secret); }').valid).toBe(false);
    expect(validateCustomCss('div { width: expression(alert(1)); }').valid).toBe(false);
  });
});
