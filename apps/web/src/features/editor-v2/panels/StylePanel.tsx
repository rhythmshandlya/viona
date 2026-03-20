'use client';

import React, { useState, useCallback } from 'react';
import { RotateCcw, Wand2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  useCaptionPreset,
  useSelectedIds,
  useCaptionActions,
  useTimelineActions,
  useVideoUrl,
  useCurrentTimeMs,
} from '../store/use-editor-store';
import {
  CaptionDisplayMode,
  CaptionStyle,
} from '../store/types';
import {
  SUBTITLE_PRESETS,
  PRESET_ORDER,
  type SubtitlePreset,
} from '@/lib/subtitle-presets';
import { loadFont, findFont, getFontsByCategory, type FontEntry } from '@/lib/font-registry';
import { effectsToCss } from '@/lib/effects-utils';
import {
  QUICK_COLOR_PALETTES,
  sampleVideoFrame,
  generateCaptionColors,
  type ColorPalette,
} from '@/lib/color-utils';

// ============================================
// Mode abbreviation helper
// ============================================

const MODE_ABBREV: Record<CaptionDisplayMode, string> = {
  'word-by-word': 'W',
  'phrase': 'P',
  'karaoke': 'K',
};

// ============================================
// StylePanel
// ============================================

export function StylePanel() {
  const style = useCaptionPreset();
  const selectedIds = useSelectedIds();
  const { updateCaptionPreset } = useCaptionActions();
  const { clearSelection, selectAll } = useTimelineActions();

  const videoUrl = useVideoUrl();
  const currentTimeMs = useCurrentTimeMs();

  const [autoLoading, setAutoLoading] = useState(false);
  const [autoPalettes, setAutoPalettes] = useState<ColorPalette[] | null>(null);

  // All caption style updates go through the single preset action
  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      updateCaptionPreset(updates);
    },
    [updateCaptionPreset]
  );

  // Customize style - keeps presetId so the template stays selected
  const customizeStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      updateStyle(updates);
    },
    [updateStyle]
  );

  const handleAutoDetect = useCallback(async () => {
    if (!videoUrl) return;
    setAutoLoading(true);
    try {
      const avgColor = await sampleVideoFrame(videoUrl, currentTimeMs, 'bottom');
      const palettes = generateCaptionColors(avgColor);
      setAutoPalettes(palettes);
      if (palettes.length > 0) {
        updateStyle({ color: palettes[0].color, activeColor: palettes[0].activeColor });
      }
    } catch {
      // Silently fail — user can still pick manually
    } finally {
      setAutoLoading(false);
    }
  }, [videoUrl, currentTimeMs, updateStyle]);

  const isPaletteActive = (palette: ColorPalette) =>
    style?.color === palette.color && style?.activeColor === palette.activeColor;

  if (!style) {
    return (
      <div className="p-4 text-[var(--editor-text-secondary)] text-sm">
        No captions to style. Add a video with transcription first.
      </div>
    );
  }

  const applyPreset = (preset: SubtitlePreset) => {
    const fontEntry = findFont(preset.fontFamily.split(',')[0].trim());
    if (fontEntry) loadFont(fontEntry);

    updateCaptionPreset({
      presetId: preset.id,
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      letterSpacing: preset.letterSpacing ?? 0,
      textTransform: preset.textTransform ?? 'none',
      opacity: preset.opacity ?? 1,
      lineHeight: preset.lineHeight ?? 1.4,
      color: preset.color,
      activeColor: preset.activeColor,
      backgroundColor: preset.backgroundColor,
      activeBackgroundColor: preset.activeBackgroundColor,
      stroke: preset.stroke ?? null,
      textShadow: preset.textShadow,
      textStroke: preset.textStroke,
      effects: preset.effects ?? { shadow: null, shadowSecondary: null, glow: null },
      backgroundPadding: preset.backgroundPadding,
      backgroundRadius: preset.backgroundRadius,
      animation: preset.animation,
      displayMode: preset.supportedModes[0], // Default mode for the preset
      wordsPerPhrase: preset.wordsPerPhrase ?? 5,
    });
  };

  const resetToPreset = () => {
    if (style.presetId && SUBTITLE_PRESETS[style.presetId]) {
      applyPreset(SUBTITLE_PRESETS[style.presetId]);
    }
  };

  const filteredPresets = PRESET_ORDER.map((id) => SUBTITLE_PRESETS[id]);

  // Determine if current style matches a preset (only by presetId, not fuzzy matching)
  const isPresetSelected = (preset: SubtitlePreset) =>
    style.presetId === preset.id;

  // Display mode options filtered by active preset's supportedModes
  const activePreset = style.presetId ? SUBTITLE_PRESETS[style.presetId] : null;
  const availableModes = activePreset?.supportedModes ?? ['word-by-word', 'phrase', 'karaoke'];

  return (
    <div className="flex flex-col h-full">
      {/* Editing indicator and selection controls */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0">
        <div className={`text-xs px-2 py-1 rounded ${
          selectedIds.length > 0
            ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]'
            : 'bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)]'
        }`}>
          {selectedIds.length > 0
            ? `Editing ${selectedIds.length} selected`
            : 'Editing all captions'}
        </div>
        <div className="flex gap-1">
          {selectedIds.length > 0 ? (
            <button
              onClick={clearSelection}
              className="text-xs px-2 py-1 rounded bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] transition-colors"
            >
              Clear
            </button>
          ) : (
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 rounded bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] transition-colors"
            >
              Select All
            </button>
          )}
        </div>
      </div>

      {/* Single scrollable panel */}
      <div className="flex-1 overflow-y-auto">
        {/* ===== 1. Preset Picker Grid ===== */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {filteredPresets.map((preset) => {
              const selected = isPresetSelected(preset);
              const previewEffects = effectsToCss(preset.effects);
              const hasBackground = preset.backgroundColor !== 'transparent' && preset.backgroundColor;
              const activeHasBackground = preset.activeBackgroundColor !== 'transparent' && preset.activeBackgroundColor;
              const scaledStroke = preset.stroke
                ? `${Math.max(0.5, preset.stroke.width * (14 / preset.fontSize))}px ${preset.stroke.color}`
                : undefined;

              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`rounded-lg border transition-all overflow-hidden ${
                    selected
                      ? 'border-[var(--editor-accent)] ring-1 ring-[var(--editor-accent)]'
                      : 'border-[var(--editor-border-subtle)] hover:border-[var(--editor-text-secondary)]/30'
                  }`}
                >
                  {/* Visual Preview */}
                  <div className="relative h-16 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center overflow-hidden">
                    <span
                      style={{
                        fontFamily: preset.fontFamily,
                        fontWeight: preset.fontWeight,
                        fontSize: '16px',
                        letterSpacing: preset.letterSpacing ? `${preset.letterSpacing * 0.3}px` : undefined,
                        textTransform: (preset.textTransform || 'none') as React.CSSProperties['textTransform'],
                        color: preset.activeColor,
                        opacity: preset.opacity ?? 1,
                        WebkitTextStroke: scaledStroke,
                        paintOrder: preset.stroke ? 'stroke fill' : undefined,
                        ...previewEffects,
                        ...(activeHasBackground ? {
                          backgroundColor: preset.activeBackgroundColor,
                          padding: preset.backgroundPadding
                            ? `${Math.round(preset.backgroundPadding.y * 0.5)}px ${Math.round(preset.backgroundPadding.x * 0.5)}px`
                            : '2px 6px',
                          borderRadius: preset.backgroundRadius ? `${Math.round(preset.backgroundRadius * 0.5)}px` : undefined,
                        } : hasBackground ? {
                          backgroundColor: preset.backgroundColor,
                          padding: preset.backgroundPadding
                            ? `${Math.round(preset.backgroundPadding.y * 0.5)}px ${Math.round(preset.backgroundPadding.x * 0.5)}px`
                            : '2px 6px',
                          borderRadius: preset.backgroundRadius ? `${Math.round(preset.backgroundRadius * 0.5)}px` : undefined,
                        } : {}),
                      }}
                    >
                      Hello
                    </span>
                  </div>
                  {/* Preset Name + Supported Modes */}
                  <div className={`px-2 py-1.5 text-center ${
                    selected ? 'bg-[var(--editor-accent)]/10' : 'bg-[var(--editor-bg-elevated)]'
                  }`}>
                    <div className="text-[10px] text-[var(--editor-text-secondary)] truncate">
                      {preset.name}
                    </div>
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      {preset.supportedModes.map((m, i) => (
                        <span key={m} className="text-[8px] text-[var(--editor-text-secondary)] opacity-50">
                          {i > 0 && <span className="mx-px">&middot;</span>}
                          {MODE_ABBREV[m]}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset to Preset Button */}
        {style.presetId && SUBTITLE_PRESETS[style.presetId] && (
          <div className="px-4 pb-4">
            <button
              onClick={resetToPreset}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm
                         text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]
                         hover:bg-[var(--editor-bg-elevated)] rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to preset
            </button>
          </div>
        )}

        <Divider />

        {/* ===== 2. Display Mode + Words Per Phrase ===== */}
        <div className="px-4 py-3 space-y-3">
          <Section label="Display Mode">
            <SegmentedControl
              options={
                availableModes.map((m) => ({
                  value: m,
                  label: m === 'word-by-word' ? 'Word' : m === 'phrase' ? 'Phrase' : 'Karaoke',
                }))
              }
              value={style.displayMode}
              onChange={(value) => customizeStyle({ displayMode: value as CaptionDisplayMode })}
            />
            {(style.displayMode === 'phrase' || style.displayMode === 'karaoke') && (
              <div className="mt-3">
                <span className="text-[10px] text-[var(--editor-text-secondary)] mb-1 block">Words per phrase</span>
                <SliderRow
                  value={style.wordsPerPhrase ?? 5}
                  min={2}
                  max={10}
                  step={1}
                  onChange={(v) => customizeStyle({ wordsPerPhrase: v })}
                />
              </div>
            )}
          </Section>
        </div>

        <Divider />

        {/* ===== 3. Typography Controls ===== */}
        <div className="px-4 py-3 space-y-5">
          {/* Font Family */}
          <Section label="Font Family">
            <FontFamilyDropdown
              value={style.fontFamily}
              onChange={(fontFamily) => customizeStyle({ fontFamily })}
            />
          </Section>

          {/* Font Size */}
          <Section label="Font Size">
            <SliderRow
              value={style.fontSize}
              min={24}
              max={200}
              step={2}
              unit="px"
              onChange={(fontSize) => customizeStyle({ fontSize })}
            />
          </Section>

          {/* Font Weight */}
          <Section label="Font Weight">
            <SliderRow
              value={style.fontWeight}
              min={400}
              max={900}
              step={100}
              onChange={(fontWeight) => customizeStyle({ fontWeight })}
            />
          </Section>

          {/* Letter Spacing */}
          <Section label="Letter Spacing">
            <SliderRow
              value={style.letterSpacing ?? 0}
              min={0}
              max={10}
              step={0.5}
              unit="px"
              onChange={(letterSpacing) => customizeStyle({ letterSpacing })}
            />
          </Section>

          {/* Line Height */}
          <Section label="Line Height">
            <SliderRow
              value={style.lineHeight ?? 1.4}
              min={1.0}
              max={2.5}
              step={0.1}
              onChange={(lineHeight) => customizeStyle({ lineHeight })}
            />
          </Section>

          {/* Text Transform */}
          <Section label="Text Transform">
            <SegmentedControl
              options={[
                { value: 'none', label: 'Aa' },
                { value: 'uppercase', label: 'AA' },
                { value: 'lowercase', label: 'aa' },
              ]}
              value={style.textTransform ?? 'none'}
              onChange={(value) =>
                customizeStyle({ textTransform: value as 'none' | 'uppercase' | 'lowercase' })
              }
            />
          </Section>
        </div>

        <Divider />

        {/* ===== 4. Colors ===== */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-normal text-[var(--editor-text-secondary)] uppercase tracking-wide">
              Colors
            </label>
            {videoUrl && (
              <button
                onClick={handleAutoDetect}
                disabled={autoLoading}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md
                           bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]
                           hover:bg-[var(--editor-accent)]/20 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-3 h-3" />
                {autoLoading ? 'Sampling...' : 'Auto'}
              </button>
            )}
          </div>

          {/* Quick palette swatches */}
          <div className="flex flex-wrap gap-2">
            {QUICK_COLOR_PALETTES.map((palette) => {
              const active = isPaletteActive(palette);
              return (
                <button
                  key={palette.name}
                  title={palette.name}
                  onClick={() => updateStyle({ color: palette.color, activeColor: palette.activeColor })}
                  className={`w-7 h-7 rounded-full border-2 transition-all shrink-0 ${
                    active
                      ? 'border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent)]/40 scale-110'
                      : 'border-[var(--editor-border-subtle)] hover:border-[var(--editor-text-secondary)] hover:scale-105'
                  }`}
                  style={{ backgroundColor: palette.activeColor }}
                />
              );
            })}
          </div>

          {/* Auto-generated palettes */}
          {autoPalettes && autoPalettes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-[var(--editor-text-secondary)]">Suggested for this frame</span>
              <div className="flex gap-2">
                {autoPalettes.map((palette, i) => {
                  const active = isPaletteActive(palette);
                  return (
                    <button
                      key={i}
                      title={palette.name}
                      onClick={() => updateStyle({ color: palette.color, activeColor: palette.activeColor })}
                      className={`w-7 h-7 rounded-full border-2 transition-all shrink-0 ${
                        active
                          ? 'border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent)]/40 scale-110'
                          : 'border-[var(--editor-border-subtle)] hover:border-[var(--editor-text-secondary)] hover:scale-105'
                      }`}
                      style={{ backgroundColor: palette.activeColor }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <InlineDivider />

          {/* Color pickers */}
          <ColorRow
            label="Text Color"
            value={style.color}
            onChange={(color) => customizeStyle({ color })}
          />
          <ColorRow
            label="Active Color"
            value={style.activeColor}
            onChange={(activeColor) => customizeStyle({ activeColor })}
          />
          <ColorRow
            label="Background"
            value={style.backgroundColor}
            onChange={(backgroundColor) => customizeStyle({ backgroundColor })}
          />
          <ColorRow
            label="Active Background"
            value={style.activeBackgroundColor}
            onChange={(activeBackgroundColor) => customizeStyle({ activeBackgroundColor })}
          />
        </div>

        <Divider />

        {/* ===== 5. Background (Padding + Radius) ===== */}
        <div className="px-4 py-3 space-y-5">
          <Section label="Background Padding">
            <SliderRow
              value={style.backgroundPadding?.x ?? 4}
              min={0}
              max={24}
              step={1}
              unit="px"
              onChange={(padding) =>
                customizeStyle({ backgroundPadding: { x: padding, y: Math.round(padding / 2) } })
              }
            />
          </Section>

          <Section label="Background Radius">
            <SliderRow
              value={style.backgroundRadius ?? 0}
              min={0}
              max={24}
              step={1}
              unit="px"
              onChange={(backgroundRadius) => customizeStyle({ backgroundRadius })}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Shared Sub-Components
// ============================================

function Section({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <label className="text-xs font-normal text-[var(--editor-text-secondary)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--editor-border-subtle)] mx-4" />;
}

/** Divider for use inside padded containers (no horizontal margin) */
function InlineDivider() {
  return <div className="border-t border-[var(--editor-border-subtle)]" />;
}

interface SegmentedControlOption {
  value: string;
  label: string;
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex p-0.5 bg-[var(--editor-bg-elevated)] rounded-md">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 px-3 py-1.5 text-xs font-normal rounded transition-all ${
            value === option.value
              ? 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)] shadow-sm'
              : 'text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SliderRow({
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="text-xs text-[var(--editor-text-secondary)] w-12 text-right tabular-nums">
        {value}
        {unit ?? ''}
      </span>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const isTransparent = value === 'transparent' || !value;

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <input
          type="color"
          value={isTransparent ? '#000000' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md border border-[var(--editor-border-subtle)]
                     cursor-pointer bg-transparent appearance-none overflow-hidden"
          style={{ backgroundColor: isTransparent ? 'transparent' : value }}
        />
        {isTransparent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-5 h-0.5 bg-red-500 rotate-45" />
          </div>
        )}
      </div>
      <span className="text-xs text-[var(--editor-text-secondary)] flex-1">{label}</span>
      <span className="text-xs text-[var(--editor-text-secondary)] tabular-nums opacity-60">
        {isTransparent ? 'none' : value}
      </span>
    </div>
  );
}

const FONT_CATEGORY_LABELS: Record<FontEntry['category'], string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'display': 'Display',
  'handwriting': 'Handwriting',
  'mono': 'Monospace',
};

const FONT_CATEGORY_ORDER: FontEntry['category'][] = ['sans-serif', 'serif', 'display', 'handwriting', 'mono'];

function FontFamilyDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (fontFamily: string) => void;
}) {
  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedFamily = e.target.value;
    const entry = findFont(selectedFamily);
    if (entry) {
      await loadFont(entry);
      const fallback =
        entry.category === 'serif'
          ? 'serif'
          : entry.category === 'mono'
            ? 'monospace'
            : entry.category === 'handwriting'
              ? 'cursive'
              : 'system-ui, sans-serif';
      onChange(`${entry.family}, ${fallback}`);
    }
  };

  const primaryFamily = value.split(',')[0].trim();
  const fontsByCategory = getFontsByCategory();

  return (
    <select
      value={primaryFamily}
      onChange={handleChange}
      className="w-full px-3 py-2 text-xs rounded-md
                 bg-[var(--editor-bg-elevated)] text-[var(--editor-text-primary)]
                 border border-[var(--editor-border-subtle)]
                 focus:outline-none focus:border-[var(--editor-accent)]
                 cursor-pointer appearance-none"
      style={{ fontFamily: value }}
    >
      {FONT_CATEGORY_ORDER.map((cat) => (
        <optgroup key={cat} label={FONT_CATEGORY_LABELS[cat]}>
          {fontsByCategory[cat].map((font) => (
            <option key={font.family} value={font.family}>
              {font.family}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
