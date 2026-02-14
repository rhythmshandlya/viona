'use client';

import React, { useState, useCallback } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  useFirstCaptionStyle,
  useSelectedIds,
  useEditorActions,
  useSafeZonePlatform,
} from '../store/use-editor-store';
import {
  CaptionDisplayMode,
  CaptionStyle,
  CaptionPosition,
  CaptionEffects,
  ShadowEffect,
  GlowEffect,
  StrokeStyle,
  PLATFORM_SAFE_ZONES,
  DEFAULT_CAPTION_POSITION,
  DEFAULT_SHADOW,
  DEFAULT_GLOW,
  DEFAULT_CAPTION_EFFECTS,
  migratePosition,
  migrateTextShadow,
} from '../store/types';
import { EFFECT_PRESETS, type EffectPresetId } from '@/lib/effects-utils';
import {
  SUBTITLE_PRESETS,
  PRESET_CATEGORIES,
  getPresetsByCategory,
  type PresetCategory,
  type SubtitlePreset,
} from '@/lib/subtitle-presets';
import { FONT_REGISTRY, loadFont, findFont } from '@/lib/font-registry';

// ============================================
// Helper to get position value (handles both legacy string and new object)
// ============================================

function getPositionValue(position: CaptionPosition | 'top' | 'center' | 'bottom'): CaptionPosition {
  if (typeof position === 'object' && 'anchor' in position) {
    return position;
  }
  // Legacy string format - migrate
  return {
    anchor: position as 'top' | 'center' | 'bottom',
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    textAlign: 'center',
  };
}

// ============================================
// Helper to get effects value (handles both legacy textShadow and new effects object)
// ============================================

function getEffectsValue(style: CaptionStyle): CaptionEffects {
  if (style.effects) {
    return style.effects;
  }
  // Migrate from legacy textShadow
  return migrateTextShadow(style.textShadow);
}

// ============================================
// StylePanel
// ============================================

