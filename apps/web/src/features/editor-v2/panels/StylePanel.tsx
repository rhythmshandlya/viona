'use client';

import React, { useState, useCallback } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  useFirstCaptionStyle,
  useApplyStyleToAll,
  useSelectedIds,
  useEditorActions,
} from '../store/use-editor-store';
import {
  CaptionDisplayMode,
  CaptionStyle,
} from '../store/types';
import {
  SUBTITLE_PRESETS,
  PRESET_CATEGORIES,
  getPresetsByCategory,
  type PresetCategory,
  type SubtitlePreset,
} from '@/lib/subtitle-presets';
import { FONT_REGISTRY, loadFont, findFont } from '@/lib/font-registry';

// ============================================
// Text shadow presets
// ============================================

const TEXT_SHADOW_OPTIONS: { label: string; value: string | undefined }[] = [
  { label: 'None', value: undefined },
  { label: 'Soft', value: '1px 1px 3px rgba(0, 0, 0, 0.6)' },
  { label: 'Hard', value: '2px 2px 0px rgba(0, 0, 0, 0.9)' },
];

function getTextShadowLabel(value: string | undefined): string {
  if (!value) return 'None';
  if (value.includes('0.6') || value.includes('3px')) return 'Soft';
  if (value.includes('0.9') || value.includes('0px')) return 'Hard';
  // For preset shadows that don't match exactly, show as "Custom"
  return 'Custom';
}

// ============================================
// StylePanel
// ============================================

