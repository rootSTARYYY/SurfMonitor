export const THEME_SCHEMA_VERSION = 1;

export interface GradientStop {
  color: string;
  position: number;
}

export interface SurfThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  appBackground: string;
  sidebarBackground: string;
  toolbarBackground: string;
  contentBackground: string;
  cardBackground: string;
  elevatedBackground: string;
  modalBackground: string;
  dropdownBackground: string;
  inputBackground: string;
  borderColor: string;
  dividerColor: string;
  hoverColor: string;
  selectedColor: string;
  activeColor: string;
  focusRingColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  linkColor: string;
}

export interface SurfThemeStatusColors {
  operational: string;
  online: string;
  offline: string;
  degraded: string;
  warning: string;
  critical: string;
  maintenance: string;
  unknown: string;
  pending: string;
  success: string;
  error: string;
}

export interface SurfThemeTypography {
  appFont: string;
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  baseSizePx: number;
  headingScale: number;
  smallSizePx: number;
  buttonSizePx: number;
  headingWeight: number;
  bodyWeight: number;
  lineHeight: number;
  letterSpacingEm: number;
  headingTransform: 'none' | 'uppercase' | 'capitalize';
}

export interface SurfThemeLayout {
  sidebarWidthPx: number;
  sidebarPosition: 'left' | 'right';
  sidebarCompact: boolean;
  sidebarIconPx: number;
  sidebarSpacingPx: number;
  toolbarHeightPx: number;
  contentSpacingPx: number;
  pagePaddingPx: number;
  cardSpacingPx: number;
  cardPaddingPx: number;
  gridDensity: 'compact' | 'comfortable' | 'spacious';
  borderRadiusPx: number;
  buttonRadiusPx: number;
  inputRadiusPx: number;
  modalRadiusPx: number;
  borderWidthPx: number;
  shadowIntensity: number;
  elevationIntensity: number;
}

export interface SurfThemeComponents {
  buttonBg: string;
  buttonText: string;
  buttonBorder: string;
  buttonHoverBg: string;
  buttonPaddingX: number;
  buttonPaddingY: number;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  tableHeaderBg: string;
  tableRowHoverBg: string;
  badgeRadiusPx: number;
  progressTrackBg: string;
}

export interface SurfThemeBackground {
  mode: 'solid' | 'linear' | 'radial' | 'image';
  gradientStops: GradientStop[];
  gradientAngleDeg: number;
  imageDataUrl: string;
  imageOpacity: number;
  imagePosition: 'center' | 'top' | 'bottom' | 'left' | 'right';
  imageSize: 'cover' | 'contain' | 'auto';
  overlayColor: string;
  overlayOpacity: number;
}

export interface SurfThemeEffects {
  shadowsEnabled: boolean;
  glowEnabled: boolean;
  glowIntensity: number;
  blurEnabled: boolean;
  blurPx: number;
  glassOpacity: number;
  borderHighlight: boolean;
  transitionsEnabled: boolean;
  transitionMs: number;
  animationIntensity: 'none' | 'subtle' | 'full';
  focusEffectEnabled: boolean;
}

export interface SurfThemeCustomCss {
  enabled: boolean;
  css: string;
}

export interface SurfTheme {
  id: string;
  name: string;
  schemaVersion: number;
  builtIn: boolean;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  colors: SurfThemeColors;
  status: SurfThemeStatusColors;
  typography: SurfThemeTypography;
  layout: SurfThemeLayout;
  components: SurfThemeComponents;
  background: SurfThemeBackground;
  effects: SurfThemeEffects;
  customCss: SurfThemeCustomCss;
}