export function StylePanel() {
  const style = useFirstCaptionStyle();
  const selectedIds = useSelectedIds();
  const safeZonePlatform = useSafeZonePlatform();
  const { updateAllCaptionStyles, updateSelectedCaptionStyles, clearSelection, selectAll, setSafeZonePlatform, setShowSafeZone } =
    useEditorActions();

  const [activeTab, setActiveTab] = useState<PresetCategory>('viral');
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Apply to all when nothing selected, otherwise apply to selected only
  const updateStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      if (selectedIds.length === 0) {
        // No selection - apply to all captions
        updateAllCaptionStyles(updates);
      } else {
        // Has selection - apply only to selected captions
        updateSelectedCaptionStyles(selectedIds, updates);
      }
    },
    [selectedIds, updateAllCaptionStyles, updateSelectedCaptionStyles]
  );

  // Customize style - clears presetId since user is customizing
  const customizeStyle = useCallback(
    (updates: Partial<CaptionStyle>) => {
      updateStyle({ ...updates, presetId: undefined });
    },
    [updateStyle]
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
      opacity: preset.opacity ?? 1,
      lineHeight: preset.lineHeight ?? 1.4,
      color: preset.color,
      activeColor: preset.activeColor,
      backgroundColor: preset.backgroundColor,
      activeBackgroundColor: preset.activeBackgroundColor,
      stroke: preset.stroke ?? null,
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

  // Determine if current style matches a preset (only by presetId, not fuzzy matching)
  const isPresetSelected = (preset: SubtitlePreset) =>
    style.presetId === preset.id;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Editing indicator and selection controls */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
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

      {/* Position Section - Expanded */}
      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
            Position
          </label>
          {/* Reset All Position button */}
          <button
            onClick={() => customizeStyle({
              position: { anchor: getPositionValue(style.position).anchor, offsetX: 0, offsetY: 0, rotation: 0, textAlign: 'center' }
            })}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] transition-colors"
            title="Reset offsets and rotation"
          >
            Reset
          </button>
        </div>

        {/* Anchor Selector */}
        <div className="space-y-1.5">
          <span className="text-xs text-[var(--editor-text-secondary)]">Anchor</span>
          <SegmentedControl
            options={[
              { value: 'top', label: 'Top' },
              { value: 'center', label: 'Center' },
              { value: 'bottom', label: 'Bottom' },
            ]}
            value={getPositionValue(style.position).anchor}
            onChange={(value) => customizeStyle({
              position: { ...getPositionValue(style.position), anchor: value as 'top' | 'center' | 'bottom' }
            })}
          />
        </div>

        {/* Horizontal Offset (X) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--editor-text-secondary)]">Horizontal Offset</span>
            {getPositionValue(style.position).offsetX !== 0 && (
              <button
                onClick={() => customizeStyle({
                  position: { ...getPositionValue(style.position), offsetX: 0 }
                })}
                className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
              >
                Reset
              </button>
            )}
          </div>
          <SliderRow
            value={getPositionValue(style.position).offsetX}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(offsetX) => customizeStyle({
              position: { ...getPositionValue(style.position), offsetX }
            })}
          />
        </div>

        {/* Vertical Offset (Y) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--editor-text-secondary)]">Vertical Offset</span>
            {getPositionValue(style.position).offsetY !== 0 && (
              <button
                onClick={() => customizeStyle({
                  position: { ...getPositionValue(style.position), offsetY: 0 }
                })}
                className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
              >
                Reset
              </button>
            )}
          </div>
          <SliderRow
            value={getPositionValue(style.position).offsetY}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(offsetY) => customizeStyle({
              position: { ...getPositionValue(style.position), offsetY }
            })}
          />
        </div>

        {/* Rotation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--editor-text-secondary)]">Rotation</span>
            {getPositionValue(style.position).rotation !== 0 && (
              <button
                onClick={() => customizeStyle({
                  position: { ...getPositionValue(style.position), rotation: 0 }
                })}
                className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
              >
                Reset
              </button>
            )}
          </div>
          <SliderRow
            value={getPositionValue(style.position).rotation}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(rotation) => customizeStyle({
              position: { ...getPositionValue(style.position), rotation }
            })}
          />
        </div>

        {/* Text Alignment */}
        <div className="space-y-1.5">
          <span className="text-xs text-[var(--editor-text-secondary)]">Text Align</span>
          <SegmentedControl
            options={[
              { value: 'left', label: '≡L' },
              { value: 'center', label: '≡C' },
              { value: 'right', label: '≡R' },
            ]}
            value={getPositionValue(style.position).textAlign}
            onChange={(value) => customizeStyle({
              position: { ...getPositionValue(style.position), textAlign: value as 'left' | 'center' | 'right' }
            })}
          />
        </div>
      </div>

      <Divider />

      {/* Safe Zone Section */}
      <div className="px-4 py-3 space-y-3">
        <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Safe Zone Guide
        </label>

        {/* Platform Selector */}
        <select
          value={safeZonePlatform}
          onChange={(e) => {
            const platform = e.target.value;
            setSafeZonePlatform(platform);
            // Auto-show overlay when platform selected, hide when none
            setShowSafeZone(platform !== 'none');
          }}
          className="w-full px-3 py-2 text-xs rounded-md
                     bg-[var(--editor-bg-elevated)] text-[var(--editor-text-primary)]
                     border border-[var(--editor-border-subtle)]
                     focus:outline-none focus:border-[var(--editor-accent)]
                     cursor-pointer"
        >
          <option value="none">None</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram-reels">Instagram Reels</option>
          <option value="youtube-shorts">YouTube Shorts</option>
          <option value="universal">Universal</option>
        </select>

        {safeZonePlatform !== 'none' && (
          <p className="text-[10px] text-[var(--editor-text-secondary)]">
            Avoid placing captions in the red zones
          </p>
        )}
      </div>

      <Divider />

      {/* Display Mode */}
      <Section label="Display Mode" className="px-4 py-3">
        <SegmentedControl
          options={[
            { value: 'word-by-word', label: 'Word' },
            { value: 'phrase', label: 'Phrase' },
            { value: 'karaoke', label: 'Karaoke' },
          ]}
          value={style.displayMode}
          onChange={(value) => customizeStyle({ displayMode: value as CaptionDisplayMode })}
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
              onChange={(fontFamily) => customizeStyle({ fontFamily })}
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

          <InlineDivider />

          {/* Text Color */}
          <ColorRow
            label="Text Color"
            value={style.color}
            onChange={(color) => customizeStyle({ color })}
          />

          {/* Active Color */}
          <ColorRow
            label="Active Color"
            value={style.activeColor}
            onChange={(activeColor) => customizeStyle({ activeColor })}
          />

          {/* Background Color */}
          <ColorRow
            label="Background"
            value={style.backgroundColor}
            onChange={(backgroundColor) => customizeStyle({ backgroundColor })}
          />

          {/* Active Background Color */}
          <ColorRow
            label="Active Background"
            value={style.activeBackgroundColor}
            onChange={(activeBackgroundColor) => customizeStyle({ activeBackgroundColor })}
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
                customizeStyle({ backgroundPadding: { x: padding, y: Math.round(padding / 2) } })
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
              onChange={(backgroundRadius) => customizeStyle({ backgroundRadius })}
            />
          </Section>

          <InlineDivider />

          {/* Opacity */}
          <Section label="Opacity">
            <SliderRow
              value={Math.round((style.opacity ?? 1) * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => customizeStyle({ opacity: value / 100 })}
            />
          </Section>

          {/* Effects Section */}
          <Section label="Effects">
            {/* Quick Presets */}
            <div className="flex gap-1 mb-3">
              {(['none', 'soft', 'hard', 'neon'] as EffectPresetId[]).map((presetId) => (
                <button
                  key={presetId}
                  onClick={() => customizeStyle({ effects: EFFECT_PRESETS[presetId] })}
                  className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded
                             bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)]
                             hover:bg-[var(--editor-bg-surface)] hover:text-[var(--editor-text-primary)]
                             transition-colors capitalize"
                >
                  {presetId}
                </button>
              ))}
            </div>

            {/* Primary Shadow */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--editor-text-secondary)]">Shadow</span>
                <button
                  onClick={() => {
                    const effects = getEffectsValue(style);
                    if (effects.shadow) {
                      customizeStyle({ effects: { ...effects, shadow: null } });
                    } else {
                      customizeStyle({ effects: { ...effects, shadow: { ...DEFAULT_SHADOW } } });
                    }
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    getEffectsValue(style).shadow ? 'bg-[var(--editor-accent)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      getEffectsValue(style).shadow ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {getEffectsValue(style).shadow && (
                <div className="pl-2 border-l-2 border-[var(--editor-border-subtle)] space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Offset X</span>
                    <SliderRow
                      value={getEffectsValue(style).shadow!.offsetX}
                      min={-20}
                      max={20}
                      step={1}
                      unit="px"
                      onChange={(offsetX) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadow: { ...effects.shadow!, offsetX } } });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Offset Y</span>
                    <SliderRow
                      value={getEffectsValue(style).shadow!.offsetY}
                      min={-20}
                      max={20}
                      step={1}
                      unit="px"
                      onChange={(offsetY) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadow: { ...effects.shadow!, offsetY } } });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Blur</span>
                    <SliderRow
                      value={getEffectsValue(style).shadow!.blur}
                      min={0}
                      max={30}
                      step={1}
                      unit="px"
                      onChange={(blur) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadow: { ...effects.shadow!, blur } } });
                      }}
                    />
                  </div>
                  <ColorRow
                    label="Color"
                    value={getEffectsValue(style).shadow!.color}
                    onChange={(color) => {
                      const effects = getEffectsValue(style);
                      customizeStyle({ effects: { ...effects, shadow: { ...effects.shadow!, color } } });
                    }}
                  />
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Opacity</span>
                    <SliderRow
                      value={Math.round(getEffectsValue(style).shadow!.opacity * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(value) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadow: { ...effects.shadow!, opacity: value / 100 } } });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Shadow */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--editor-text-secondary)]">Second Shadow</span>
                <button
                  onClick={() => {
                    const effects = getEffectsValue(style);
                    if (effects.shadowSecondary) {
                      customizeStyle({ effects: { ...effects, shadowSecondary: null } });
                    } else {
                      customizeStyle({ effects: { ...effects, shadowSecondary: { offsetX: 3, offsetY: 3, blur: 6, color: '#000000', opacity: 0.5 } } });
                    }
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    getEffectsValue(style).shadowSecondary ? 'bg-[var(--editor-accent)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      getEffectsValue(style).shadowSecondary ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {getEffectsValue(style).shadowSecondary && (
                <div className="pl-2 border-l-2 border-[var(--editor-border-subtle)] space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Offset X</span>
                    <SliderRow
                      value={getEffectsValue(style).shadowSecondary!.offsetX}
                      min={-20}
                      max={20}
                      step={1}
                      unit="px"
                      onChange={(offsetX) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadowSecondary: { ...effects.shadowSecondary!, offsetX } } });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Offset Y</span>
                    <SliderRow
                      value={getEffectsValue(style).shadowSecondary!.offsetY}
                      min={-20}
                      max={20}
                      step={1}
                      unit="px"
                      onChange={(offsetY) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadowSecondary: { ...effects.shadowSecondary!, offsetY } } });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Blur</span>
                    <SliderRow
                      value={getEffectsValue(style).shadowSecondary!.blur}
                      min={0}
                      max={30}
                      step={1}
                      unit="px"
                      onChange={(blur) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadowSecondary: { ...effects.shadowSecondary!, blur } } });
                      }}
                    />
                  </div>
                  <ColorRow
                    label="Color"
                    value={getEffectsValue(style).shadowSecondary!.color}
                    onChange={(color) => {
                      const effects = getEffectsValue(style);
                      customizeStyle({ effects: { ...effects, shadowSecondary: { ...effects.shadowSecondary!, color } } });
                    }}
                  />
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Opacity</span>
                    <SliderRow
                      value={Math.round(getEffectsValue(style).shadowSecondary!.opacity * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(value) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, shadowSecondary: { ...effects.shadowSecondary!, opacity: value / 100 } } });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Glow Effect */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--editor-text-secondary)]">Glow</span>
                <button
                  onClick={() => {
                    const effects = getEffectsValue(style);
                    if (effects.glow?.enabled) {
                      customizeStyle({ effects: { ...effects, glow: null } });
                    } else {
                      customizeStyle({ effects: { ...effects, glow: { ...DEFAULT_GLOW, enabled: true } } });
                    }
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    getEffectsValue(style).glow?.enabled ? 'bg-[var(--editor-accent)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      getEffectsValue(style).glow?.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {getEffectsValue(style).glow?.enabled && (
                <div className="pl-2 border-l-2 border-[var(--editor-border-subtle)] space-y-2">
                  <ColorRow
                    label="Color"
                    value={getEffectsValue(style).glow!.color}
                    onChange={(color) => {
                      const effects = getEffectsValue(style);
                      customizeStyle({ effects: { ...effects, glow: { ...effects.glow!, color } } });
                    }}
                  />
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Intensity</span>
                    <SliderRow
                      value={Math.round(getEffectsValue(style).glow!.intensity * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(value) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, glow: { ...effects.glow!, intensity: value / 100 } } });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-[var(--editor-text-secondary)]">Size</span>
                    <SliderRow
                      value={getEffectsValue(style).glow!.size}
                      min={5}
                      max={50}
                      step={1}
                      unit="px"
                      onChange={(size) => {
                        const effects = getEffectsValue(style);
                        customizeStyle({ effects: { ...effects, glow: { ...effects.glow!, size } } });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>

          <InlineDivider />

          {/* Text Stroke */}
          <Section label="Text Stroke">
            <div className="space-y-3">
              {/* Stroke Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--editor-text-secondary)]">Enable</span>
                <button
                  onClick={() => {
                    if (style.stroke) {
                      customizeStyle({ stroke: null });
                    } else {
                      customizeStyle({ stroke: { width: 2, color: '#000000' } });
                    }
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    style.stroke ? 'bg-[var(--editor-accent)]' : 'bg-[var(--editor-bg-elevated)]'
                  }`}
                  aria-label="Toggle text stroke"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      style.stroke ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Stroke Controls (shown when enabled) */}
              {style.stroke && (
                <>
                  {/* Stroke Width */}
                  <div className="space-y-1">
                    <span className="text-xs text-[var(--editor-text-secondary)]">Width</span>
                    <SliderRow
                      value={style.stroke.width}
                      min={0.5}
                      max={10}
                      step={0.5}
                      unit="px"
                      onChange={(width) =>
                        customizeStyle({ stroke: { ...style.stroke!, width } })
                      }
                    />
                  </div>

                  {/* Stroke Color */}
                  <ColorRow
                    label="Color"
                    value={style.stroke.color}
                    onChange={(color) =>
                      customizeStyle({ stroke: { ...style.stroke!, color } })
                    }
                  />
                </>
              )}
            </div>
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
