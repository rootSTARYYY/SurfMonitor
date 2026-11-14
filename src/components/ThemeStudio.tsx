import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Paintbrush,
  Palette,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import {
  auditThemeContrast,
  BUILT_IN_THEMES,
  cloneThemeAsCustom,
  createBlankCustomTheme,
  exportThemeToJson,
  hslToRgb,
  isValidColorString,
  parseColorToRgba,
  rgbaToHex,
  rgbToHsl,
  SAFE_FONT_STACKS,
  SurfTheme,
  validateAndMigrateTheme,
  validateCustomCss,
} from '@/theme/themeEngine';

type StudioSection =
  | 'colors'
  | 'status'
  | 'typography'
  | 'layout'
  | 'components'
  | 'backgrounds'
  | 'effects'
  | 'css';

interface ThemeStudioProps {
  activeTheme: SurfTheme;
  draftTheme: SurfTheme;
  customThemes: SurfTheme[];
  defaultThemeId: string | null;
  safeMode: boolean;
  onDraftChange: (next: SurfTheme) => void;
  onApplyAndSave: (theme: SurfTheme, makeDefault?: boolean) => Promise<void>;
  onSelectTheme: (theme: SurfTheme) => Promise<void>;
  onDeleteCustomTheme: (id: string) => Promise<void>;
  onCancelDraft: () => void;
}

const ColorControl: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => {
  const [fmt, setFmt] = useState<'hex' | 'rgb' | 'hsl'>('hex');
  const rgba = parseColorToRgba(value);
  const hex = rgbaToHex(rgba.r, rgba.g, rgba.b);
  const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);

  const displayVal =
    fmt === 'hex'
      ? value
      : fmt === 'rgb'
        ? rgba.a < 1
          ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a.toFixed(2)})`
          : `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`
        : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  return (
    <div className="rounded border border-white/[0.08] bg-[#101114] p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] text-zinc-300">{label}</span>
        <div className="flex items-center gap-0.5 font-mono text-[9px]">
          {(['hex', 'rgb', 'hsl'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFmt(m)}
              className={`rounded px-1 py-0.5 uppercase ${
                fmt === m ? 'bg-white/[0.12] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-white/[0.12] bg-transparent p-0"
        />
        <input
          type="text"
          aria-label={`${label} ${fmt.toUpperCase()} value`}
          value={displayVal}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (isValidColorString(raw)) {
              onChange(raw);
            } else if (fmt === 'hsl') {
              const m = raw.match(/(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/);
              if (m) {
                const rgb = hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]));
                onChange(rgbaToHex(rgb.r, rgb.g, rgb.b));
              }
            } else {
              onChange(raw);
            }
          }}
          className="min-w-0 flex-1 rounded border border-white/[0.1] bg-[#09090b] px-2 py-1 font-mono text-[11px] text-zinc-100 focus:outline-none"
        />
      </div>
    </div>
  );
};