export const SAFE_FONT_STACKS = {
  sans: [
    { label: 'Inter / System Sans', value: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { label: 'Segoe UI (Windows)', value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
    { label: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
    { label: 'Geometric Sans', value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
    { label: 'Classic Serif', value: "Georgia, 'Times New Roman', serif" },
  ],
  mono: [
    { label: 'JetBrains Mono / Consolas', value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
    { label: 'Cascadia / Consolas', value: "'Cascadia Code', Consolas, 'Courier New', monospace" },
    { label: 'System Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  ],
};

function baseTypography(): SurfThemeTypography {
  return {
    appFont: SAFE_FONT_STACKS.sans[0].value,
    headingFont: SAFE_FONT_STACKS.sans[0].value,
    bodyFont: SAFE_FONT_STACKS.sans[0].value,
    monoFont: SAFE_FONT_STACKS.mono[0].value,
    baseSizePx: 14,
    headingScale: 1.25,
    smallSizePx: 11,
    buttonSizePx: 12,
    headingWeight: 600,
    bodyWeight: 400,
    lineHeight: 1.5,
    letterSpacingEm: 0,
    headingTransform: 'none',
  };
}

function baseLayout(): SurfThemeLayout {
  return {
    sidebarWidthPx: 240,
    sidebarPosition: 'left',
    sidebarCompact: false,
    sidebarIconPx: 16,
    sidebarSpacingPx: 4,
    toolbarHeightPx: 48,
    contentSpacingPx: 16,
    pagePaddingPx: 20,
    cardSpacingPx: 16,
    cardPaddingPx: 16,
    gridDensity: 'comfortable',
    borderRadiusPx: 6,
    buttonRadiusPx: 6,
    inputRadiusPx: 6,
    modalRadiusPx: 8,
    borderWidthPx: 1,
    shadowIntensity: 0.35,
    elevationIntensity: 1,
  };
}

function baseEffects(): SurfThemeEffects {
  return {
    shadowsEnabled: true,
    glowEnabled: false,
    glowIntensity: 0.25,
    blurEnabled: false,
    blurPx: 8,
    glassOpacity: 0.92,
    borderHighlight: false,
    transitionsEnabled: true,
    transitionMs: 150,
    animationIntensity: 'subtle',
    focusEffectEnabled: true,
  };
}

function baseStatus(): SurfThemeStatusColors {
  return {
    operational: '#10b981',
    online: '#34d399',
    offline: '#f43f5e',
    degraded: '#f59e0b',
    warning: '#fbbf24',
    critical: '#ef4444',
    maintenance: '#38bdf8',
    unknown: '#71717a',
    pending: '#a78bfa',
    success: '#10b981',
    error: '#f43f5e',
  };
}

export const BUILT_IN_THEMES: SurfTheme[] = [
  {
    id: 'preset-dark',
    name: 'Obsidian Dark',
    schemaVersion: THEME_SCHEMA_VERSION,
    builtIn: true,
    description: 'Default #09090b OpenStatus-inspired dark theme.',
    author: 'Surf Monitor',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    colors: {
      primary: '#10b981',
      secondary: '#38bdf8',
      accent: '#b5e637',
      background: '#09090b',
      appBackground: '#09090b',
      sidebarBackground: '#09090b',
      toolbarBackground: '#09090b',
      contentBackground: '#09090b',
      cardBackground: '#09090b',
      elevatedBackground: '#101114',
      modalBackground: '#111216',
      dropdownBackground: '#111216',
      inputBackground: '#101114',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      dividerColor: 'rgba(255, 255, 255, 0.06)',
      hoverColor: 'rgba(255, 255, 255, 0.04)',
      selectedColor: 'rgba(255, 255, 255, 0.07)',
      activeColor: '#059669',
      focusRingColor: 'rgba(16, 185, 129, 0.5)',
      textPrimary: '#f4f4f5',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      textDisabled: '#52525b',
      linkColor: '#34d399',
    },
    status: baseStatus(),
    typography: baseTypography(),
    layout: baseLayout(),
    components: {
      buttonBg: '#059669',
      buttonText: '#ffffff',
      buttonBorder: 'rgba(16, 185, 129, 0.4)',
      buttonHoverBg: '#10b981',
      buttonPaddingX: 14,
      buttonPaddingY: 6,
      cardBg: '#09090b',
      cardBorder: 'rgba(255, 255, 255, 0.08)',
      inputBg: '#101114',
      inputBorder: 'rgba(255, 255, 255, 0.1)',
      tableHeaderBg: '#0e1014',
      tableRowHoverBg: 'rgba(255, 255, 255, 0.03)',
      badgeRadiusPx: 4,
      progressTrackBg: 'rgba(255, 255, 255, 0.06)',
    },
    background: {
      mode: 'solid',
      gradientStops: [
        { color: '#09090b', position: 0 },
        { color: '#111827', position: 100 },
      ],
      gradientAngleDeg: 135,
      imageDataUrl: '',
      imageOpacity: 0.25,
      imagePosition: 'center',
      imageSize: 'cover',
      overlayColor: '#09090b',
      overlayOpacity: 0.72,
    },
    effects: baseEffects(),
    customCss: { enabled: false, css: '' },
  },
  {
    id: 'preset-midnight',
    name: 'Midnight Blue',
    schemaVersion: THEME_SCHEMA_VERSION,
    builtIn: true,
    description: 'Deep navy #0b101b infrastructure theme with cyan highlights.',
    author: 'Surf Monitor',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    colors: {
      primary: '#38bdf8',
      secondary: '#10b981',
      accent: '#38bdf8',
      background: '#0b101b',
      appBackground: '#0b101b',
      sidebarBackground: '#090e18',
      toolbarBackground: '#0b101b',
      contentBackground: '#0b101b',
      cardBackground: '#0f1626',
      elevatedBackground: '#141d31',
      modalBackground: '#131b2e',
      dropdownBackground: '#131b2e',
      inputBackground: '#0d1424',
      borderColor: 'rgba(148, 163, 184, 0.14)',
      dividerColor: 'rgba(148, 163, 184, 0.09)',
      hoverColor: 'rgba(56, 189, 248, 0.07)',
      selectedColor: 'rgba(56, 189, 248, 0.12)',
      activeColor: '#0284c7',
      focusRingColor: 'rgba(56, 189, 248, 0.5)',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      textDisabled: '#475569',
      linkColor: '#38bdf8',
    },
    status: baseStatus(),
    typography: baseTypography(),
    layout: baseLayout(),
    components: {
      buttonBg: '#0284c7',
      buttonText: '#ffffff',
      buttonBorder: 'rgba(56, 189, 248, 0.4)',
      buttonHoverBg: '#0ea5e9',
      buttonPaddingX: 14,
      buttonPaddingY: 6,
      cardBg: '#0f1626',
      cardBorder: 'rgba(148, 163, 184, 0.14)',
      inputBg: '#0d1424',
      inputBorder: 'rgba(148, 163, 184, 0.18)',
      tableHeaderBg: '#0d1424',
      tableRowHoverBg: 'rgba(56, 189, 248, 0.05)',
      badgeRadiusPx: 4,
      progressTrackBg: 'rgba(148, 163, 184, 0.12)',
    },
    background: {
      mode: 'solid',
      gradientStops: [
        { color: '#0b101b', position: 0 },
        { color: '#111c33', position: 100 },
      ],
      gradientAngleDeg: 135,
      imageDataUrl: '',
      imageOpacity: 0.25,
      imagePosition: 'center',
      imageSize: 'cover',
      overlayColor: '#0b101b',
      overlayOpacity: 0.75,
    },
    effects: baseEffects(),
    customCss: { enabled: false, css: '' },
  },
  {
    id: 'preset-oled',
    name: 'OLED Pure',
    schemaVersion: THEME_SCHEMA_VERSION,
    builtIn: true,
    description: 'True #050507 high-contrast black theme.',
    author: 'Surf Monitor',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    colors: {
      primary: '#10b981',
      secondary: '#a78bfa',
      accent: '#10b981',
      background: '#050507',
      appBackground: '#050507',
      sidebarBackground: '#050507',
      toolbarBackground: '#050507',
      contentBackground: '#050507',
      cardBackground: '#08080b',
      elevatedBackground: '#0e0e12',
      modalBackground: '#0c0c10',
      dropdownBackground: '#0c0c10',
      inputBackground: '#0b0b0f',
      borderColor: 'rgba(255, 255, 255, 0.09)',
      dividerColor: 'rgba(255, 255, 255, 0.06)',
      hoverColor: 'rgba(255, 255, 255, 0.05)',
      selectedColor: 'rgba(255, 255, 255, 0.09)',
      activeColor: '#059669',
      focusRingColor: 'rgba(16, 185, 129, 0.55)',
      textPrimary: '#fafafa',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      textDisabled: '#52525b',
      linkColor: '#34d399',
    },
    status: baseStatus(),
    typography: baseTypography(),
    layout: baseLayout(),
    components: {
      buttonBg: '#059669',
      buttonText: '#ffffff',
      buttonBorder: 'rgba(16, 185, 129, 0.45)',
      buttonHoverBg: '#10b981',
      buttonPaddingX: 14,
      buttonPaddingY: 6,
      cardBg: '#08080b',
      cardBorder: 'rgba(255, 255, 255, 0.09)',
      inputBg: '#0b0b0f',
      inputBorder: 'rgba(255, 255, 255, 0.12)',
      tableHeaderBg: '#08080b',
      tableRowHoverBg: 'rgba(255, 255, 255, 0.04)',
      badgeRadiusPx: 4,
      progressTrackBg: 'rgba(255, 255, 255, 0.07)',
    },
    background: {
      mode: 'solid',
      gradientStops: [
        { color: '#050507', position: 0 },
        { color: '#09090d', position: 100 },
      ],
      gradientAngleDeg: 135,
      imageDataUrl: '',
      imageOpacity: 0.25,
      imagePosition: 'center',
      imageSize: 'cover',
      overlayColor: '#050507',
      overlayOpacity: 0.8,
    },
    effects: baseEffects(),
    customCss: { enabled: false, css: '' },
  },
];

export function mapLegacyPresetId(legacyTheme?: string): string {
  if (legacyTheme === 'midnight') return 'preset-midnight';
  if (legacyTheme === 'oled') return 'preset-oled';
  return 'preset-dark';
}

export function createBlankCustomTheme(name = 'My Custom Theme'): SurfTheme {
  const base = JSON.parse(JSON.stringify(BUILT_IN_THEMES[0])) as SurfTheme;
  const now = new Date().toISOString();
  return {
    ...base,
    id: `theme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    builtIn: false,
    description: 'Custom user theme',
    author: 'User',
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneThemeAsCustom(source: SurfTheme, newName: string): SurfTheme {
  const cloned = JSON.parse(JSON.stringify(source)) as SurfTheme;
  const now = new Date().toISOString();
  return {
    ...cloned,
    id: `theme-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: newName.trim() || `${source.name} Copy`,
    builtIn: false,
    createdAt: now,
    updatedAt: now,
  };
}

// --- Color Conversion & WCAG Contrast Utilities ---
export function isValidColorString(val: string): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return true;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(s)) return true;
  if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(s)) return true;
  return false;
}

export function parseColorToRgba(input: string): { r: number; g: number; b: number; a: number } {
  const s = (input || '').trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b, a };
      }
    }
  }
  const rgbMatch = s.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i
  );
  if (rgbMatch) {
    return {
      r: Math.min(255, Number(rgbMatch[1])),
      g: Math.min(255, Number(rgbMatch[2])),
      b: Math.min(255, Number(rgbMatch[3])),
      a: rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, Number(rgbMatch[4]))) : 1,
    };
  }
  const hslMatch = s.match(
    /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%(?:\s*,\s*([0-9.]+))?\s*\)$/i
  );
  if (hslMatch) {
    const { r, g, b } = hslToRgb(
      Number(hslMatch[1]) % 360,
      Math.min(100, Number(hslMatch[2])),
      Math.min(100, Number(hslMatch[3]))
    );
    return {
      r,
      g,
      b,
      a: hslMatch[4] !== undefined ? Math.min(1, Math.max(0, Number(hslMatch[4]))) : 1,
    };
  }
  return { r: 16, g: 185, b: 129, a: 1 };
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.min(100, Math.max(0, s)) / 100;
  const ln = Math.min(100, Math.max(0, l)) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(hn) * 255),
    b: Math.round(hue2rgb(hn - 1 / 3) * 255),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(fg: string, bg: string): number {
  const f = parseColorToRgba(fg);
  const b = parseColorToRgba(bg);
  const l1 = relativeLuminance(f.r, f.g, f.b);
  const l2 = relativeLuminance(b.r, b.g, b.b);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return Number(((bright + 0.05) / (dark + 0.05)).toFixed(2));
}