export function StylePanel() {
  const style = useFirstCaptionStyle();
  const applyToAll = useApplyStyleToAll();
  const selectedIds = useSelectedIds();
  const { updateAllCaptionStyles, updateSelectedCaptionStyles, setApplyStyleToAll } =
    useEditorActions();

  const [activeTab, setActiveTab] = useState<PresetCategory>('viral');
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      if (applyToAll) {
        updateAllCaptionStyles(updates);
      } else {
        updateSelectedCaptionStyles(selectedIds, updates);
      }
    },
    [applyToAll, selectedIds, updateAllCaptionStyles, updateSelectedCaptionStyles]
  );

  if (!style) {
    return (
      <div className="p-4 text-[var(--editor-text-secondary)] text-sm">
        No captions to style. Add a video with transcription first.
      </div>
    );
  }

  const applyPreset = (preset: SubtitlePreset) => {
    // Load the font if needed
    const fontEntry = findFont(preset.fontFamily.split(',')[0].trim());
    if (fontEntry) {
      loadFont(fontEntry);
    }

    updateStyle({
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      letterSpacing: preset.letterSpacing ?? 0,
      textTransform: preset.textTransform ?? 'none',
      color: preset.color,
      activeColor: preset.activeColor,
      backgroundColor: preset.backgroundColor,
      activeBackgroundColor: preset.activeBackgroundColor,
      textShadow: preset.textShadow,
      textStroke: preset.textStroke,
      backgroundPadding: preset.backgroundPadding,
      backgroundRadius: preset.backgroundRadius,
      animation: preset.animation,
      displayMode: preset.displayMode,
      position: preset.position,
      presetId: preset.id,
    });
  };

  const resetToPreset = () => {
    if (style.presetId && SUBTITLE_PRESETS[style.presetId]) {
      applyPreset(SUBTITLE_PRESETS[style.presetId]);
    }
  };

  const filteredPresets = getPresetsByCategory(activeTab);

  // Determine if current style matches a preset
  const isPresetSelected = (preset: SubtitlePreset) =>
    style.presetId === preset.id ||
    (style.color === preset.color &&
      style.activeColor === preset.activeColor &&
      style.fontFamily === preset.fontFamily);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Apply to All Toggle */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Apply to all
        </span>
        <button
          onClick={() => setApplyStyleToAll(!applyToAll)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            applyToAll ? 'bg-[var(--editor-accent)]' : 'bg-[var(--editor-bg-elevated)]'
          }`}
          aria-label="Toggle apply to all captions"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              applyToAll ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <Divider />

      {/* Category Tabs */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex p-0.5 bg-[var(--editor-bg-elevated)] rounded-md">
          {PRESET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                activeTab === cat.id
                  ? 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)] shadow-sm'
                  : 'text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Grid */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          {filteredPresets.map((preset) => {
            const selected = isPresetSelected(preset);
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`p-3 rounded-lg border transition-all text-left ${
                  selected
                    ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/10'
                    : 'border-[var(--editor-border-subtle)] bg-[var(--editor-bg-elevated)] hover:border-[var(--editor-text-secondary)]/30'
                }`}
              >
                <div
                  className="text-sm font-bold truncate leading-snug"
                  style={{
                    color: preset.activeColor,
                    textShadow: preset.textShadow,
                    fontFamily: preset.fontFamily,
                  }}
                >
                  Hello
                </div>
                <div className="text-[10px] text-[var(--editor-text-secondary)] mt-1.5 truncate">
                  {preset.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Position Selector */}
      <Section label="Position" className="px-4 py-3">
        <SegmentedControl
          options={[
            { value: 'top', label: 'Top' },
            { value: 'center', label: 'Center' },
            { value: 'bottom', label: 'Bottom' },
          ]}
          value={style.position}
          onChange={(value) => updateStyle({ position: value as 'top' | 'center' | 'bottom' })}
        />
      </Section>

      {/* Display Mode */}
      <Section label="Display Mode" className="px-4 pb-3">
        <SegmentedControl
          options={[
            { value: 'word-by-word', label: 'Word' },
            { value: 'phrase', label: 'Phrase' },
            { value: 'karaoke', label: 'Karaoke' },
          ]}
          value={style.displayMode}
          onChange={(value) => updateStyle({ displayMode: value as CaptionDisplayMode })}
        />
      </Section>

      <Divider />

      {/* Collapsible Customize Section */}
      <button
        onClick={() => setCustomizeOpen(!customizeOpen)}
        className="flex items-center justify-between px-4 py-3 w-full hover:bg-[var(--editor-bg-elevated)] transition-colors"
      >
        <span className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Customize
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--editor-text-secondary)] transition-transform ${
            customizeOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {customizeOpen && (
        <div className="px-4 pb-4 space-y-5">
          {/* Font Family */}
          <Section label="Font Family">
            <FontFamilyDropdown
              value={style.fontFamily}
              onChange={(fontFamily) => updateStyle({ fontFamily })}
            />
          </Section>

          {/* Font Size */}
          <Section label="Font Size">
            <SliderRow
              value={style.fontSize}
              min={24}
              max={96}
              step={2}
              unit="px"
              onChange={(fontSize) => updateStyle({ fontSize })}
            />
          </Section>

          {/* Font Weight */}
          <Section label="Font Weight">
            <SliderRow
              value={style.fontWeight}
              min={400}
              max={900}
              step={100}
              onChange={(fontWeight) => updateStyle({ fontWeight })}
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
              onChange={(letterSpacing) => updateStyle({ letterSpacing })}
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
                updateStyle({ textTransform: value as 'none' | 'uppercase' | 'lowercase' })
              }
            />
          </Section>

          <InlineDivider />

          {/* Text Color */}
          <ColorRow
            label="Text Color"
            value={style.color}
            onChange={(color) => updateStyle({ color })}
          />

          {/* Active Color */}
          <ColorRow
            label="Active Color"
            value={style.activeColor}
            onChange={(activeColor) => updateStyle({ activeColor })}
          />

          {/* Background Color */}
          <ColorRow
            label="Background"
            value={style.backgroundColor}
            onChange={(backgroundColor) => updateStyle({ backgroundColor })}
          />

          {/* Active Background Color */}
          <ColorRow
            label="Active Background"
            value={style.activeBackgroundColor}
            onChange={(activeBackgroundColor) => updateStyle({ activeBackgroundColor })}
          />

          <InlineDivider />

          {/* Background Padding */}
          <Section label="Background Padding">
            <SliderRow
              value={style.backgroundPadding?.x ?? 4}
              min={0}
              max={24}
              step={1}
              unit="px"
              onChange={(padding) =>
                updateStyle({ backgroundPadding: { x: padding, y: Math.round(padding / 2) } })
              }
            />
          </Section>

          {/* Background Radius */}
          <Section label="Background Radius">
            <SliderRow
              value={style.backgroundRadius ?? 0}
              min={0}
              max={24}
              step={1}
              unit="px"
              onChange={(backgroundRadius) => updateStyle({ backgroundRadius })}
            />
          </Section>

          <InlineDivider />

          {/* Text Shadow */}
          <Section label="Text Shadow">
            <SegmentedControl
              options={TEXT_SHADOW_OPTIONS.map((opt) => ({
                value: opt.value ?? '__none__',
                label: opt.label,
              }))}
              value={
                TEXT_SHADOW_OPTIONS.find((o) => o.value === style.textShadow)
                  ? style.textShadow ?? '__none__'
                  : // If the shadow doesn't exactly match a preset, fall back to label matching
                    (() => {
                      const label = getTextShadowLabel(style.textShadow);
                      const match = TEXT_SHADOW_OPTIONS.find((o) => o.label === label);
                      return match?.value ?? '__none__';
                    })()
              }
              onChange={(value) =>
                updateStyle({
                  textShadow: value === '__none__' ? undefined : value,
                })
              }
            />
          </Section>

          <InlineDivider />

          {/* Reset to Preset Button */}
          {style.presetId && SUBTITLE_PRESETS[style.presetId] && (
            <button
              onClick={resetToPreset}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm
                         text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]
                         hover:bg-[var(--editor-bg-elevated)] rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to preset
            </button>
          )}
        </div>
      )}
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
      <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
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
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
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
      // Use the same fallback format as the presets
      const fallback =
        entry.category === 'serif'
          ? 'serif'
          : entry.category === 'mono'
            ? 'monospace'
            : 'system-ui, sans-serif';
      onChange(`${entry.family}, ${fallback}`);
    }
  };

  // Extract primary family name from value like "Inter, system-ui, sans-serif"
  const primaryFamily = value.split(',')[0].trim();

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
      {FONT_REGISTRY.map((font) => (
        <option key={font.family} value={font.family}>
          {font.family}
        </option>
      ))}
    </select>
  );
}