export const ThemeStudio: React.FC<ThemeStudioProps> = ({
  activeTheme,
  draftTheme,
  customThemes,
  defaultThemeId,
  safeMode,
  onDraftChange,
  onApplyAndSave,
  onSelectTheme,
  onDeleteCustomTheme,
  onCancelDraft,
}) => {
  const [section, setSection] = useState<StudioSection>('colors');
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const contrastWarnings = useMemo(() => auditThemeContrast(draftTheme), [draftTheme]);
  const cssValidation = useMemo(
    () => validateCustomCss(draftTheme.customCss.css),
    [draftTheme.customCss.css]
  );

  const handleSaveTheme = async (makeDefault = false) => {
    let target = draftTheme;
    if (target.builtIn) {
      target = cloneThemeAsCustom(target, `${target.name} Custom`);
      onDraftChange(target);
    }
    await onApplyAndSave(target, makeDefault);
    setStatusMsg({ ok: true, text: `Saved & applied "${target.name}".` });
  };

  const handleCreateBlank = async () => {
    const t = createBlankCustomTheme(newName.trim() || `Custom Theme ${customThemes.length + 1}`);
    setNewName('');
    onDraftChange(t);
    await onApplyAndSave(t);
    setStatusMsg({ ok: true, text: `Created blank theme "${t.name}".` });
  };

  const handleDuplicate = async (src: SurfTheme) => {
    const copy = cloneThemeAsCustom(src, `${src.name} Copy`);
    onDraftChange(copy);
    await onApplyAndSave(copy);
    setStatusMsg({ ok: true, text: `Duplicated as "${copy.name}".` });
  };

  const handleExportTheme = async () => {
    const json = exportThemeToJson(draftTheme);
    const slug = draftTheme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const saved = await window.surfMonitorAPI?.exportThemeFile(`${slug}.surf-theme.json`, json);
    if (saved) setStatusMsg({ ok: true, text: `Exported theme to ${saved}` });
  };

  const handleImportTheme = async () => {
    try {
      const raw = await window.surfMonitorAPI?.importThemeFile('json');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const validated = validateAndMigrateTheme(parsed);
      onDraftChange(validated);
      await onApplyAndSave(validated);
      setStatusMsg({ ok: true, text: `Imported theme "${validated.name}".` });
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Invalid theme file.',
      });
    }
  };

  const handleResetSection = () => {
    const base = BUILT_IN_THEMES.find((b) => b.id === activeTheme.id) ?? BUILT_IN_THEMES[0];
    const next = { ...draftTheme };
    if (section === 'colors') next.colors = { ...base.colors };
    if (section === 'status') next.status = { ...base.status };
    if (section === 'typography') next.typography = { ...base.typography };
    if (section === 'layout') next.layout = { ...base.layout };
    if (section === 'components') next.components = { ...base.components };
    if (section === 'backgrounds') next.background = { ...base.background };
    if (section === 'effects') next.effects = { ...base.effects };
    if (section === 'css') next.customCss = { ...base.customCss };
    onDraftChange(next);
    setStatusMsg({ ok: true, text: `Reset ${section} section to defaults.` });
  };

  const STUDIO_TABS: Array<{ id: StudioSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'status', label: 'Status Colors', icon: Sparkles },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'layout', label: 'Layout', icon: Layers },
    { id: 'components', label: 'Components', icon: Sliders },
    { id: 'backgrounds', label: 'Backgrounds', icon: ImageIcon },
    { id: 'effects', label: 'Effects', icon: Paintbrush },
    { id: 'css', label: 'Advanced CSS', icon: FileCode2 },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Appearance &amp; Theme Studio
          </h2>
          <p className="font-mono text-[11px] text-zinc-500">
            Active: <span className="text-emerald-400">{activeTheme.name}</span>
            {safeMode ? ' · SAFE MODE (Custom CSS disabled)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleImportTheme()}
            className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 hover:bg-white/[0.05]"
          >
            <Upload className="h-3.5 w-3.5" />
            Import JSON
          </button>
          <button
            type="button"
            onClick={() => void handleExportTheme()}
            className="flex items-center gap-1 rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 hover:bg-white/[0.05]"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`rounded border px-3 py-2 font-mono text-xs ${
            statusMsg.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Built-in Presets (Starting Points) */}
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Built-in Presets (Immutable Starting Points)
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {BUILT_IN_THEMES.map((preset) => {
            const isActive = activeTheme.id === preset.id;
            return (
              <div
                key={preset.id}
                className={`rounded border p-3 ${
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-white/[0.08] bg-[#101114]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">{preset.name}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="h-3 w-3 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.colors.appBackground }}
                    />
                    <span
                      className="h-3 w-3 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.colors.primary }}
                    />
                  </div>
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{preset.description}</p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onDraftChange(preset);
                      void onSelectTheme(preset);
                    }}
                    className="rounded border border-white/[0.12] bg-[#09090b] px-2 py-1 font-mono text-[10px] text-zinc-200 hover:bg-white/[0.05]"
                  >
                    {isActive ? 'Active' : 'Use Preset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDuplicate(preset)}
                    className="flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 font-mono text-[10px] text-zinc-400 hover:text-zinc-200"
                  >
                    <Copy className="h-3 w-3" />
                    Customize
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* My Custom Themes (Unlimited) */}
      <div className="space-y-2 rounded border border-white/[0.08] bg-[#101114] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            My Custom Themes ({customThemes.length})
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New theme name..."
              className="rounded border border-white/[0.1] bg-[#09090b] px-2.5 py-1 font-mono text-xs text-zinc-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCreateBlank()}
              className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 font-mono text-xs font-medium text-white hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" />
              New Blank Theme
            </button>
          </div>
        </div>

        {customThemes.length === 0 ? (
          <p className="py-2 font-mono text-[11px] text-zinc-500">
            No custom themes saved yet. Create a blank theme or click Customize on any preset.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {customThemes.map((ct) => {
              const isActive = activeTheme.id === ct.id;
              const isDef = defaultThemeId === ct.id;
              return (
                <div
                  key={ct.id}
                  className={`flex items-center justify-between rounded border px-3 py-2 ${
                    isActive
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/[0.08] bg-[#09090b]'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    {renamingId === ct.id ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!renameText.trim()) return;
                          const updated = { ...ct, name: renameText.trim() };
                          await onApplyAndSave(updated, isDef);
                          if (draftTheme.id === ct.id) onDraftChange(updated);
                          setRenamingId(null);
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="text"
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          autoFocus
                          className="w-full rounded border border-white/[0.15] bg-[#101114] px-2 py-0.5 text-xs text-zinc-100"
                        />
                        <button type="submit" className="text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-zinc-100">
                          {ct.name}
                        </span>
                        {isDef && (
                          <span className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[9px] text-zinc-400">
                            DEFAULT
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        onDraftChange(ct);
                        void onSelectTheme(ct);
                      }}
                      className="rounded border border-white/[0.1] px-2 py-1 text-zinc-200 hover:bg-white/[0.05]"
                    >
                      {isActive ? 'Editing' : 'Apply'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(ct.id);
                        setRenameText(ct.name);
                      }}
                      className="rounded border border-white/[0.1] px-1.5 py-1 text-zinc-400 hover:text-zinc-200"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDuplicate(ct)}
                      title="Duplicate"
                      className="rounded p-1 text-zinc-400 hover:text-zinc-200"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteCustomTheme(ct.id)}
                      title="Delete custom theme"
                      className="rounded p-1 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contrast Warnings */}
      {contrastWarnings.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Readability Contrast Warning
          </div>
          <ul className="mt-1 list-disc pl-5 text-[10px] text-amber-200/80">
            {contrastWarnings.map((w) => (
              <li key={w.pair}>
                {w.pair}: contrast ratio {w.ratio}:1 (recommended &ge; 4.5:1)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live Preview Strip */}
      <div
        className="rounded border p-3.5"
        style={{
          backgroundColor: draftTheme.colors.cardBackground,
          borderColor: draftTheme.colors.borderColor,
          borderRadius: `${draftTheme.layout.borderRadiusPx}px`,
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Live Component Preview
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span
              className="px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: `${draftTheme.status.operational}22`,
                color: draftTheme.status.operational,
                borderRadius: `${draftTheme.components.badgeRadiusPx}px`,
              }}
            >
              OPERATIONAL
            </span>
            <span
              className="px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: `${draftTheme.status.degraded}22`,
                color: draftTheme.status.degraded,
                borderRadius: `${draftTheme.components.badgeRadiusPx}px`,
              }}
            >
              DEGRADED
            </span>
            <span
              className="px-2 py-0.5 font-semibold"
              style={{
                backgroundColor: `${draftTheme.status.offline}22`,
                color: draftTheme.status.offline,
                borderRadius: `${draftTheme.components.badgeRadiusPx}px`,
              }}
            >
              OFFLINE
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            style={{
              backgroundColor: draftTheme.components.buttonBg,
              color: draftTheme.components.buttonText,
              borderRadius: `${draftTheme.layout.buttonRadiusPx}px`,
              padding: `${draftTheme.components.buttonPaddingY}px ${draftTheme.components.buttonPaddingX}px`,
              fontSize: `${draftTheme.typography.buttonSizePx}px`,
            }}
            className="font-semibold"
          >
            Primary Action
          </button>
          <input
            type="text"
            readOnly
            value="https://api.example.com/health"
            style={{
              backgroundColor: draftTheme.components.inputBg,
              borderColor: draftTheme.components.inputBorder,
              borderRadius: `${draftTheme.layout.inputRadiusPx}px`,
              color: draftTheme.colors.textPrimary,
            }}
            className="border px-2.5 py-1 font-mono text-xs"
          />
          <div className="flex-1 min-w-[140px]">
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: draftTheme.components.progressTrackBg }}
            >
              <div
                className="h-full w-3/4 rounded-full"
                style={{ backgroundColor: draftTheme.colors.primary }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Studio Section Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/[0.08] pb-2">
        {STUDIO_TABS.map((t) => {
          const Icon = t.icon;
          const active = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                active
                  ? 'bg-white/[0.09] text-zinc-100'
                  : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section Editors */}
      {section === 'colors' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(draftTheme.colors) as Array<keyof SurfTheme['colors']>).map((key) => (
            <ColorControl
              key={key}
              label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              value={draftTheme.colors[key]}
              onChange={(val) =>
                onDraftChange({
                  ...draftTheme,
                  colors: { ...draftTheme.colors, [key]: val },
                })
              }
            />
          ))}
        </div>
      )}

      {section === 'status' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(draftTheme.status) as Array<keyof SurfTheme['status']>).map((key) => (
            <ColorControl
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={draftTheme.status[key]}
              onChange={(val) =>
                onDraftChange({
                  ...draftTheme,
                  status: { ...draftTheme.status, [key]: val },
                })
              }
            />
          ))}
        </div>
      )}

      {section === 'typography' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Application / Body Font
            </label>
            <select
              value={draftTheme.typography.appFont}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  typography: {
                    ...draftTheme.typography,
                    appFont: e.target.value,
                    bodyFont: e.target.value,
                  },
                })
              }
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100"
            >
              {SAFE_FONT_STACKS.sans.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Heading Font
            </label>
            <select
              value={draftTheme.typography.headingFont}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  typography: { ...draftTheme.typography, headingFont: e.target.value },
                })
              }
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100"
            >
              {SAFE_FONT_STACKS.sans.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Monospace / Telemetry Font
            </label>
            <select
              value={draftTheme.typography.monoFont}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  typography: { ...draftTheme.typography, monoFont: e.target.value },
                })
              }
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100"
            >
              {SAFE_FONT_STACKS.mono.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Heading Transform
            </label>
            <select
              value={draftTheme.typography.headingTransform}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  typography: {
                    ...draftTheme.typography,
                    headingTransform: e.target.value as 'none' | 'uppercase' | 'capitalize',
                  },
                })
              }
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-100"
            >
              <option value="none">None</option>
              <option value="uppercase">Uppercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Base Font Size ({draftTheme.typography.baseSizePx}px)
            </label>
            <input
              type="range"
              min={11}
              max={18}
              value={draftTheme.typography.baseSizePx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  typography: { ...draftTheme.typography, baseSizePx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Line Height ({draftTheme.typography.lineHeight})
            </label>
            <input
              type="range"
              min={1.1}
              max={2.0}
              step={0.05}
              value={draftTheme.typography.lineHeight}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  typography: { ...draftTheme.typography, lineHeight: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
        </div>
      )}

      {section === 'layout' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Sidebar Position
            </label>
            <select
              value={draftTheme.layout.sidebarPosition}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  layout: {
                    ...draftTheme.layout,
                    sidebarPosition: e.target.value as 'left' | 'right',
                  },
                })
              }
              className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Sidebar Width ({draftTheme.layout.sidebarWidthPx}px)
            </label>
            <input
              type="range"
              min={180}
              max={320}
              value={draftTheme.layout.sidebarWidthPx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  layout: { ...draftTheme.layout, sidebarWidthPx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Toolbar Height ({draftTheme.layout.toolbarHeightPx}px)
            </label>
            <input
              type="range"
              min={40}
              max={68}
              value={draftTheme.layout.toolbarHeightPx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  layout: { ...draftTheme.layout, toolbarHeightPx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Page Padding ({draftTheme.layout.pagePaddingPx}px)
            </label>
            <input
              type="range"
              min={8}
              max={36}
              value={draftTheme.layout.pagePaddingPx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  layout: { ...draftTheme.layout, pagePaddingPx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Global Border Radius ({draftTheme.layout.borderRadiusPx}px)
            </label>
            <input
              type="range"
              min={0}
              max={18}
              value={draftTheme.layout.borderRadiusPx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  layout: { ...draftTheme.layout, borderRadiusPx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Button Radius ({draftTheme.layout.buttonRadiusPx}px)
            </label>
            <input
              type="range"
              min={0}
              max={20}
              value={draftTheme.layout.buttonRadiusPx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  layout: { ...draftTheme.layout, buttonRadiusPx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
        </div>
      )}

      {section === 'components' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <ColorControl
            label="Button Background"
            value={draftTheme.components.buttonBg}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, buttonBg: val },
              })
            }
          />
          <ColorControl
            label="Button Text"
            value={draftTheme.components.buttonText}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, buttonText: val },
              })
            }
          />
          <ColorControl
            label="Button Hover Background"
            value={draftTheme.components.buttonHoverBg}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, buttonHoverBg: val },
              })
            }
          />
          <ColorControl
            label="Card Background"
            value={draftTheme.components.cardBg}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, cardBg: val },
              })
            }
          />
          <ColorControl
            label="Card Border"
            value={draftTheme.components.cardBorder}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, cardBorder: val },
              })
            }
          />
          <ColorControl
            label="Input Background"
            value={draftTheme.components.inputBg}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, inputBg: val },
              })
            }
          />
          <ColorControl
            label="Input Border"
            value={draftTheme.components.inputBorder}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, inputBorder: val },
              })
            }
          />
          <ColorControl
            label="Table Header Background"
            value={draftTheme.components.tableHeaderBg}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, tableHeaderBg: val },
              })
            }
          />
          <ColorControl
            label="Progress Track Background"
            value={draftTheme.components.progressTrackBg}
            onChange={(val) =>
              onDraftChange({
                ...draftTheme,
                components: { ...draftTheme.components, progressTrackBg: val },
              })
            }
          />
        </div>
      )}

      {section === 'backgrounds' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Background Mode
              </label>
              <select
                value={draftTheme.background.mode}
                onChange={(e) =>
                  onDraftChange({
                    ...draftTheme,
                    background: {
                      ...draftTheme.background,
                      mode: e.target.value as SurfTheme['background']['mode'],
                    },
                  })
                }
                className="w-full rounded border border-white/[0.1] bg-[#101114] px-2.5 py-1.5 font-mono text-xs text-zinc-100"
              >
                <option value="solid">Solid Color</option>
                <option value="linear">Linear Gradient</option>
                <option value="radial">Radial Gradient</option>
                <option value="image">Local Image + Overlay</option>
              </select>
            </div>
            {(draftTheme.background.mode === 'linear' || draftTheme.background.mode === 'radial') && (
              <>
                <ColorControl
                  label="Gradient Stop 1"
                  value={draftTheme.background.gradientStops[0]?.color ?? '#09090b'}
                  onChange={(val) => {
                    const stops = [...draftTheme.background.gradientStops];
                    stops[0] = { color: val, position: 0 };
                    onDraftChange({
                      ...draftTheme,
                      background: { ...draftTheme.background, gradientStops: stops },
                    });
                  }}
                />
                <ColorControl
                  label="Gradient Stop 2"
                  value={draftTheme.background.gradientStops[1]?.color ?? '#111827'}
                  onChange={(val) => {
                    const stops = [...draftTheme.background.gradientStops];
                    stops[1] = { color: val, position: 100 };
                    onDraftChange({
                      ...draftTheme,
                      background: { ...draftTheme.background, gradientStops: stops },
                    });
                  }}
                />
              </>
            )}
          </div>

          {draftTheme.background.mode === 'linear' && (
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                Gradient Angle ({draftTheme.background.gradientAngleDeg}&deg;)
              </label>
              <input
                type="range"
                min={0}
                max={360}
                value={draftTheme.background.gradientAngleDeg}
                onChange={(e) =>
                  onDraftChange({
                    ...draftTheme,
                    background: {
                      ...draftTheme.background,
                      gradientAngleDeg: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-emerald-500"
              />
            </div>
          )}

          {draftTheme.background.mode === 'image' && (
            <div className="space-y-3 rounded border border-white/[0.08] bg-[#101114] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const dataUrl = await window.surfMonitorAPI?.pickThemeBgImage();
                      if (dataUrl) {
                        onDraftChange({
                          ...draftTheme,
                          background: { ...draftTheme.background, imageDataUrl: dataUrl },
                        });
                      }
                    } catch (err) {
                      setStatusMsg({
                        ok: false,
                        text: err instanceof Error ? err.message : 'Failed to load image.',
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 rounded border border-white/[0.12] bg-[#09090b] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
                  Select Local Image (&lt;2 MB)
                </button>
                {draftTheme.background.imageDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      onDraftChange({
                        ...draftTheme,
                        background: { ...draftTheme.background, imageDataUrl: '' },
                      })
                    }
                    className="font-mono text-xs text-rose-400 hover:underline"
                  >
                    Clear Image
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Image Opacity ({Math.round(draftTheme.background.imageOpacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={draftTheme.background.imageOpacity}
                    onChange={(e) =>
                      onDraftChange({
                        ...draftTheme,
                        background: {
                          ...draftTheme.background,
                          imageOpacity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[11px] text-zinc-400">
                    Contrast Overlay Opacity ({Math.round(draftTheme.background.overlayOpacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.2}
                    max={0.95}
                    step={0.05}
                    value={draftTheme.background.overlayOpacity}
                    onChange={(e) =>
                      onDraftChange({
                        ...draftTheme,
                        background: {
                          ...draftTheme.background,
                          overlayOpacity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'effects' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded border border-white/[0.08] bg-[#101114] p-3 font-mono text-xs text-zinc-200">
            <span>Enable Smooth Transitions</span>
            <input
              type="checkbox"
              checked={draftTheme.effects.transitionsEnabled}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  effects: { ...draftTheme.effects, transitionsEnabled: e.target.checked },
                })
              }
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between rounded border border-white/[0.08] bg-[#101114] p-3 font-mono text-xs text-zinc-200">
            <span>Glass / Backdrop Blur</span>
            <input
              type="checkbox"
              checked={draftTheme.effects.blurEnabled}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  effects: { ...draftTheme.effects, blurEnabled: e.target.checked },
                })
              }
              className="accent-emerald-500"
            />
          </label>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Transition Duration ({draftTheme.effects.transitionMs}ms)
            </label>
            <input
              type="range"
              min={0}
              max={350}
              step={25}
              value={draftTheme.effects.transitionMs}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  effects: { ...draftTheme.effects, transitionMs: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-zinc-400">
              Backdrop Blur ({draftTheme.effects.blurPx}px)
            </label>
            <input
              type="range"
              min={0}
              max={20}
              value={draftTheme.effects.blurPx}
              onChange={(e) =>
                onDraftChange({
                  ...draftTheme,
                  effects: { ...draftTheme.effects, blurPx: Number(e.target.value) },
                })
              }
              className="w-full accent-emerald-500"
            />
          </div>
        </div>
      )}

      {section === 'css' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={draftTheme.customCss.enabled}
                onChange={(e) =>
                  onDraftChange({
                    ...draftTheme,
                    customCss: { ...draftTheme.customCss, enabled: e.target.checked },
                  })
                }
                className="accent-emerald-500"
              />
              Enable Custom CSS Layer
            </label>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <button
                type="button"
                onClick={async () => {
                  const imported = await window.surfMonitorAPI?.importThemeFile('css');
                  if (imported !== null && imported !== undefined) {
                    onDraftChange({
                      ...draftTheme,
                      customCss: { ...draftTheme.customCss, css: imported },
                    });
                  }
                }}
                className="rounded border border-white/[0.1] px-2 py-1 text-zinc-300 hover:bg-white/[0.05]"
              >
                Import .css
              </button>
              <button
                type="button"
                onClick={() =>
                  void window.surfMonitorAPI?.exportThemeFile(
                    'surf-custom.css',
                    draftTheme.customCss.css
                  )
                }
                className="rounded border border-white/[0.1] px-2 py-1 text-zinc-300 hover:bg-white/[0.05]"
              >
                Export .css
              </button>
              <button
                type="button"
                onClick={() =>
                  onDraftChange({
                    ...draftTheme,
                    customCss: { enabled: false, css: '' },
                  })
                }
                className="rounded border border-rose-500/30 px-2 py-1 text-rose-400 hover:bg-rose-500/10"
              >
                Reset CSS
              </button>
            </div>
          </div>

          {!cssValidation.valid && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2.5 font-mono text-[11px] text-rose-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" />
                CSS Validation Error (Custom CSS paused until fixed)
              </div>
              <ul className="mt-1 list-disc pl-5 text-[10px]">
                {cssValidation.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            value={draftTheme.customCss.css}
            onChange={(e) =>
              onDraftChange({
                ...draftTheme,
                customCss: { ...draftTheme.customCss, css: e.target.value },
              })
            }
            rows={8}
            spellCheck={false}
            placeholder={`/* Scoped to .surf-app-shell */\n.surf-app-shell aside { border-right-width: 2px; }`}
            className="w-full rounded border border-white/[0.1] bg-[#060608] p-3 font-mono text-xs text-emerald-300 focus:outline-none"
          />
          <p className="font-mono text-[10px] text-zinc-500">
            External URLs, <code>@import</code>, and <code>expression()</code> are blocked. Launch with <code>--safe-theme</code> to disable custom CSS on startup.
          </p>
        </div>
      )}

      {/* Persistent Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetSection}
            className="flex items-center gap-1 rounded border border-white/[0.1] px-2.5 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Section
          </button>
          <button
            type="button"
            onClick={() => {
              onDraftChange(BUILT_IN_THEMES[0]);
              setStatusMsg({ ok: true, text: 'Reset all changes to Obsidian Dark.' });
            }}
            className="rounded border border-white/[0.1] px-2.5 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Reset All Changes
          </button>
          <button
            type="button"
            onClick={onCancelDraft}
            className="rounded border border-white/[0.1] px-2.5 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Cancel Changes
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveTheme(true)}
            className="rounded border border-white/[0.12] bg-[#101114] px-3 py-1.5 font-mono text-xs text-zinc-200 hover:bg-white/[0.05]"
          >
            Save &amp; Set Default
          </button>
          <button
            type="button"
            onClick={() => void handleSaveTheme(false)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 font-mono text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <Save className="h-3.5 w-3.5" />
            Save Theme
          </button>
        </div>
      </div>
    </div>
  );
};