export function auditThemeContrast(theme: SurfTheme): Array<{
  pair: string;
  ratio: number;
  level: 'fail' | 'aa-large' | 'ok';
}> {
  const checks = [
    { pair: 'Primary Text on App Background', fg: theme.colors.textPrimary, bg: theme.colors.appBackground },
    { pair: 'Primary Text on Card Surface', fg: theme.colors.textPrimary, bg: theme.colors.cardBackground },
    { pair: 'Secondary Text on Card Surface', fg: theme.colors.textSecondary, bg: theme.colors.cardBackground },
    { pair: 'Button Text on Button Background', fg: theme.components.buttonText, bg: theme.components.buttonBg },
  ];
  return checks
    .map((c) => {
      const ratio = getContrastRatio(c.fg, c.bg);
      const level: 'fail' | 'aa-large' | 'ok' =
        ratio < 3 ? 'fail' : ratio < 4.5 ? 'aa-large' : 'ok';
      return { pair: c.pair, ratio, level };
    })
    .filter((r) => r.level !== 'ok');
}

// --- Safe Custom CSS Sanitizer ---
const UNSAFE_CSS_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /@import\b/i, reason: '@import rules are blocked for security' },
  { re: /expression\s*\(/i, reason: 'CSS expression() is not allowed' },
  { re: /javascript\s*:/i, reason: 'javascript: URLs are not allowed in CSS' },
  { re: /vbscript\s*:/i, reason: 'vbscript: URLs are not allowed in CSS' },
  { re: /behavior\s*:/i, reason: 'behavior: rules are not allowed' },
  { re: /-moz-binding\s*:/i, reason: '-moz-binding is not allowed' },
  { re: /url\s*\(\s*['"]?\s*(https?:|file:|ftp:)/i, reason: 'External or local file:// URLs are blocked in custom CSS' },
];

export function validateCustomCss(css: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof css !== 'string') {
    return { valid: false, errors: ['Custom CSS must be a string'] };
  }
  if (css.length > 50_000) {
    errors.push('Custom CSS exceeds 50 KB size limit');
  }
  for (const p of UNSAFE_CSS_PATTERNS) {
    if (p.re.test(css)) {
      errors.push(p.reason);
    }
  }
  // Basic brace balance check
  let depth = 0;
  for (const ch of css) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) {
      errors.push('Unmatched closing brace "}" in custom CSS');
      break;
    }
  }
  if (depth > 0) {
    errors.push('Unclosed block "{" in custom CSS');
  }
  return { valid: errors.length === 0, errors };
}

// --- Theme Import / Export & Schema Validation ---
export function exportThemeToJson(theme: SurfTheme): string {
  const clean: SurfTheme = {
    ...theme,
    schemaVersion: THEME_SCHEMA_VERSION,
    builtIn: false,
  };
  return JSON.stringify(clean, null, 2);
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function validateAndMigrateTheme(raw: unknown): SurfTheme {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Theme file must be a valid JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  const ver = Number(obj.schemaVersion ?? 1);
  if (!Number.isFinite(ver) || ver < 1 || ver > THEME_SCHEMA_VERSION) {
    throw new Error(`Unsupported theme schemaVersion: ${String(obj.schemaVersion)}.`);
  }
  const name = String(obj.name ?? '').replace(/[<>&"'`]/g, '').trim();
  if (!name || name.length > 60) {
    throw new Error('Theme must have a valid name (1–60 characters).');
  }

  const def = BUILT_IN_THEMES[0];
  const merged = cloneThemeAsCustom(def, name);
  if (typeof obj.description === 'string') merged.description = obj.description.slice(0, 200);
  if (typeof obj.author === 'string') merged.author = obj.author.slice(0, 60);

  if (obj.colors && typeof obj.colors === 'object') {
    const src = obj.colors as Record<string, unknown>;
    for (const k of Object.keys(merged.colors) as Array<keyof SurfThemeColors>) {
      if (typeof src[k] === 'string' && isValidColorString(src[k] as string)) {
        merged.colors[k] = (src[k] as string).trim();
      }
    }
  }

  if (obj.status && typeof obj.status === 'object') {
    const src = obj.status as Record<string, unknown>;
    for (const k of Object.keys(merged.status) as Array<keyof SurfThemeStatusColors>) {
      if (typeof src[k] === 'string' && isValidColorString(src[k] as string)) {
        merged.status[k] = (src[k] as string).trim();
      }
    }
  }

  if (obj.typography && typeof obj.typography === 'object') {
    const src = obj.typography as Record<string, unknown>;
    if (typeof src.appFont === 'string') merged.typography.appFont = src.appFont.slice(0, 140);
    if (typeof src.headingFont === 'string') merged.typography.headingFont = src.headingFont.slice(0, 140);
    if (typeof src.bodyFont === 'string') merged.typography.bodyFont = src.bodyFont.slice(0, 140);
    if (typeof src.monoFont === 'string') merged.typography.monoFont = src.monoFont.slice(0, 140);
    merged.typography.baseSizePx = clampNum(src.baseSizePx, 11, 20, merged.typography.baseSizePx);
    merged.typography.headingScale = clampNum(src.headingScale, 1, 1.8, merged.typography.headingScale);
    merged.typography.smallSizePx = clampNum(src.smallSizePx, 9, 15, merged.typography.smallSizePx);
    merged.typography.buttonSizePx = clampNum(src.buttonSizePx, 10, 16, merged.typography.buttonSizePx);
    merged.typography.headingWeight = clampNum(src.headingWeight, 400, 800, merged.typography.headingWeight);
    merged.typography.bodyWeight = clampNum(src.bodyWeight, 300, 700, merged.typography.bodyWeight);
    merged.typography.lineHeight = clampNum(src.lineHeight, 1.1, 2.2, merged.typography.lineHeight);
    merged.typography.letterSpacingEm = clampNum(src.letterSpacingEm, -0.05, 0.15, merged.typography.letterSpacingEm);
  }

  if (obj.layout && typeof obj.layout === 'object') {
    const src = obj.layout as Record<string, unknown>;
    merged.layout.sidebarWidthPx = clampNum(src.sidebarWidthPx, 180, 340, merged.layout.sidebarWidthPx);
    if (src.sidebarPosition === 'left' || src.sidebarPosition === 'right') {
      merged.layout.sidebarPosition = src.sidebarPosition;
    }
    if (typeof src.sidebarCompact === 'boolean') merged.layout.sidebarCompact = src.sidebarCompact;
    merged.layout.sidebarIconPx = clampNum(src.sidebarIconPx, 12, 24, merged.layout.sidebarIconPx);
    merged.layout.toolbarHeightPx = clampNum(src.toolbarHeightPx, 38, 72, merged.layout.toolbarHeightPx);
    merged.layout.pagePaddingPx = clampNum(src.pagePaddingPx, 8, 40, merged.layout.pagePaddingPx);
    merged.layout.cardPaddingPx = clampNum(src.cardPaddingPx, 8, 32, merged.layout.cardPaddingPx);
    merged.layout.cardSpacingPx = clampNum(src.cardSpacingPx, 8, 32, merged.layout.cardSpacingPx);
    merged.layout.borderRadiusPx = clampNum(src.borderRadiusPx, 0, 20, merged.layout.borderRadiusPx);
    merged.layout.buttonRadiusPx = clampNum(src.buttonRadiusPx, 0, 20, merged.layout.buttonRadiusPx);
    merged.layout.inputRadiusPx = clampNum(src.inputRadiusPx, 0, 20, merged.layout.inputRadiusPx);
    merged.layout.modalRadiusPx = clampNum(src.modalRadiusPx, 0, 24, merged.layout.modalRadiusPx);
    merged.layout.borderWidthPx = clampNum(src.borderWidthPx, 0, 4, merged.layout.borderWidthPx);
  }

  if (obj.components && typeof obj.components === 'object') {
    const src = obj.components as Record<string, unknown>;
    for (const k of ['buttonBg', 'buttonText', 'buttonBorder', 'buttonHoverBg', 'cardBg', 'cardBorder', 'inputBg', 'inputBorder', 'tableHeaderBg', 'tableRowHoverBg', 'progressTrackBg'] as const) {
      if (typeof src[k] === 'string' && isValidColorString(src[k] as string)) {
        merged.components[k] = (src[k] as string).trim();
      }
    }
    merged.components.badgeRadiusPx = clampNum(src.badgeRadiusPx, 0, 16, merged.components.badgeRadiusPx);
  }

  if (obj.background && typeof obj.background === 'object') {
    const src = obj.background as Record<string, unknown>;
    if (src.mode === 'solid' || src.mode === 'linear' || src.mode === 'radial' || src.mode === 'image') {
      merged.background.mode = src.mode;
    }
    merged.background.gradientAngleDeg = clampNum(src.gradientAngleDeg, 0, 360, merged.background.gradientAngleDeg);
    merged.background.imageOpacity = clampNum(src.imageOpacity, 0, 1, merged.background.imageOpacity);
    merged.background.overlayOpacity = clampNum(src.overlayOpacity, 0, 1, merged.background.overlayOpacity);
    if (typeof src.overlayColor === 'string' && isValidColorString(src.overlayColor)) {
      merged.background.overlayColor = src.overlayColor;
    }
    if (typeof src.imageDataUrl === 'string' && src.imageDataUrl.startsWith('data:image/')) {
      merged.background.imageDataUrl = src.imageDataUrl.slice(0, 2_000_000);
    }
  }

  if (obj.effects && typeof obj.effects === 'object') {
    const src = obj.effects as Record<string, unknown>;
    if (typeof src.shadowsEnabled === 'boolean') merged.effects.shadowsEnabled = src.shadowsEnabled;
    if (typeof src.glowEnabled === 'boolean') merged.effects.glowEnabled = src.glowEnabled;
    if (typeof src.blurEnabled === 'boolean') merged.effects.blurEnabled = src.blurEnabled;
    if (typeof src.transitionsEnabled === 'boolean') merged.effects.transitionsEnabled = src.transitionsEnabled;
    merged.effects.transitionMs = clampNum(src.transitionMs, 0, 500, merged.effects.transitionMs);
    merged.effects.blurPx = clampNum(src.blurPx, 0, 24, merged.effects.blurPx);
  }

  if (obj.customCss && typeof obj.customCss === 'object') {
    const src = obj.customCss as Record<string, unknown>;
    if (typeof src.css === 'string') {
      const check = validateCustomCss(src.css);
      if (!check.valid) {
        throw new Error(`Unsafe custom CSS rejected: ${check.errors[0]}`);
      }
      merged.customCss.css = src.css;
      merged.customCss.enabled = Boolean(src.enabled);
    }
  }

  return merged;
}

// --- Live DOM Application ---
export function buildBackgroundStyle(theme: SurfTheme): string {
  const bg = theme.background;
  if (bg.mode === 'linear' && bg.gradientStops.length >= 2) {
    const stops = bg.gradientStops.map((s) => `${s.color} ${s.position}%`).join(', ');
    return `linear-gradient(${bg.gradientAngleDeg}deg, ${stops})`;
  }
  if (bg.mode === 'radial' && bg.gradientStops.length >= 2) {
    const stops = bg.gradientStops.map((s) => `${s.color} ${s.position}%`).join(', ');
    return `radial-gradient(circle at ${bg.imagePosition}, ${stops})`;
  }
  return theme.colors.appBackground;
}

export function applyThemeToDocument(theme: SurfTheme, safeModeNoCss = false): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const s = root.style;

  // Global colors
  s.setProperty('--surf-primary', theme.colors.primary);
  s.setProperty('--surf-secondary', theme.colors.secondary);
  s.setProperty('--surf-accent', theme.colors.accent);
  s.setProperty('--surf-app-bg', theme.colors.appBackground);
  s.setProperty('--surf-sidebar-bg', theme.colors.sidebarBackground);
  s.setProperty('--surf-toolbar-bg', theme.colors.toolbarBackground);
  s.setProperty('--surf-content-bg', theme.colors.contentBackground);
  s.setProperty('--surf-card-bg', theme.components.cardBg || theme.colors.cardBackground);
  s.setProperty('--surf-elevated-bg', theme.colors.elevatedBackground);
  s.setProperty('--surf-modal-bg', theme.colors.modalBackground);
  s.setProperty('--surf-dropdown-bg', theme.colors.dropdownBackground);
  s.setProperty('--surf-input-bg', theme.components.inputBg || theme.colors.inputBackground);
  s.setProperty('--surf-border', theme.components.cardBorder || theme.colors.borderColor);
  s.setProperty('--surf-divider', theme.colors.dividerColor);
  s.setProperty('--surf-hover', theme.colors.hoverColor);
  s.setProperty('--surf-selected', theme.colors.selectedColor);
  s.setProperty('--surf-active', theme.colors.activeColor);
  s.setProperty('--surf-focus-ring', theme.colors.focusRingColor);
  s.setProperty('--surf-text-primary', theme.colors.textPrimary);
  s.setProperty('--surf-text-secondary', theme.colors.textSecondary);
  s.setProperty('--surf-text-muted', theme.colors.textMuted);
  s.setProperty('--surf-text-disabled', theme.colors.textDisabled);
  s.setProperty('--surf-link', theme.colors.linkColor);

  // Status colors
  s.setProperty('--surf-status-operational', theme.status.operational);
  s.setProperty('--surf-status-online', theme.status.online);
  s.setProperty('--surf-status-offline', theme.status.offline);
  s.setProperty('--surf-status-degraded', theme.status.degraded);
  s.setProperty('--surf-status-warning', theme.status.warning);
  s.setProperty('--surf-status-critical', theme.status.critical);
  s.setProperty('--surf-status-maintenance', theme.status.maintenance);
  s.setProperty('--surf-status-unknown', theme.status.unknown);
  s.setProperty('--surf-status-pending', theme.status.pending);
  s.setProperty('--surf-status-success', theme.status.success);
  s.setProperty('--surf-status-error', theme.status.error);

  // Typography
  s.setProperty('--surf-font-app', theme.typography.appFont);
  s.setProperty('--surf-font-heading', theme.typography.headingFont);
  s.setProperty('--surf-font-body', theme.typography.bodyFont);
  s.setProperty('--surf-font-mono', theme.typography.monoFont);
  s.setProperty('--surf-font-size-base', `${theme.typography.baseSizePx}px`);
  s.setProperty('--surf-font-size-small', `${theme.typography.smallSizePx}px`);
  s.setProperty('--surf-font-size-button', `${theme.typography.buttonSizePx}px`);
  s.setProperty('--surf-heading-weight', String(theme.typography.headingWeight));
  s.setProperty('--surf-body-weight', String(theme.typography.bodyWeight));
  s.setProperty('--surf-line-height', String(theme.typography.lineHeight));
  s.setProperty('--surf-letter-spacing', `${theme.typography.letterSpacingEm}em`);
  s.setProperty('--surf-heading-transform', theme.typography.headingTransform);

  // Layout & Components
  s.setProperty('--surf-sidebar-width', `${theme.layout.sidebarCompact ? 64 : theme.layout.sidebarWidthPx}px`);
  s.setProperty('--surf-toolbar-height', `${theme.layout.toolbarHeightPx}px`);
  s.setProperty('--surf-page-padding', `${theme.layout.pagePaddingPx}px`);
  s.setProperty('--surf-card-padding', `${theme.layout.cardPaddingPx}px`);
  s.setProperty('--surf-card-gap', `${theme.layout.cardSpacingPx}px`);
  s.setProperty('--surf-radius', `${theme.layout.borderRadiusPx}px`);
  s.setProperty('--surf-button-radius', `${theme.layout.buttonRadiusPx}px`);
  s.setProperty('--surf-input-radius', `${theme.layout.inputRadiusPx}px`);
  s.setProperty('--surf-modal-radius', `${theme.layout.modalRadiusPx}px`);
  s.setProperty('--surf-badge-radius', `${theme.components.badgeRadiusPx}px`);
  s.setProperty('--surf-border-width', `${theme.layout.borderWidthPx}px`);
  s.setProperty('--surf-button-bg', theme.components.buttonBg);
  s.setProperty('--surf-button-text', theme.components.buttonText);
  s.setProperty('--surf-button-hover-bg', theme.components.buttonHoverBg);
  s.setProperty('--surf-table-header-bg', theme.components.tableHeaderBg);
  s.setProperty('--surf-table-row-hover', theme.components.tableRowHoverBg);
  s.setProperty('--surf-progress-track', theme.components.progressTrackBg);

  // Effects & Background
  s.setProperty('--surf-transition-ms', theme.effects.transitionsEnabled ? `${theme.effects.transitionMs}ms` : '0ms');
  s.setProperty('--surf-blur', theme.effects.blurEnabled ? `${theme.effects.blurPx}px` : '0px');
  s.setProperty('--surf-bg-paint', buildBackgroundStyle(theme));

  // Custom CSS injection (strictly validated & disabled in safe mode)
  const styleId = 'surf-custom-css-layer';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!safeModeNoCss && theme.customCss.enabled && theme.customCss.css.trim()) {
    const check = validateCustomCss(theme.customCss.css);
    if (check.valid) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = theme.customCss.css;
    }
  } else if (styleEl) {
    styleEl.textContent = '';
  }
}
