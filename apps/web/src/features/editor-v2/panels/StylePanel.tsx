'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RotateCcw, Wand2, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  useFirstCaptionStyle,
  useSelectedIds,
  useEditorActions,
  useSafeZonePlatform,
  useVideoUrl,
  useCurrentTimeMs,
  useProjectId,
} from '../store/use-editor-store';
import { api } from '@/lib/api';
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
  anchorToFreeCoords,
} from '../store/types';
import {
  isAnimationConfig,
  migrateAnimation,
} from '@viona/renderer/animations';
import type { AnimationConfig, AnimationType, EasingType } from '@viona/renderer/animations';
import { EFFECT_PRESETS, effectsToCss, type EffectPresetId } from '@/lib/effects-utils';
import {
  SUBTITLE_PRESETS,
  PRESET_CATEGORIES,
  getPresetsByCategory,
  type PresetCategory,
  type SubtitlePreset,
} from '@/lib/subtitle-presets';
import { FONT_REGISTRY, loadFont, findFont, getFontsByCategory, type FontEntry } from '@/lib/font-registry';
import {
  QUICK_COLOR_PALETTES,
  sampleVideoFrame,
  generateCaptionColors,
  type ColorPalette,
} from '@/lib/color-utils';

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
  const projectId = useProjectId();
  const { updateAllCaptionStyles, updateSelectedCaptionStyles, clearSelection, selectAll, setSafeZonePlatform, setShowSafeZone, loadProject } =
    useEditorActions();

  const videoUrl = useVideoUrl();
  const currentTimeMs = useCurrentTimeMs();

  const [activeTab, setActiveTab] = useState<PresetCategory>('viral');
  const [topTab, setTopTab] = useState<'templates' | 'font' | 'position' | 'transitions'>('templates');
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoPalettes, setAutoPalettes] = useState<ColorPalette[] | null>(null);
  const [aiStylingJobId, setAiStylingJobId] = useState<string | null>(null);
  const [aiStylingStatus, setAiStylingStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for AI caption style job completion
  useEffect(() => {
    if (!aiStylingJobId || aiStylingStatus !== 'loading') return;

    aiPollRef.current = setInterval(async () => {
      try {
        const job = await api.getJob(aiStylingJobId);
        if (job.status === 'complete') {
          setAiStylingStatus('complete');
          setAiStylingJobId(null);
          // Reload project to pick up the new styleOverrides from DB
          if (projectId) {
            await loadProject(projectId);
          }
        } else if (job.status === 'failed') {
          setAiStylingStatus('error');
          setAiStylingJobId(null);
        }
      } catch {
        // Ignore poll errors
      }
    }, 2000);

    return () => {
      if (aiPollRef.current) clearInterval(aiPollRef.current);
    };
  }, [aiStylingJobId, aiStylingStatus, projectId, loadProject]);

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
      effects: preset.effects ?? { shadow: null, shadowSecondary: null, glow: null },
      backgroundPadding: preset.backgroundPadding,
      backgroundRadius: preset.backgroundRadius,
      animation: preset.animation,
      displayMode: preset.displayMode,
      wordsPerPhrase: preset.wordsPerPhrase ?? 5,
      // Position is NOT applied here — user's position should be preserved
      presetId: preset.id,
    });

    // For dynamic-hierarchy, trigger LLM-powered per-caption styling
    if (preset.id === 'dynamic-hierarchy' && projectId && aiStylingStatus !== 'loading') {
      setAiStylingStatus('loading');
      api.generateCaptionStyles(projectId)
        .then(({ jobId }) => {
          setAiStylingJobId(jobId);
        })
        .catch(() => {
          setAiStylingStatus('error');
        });
    }
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

  const TOP_TABS = [
    { id: 'templates' as const, label: 'Templates' },
    { id: 'font' as const, label: 'Font' },
    { id: 'position' as const, label: 'Position' },
    { id: 'transitions' as const, label: 'Transitions' },
  ];

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

      {/* Top-level horizontal tabs */}
      <div className="px-4 pb-2 shrink-0">
        <div className="flex p-0.5 bg-[var(--editor-bg-elevated)] rounded-md">
          {TOP_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id)}
              className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded transition-all ${
                topTab === tab.id
                  ? 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)] shadow-sm'
                  : 'text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto">

        {/* ===== TEMPLATES TAB ===== */}
        {topTab === 'templates' && (
          <>
            {/* Category Tabs */}
            <div className="px-4 pt-1 pb-1">
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
                      {/* Preset Name */}
                      <div className={`px-2 py-1.5 text-center ${
                        selected ? 'bg-[var(--editor-accent)]/10' : 'bg-[var(--editor-bg-elevated)]'
                      }`}>
                        <div className="text-[10px] text-[var(--editor-text-secondary)] truncate flex items-center justify-center gap-1">
                          {preset.id === 'dynamic-hierarchy' && aiStylingStatus === 'loading' && (
                            <Loader2 className="w-3 h-3 animate-spin text-[var(--editor-accent)]" />
                          )}
                          {preset.name}
                          {preset.id === 'dynamic-hierarchy' && aiStylingStatus === 'loading' && (
                            <span className="text-[9px] text-[var(--editor-accent)]">AI</span>
                          )}
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
          </>
        )}

        {/* ===== FONT TAB ===== */}
        {topTab === 'font' && (
          <div className="px-4 py-3 space-y-5">
            {/* Display Mode */}
            <Section label="Display Mode">
              <SegmentedControl
                options={[
                  { value: 'word-by-word', label: 'Word' },
                  { value: 'phrase', label: 'Phrase' },
                  { value: 'karaoke', label: 'Karaoke' },
                ]}
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

            <InlineDivider />

            {/* Colors Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
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
                    {autoLoading ? 'Sampling…' : 'Auto'}
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

              {/* Current color indicators */}
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded border border-[var(--editor-border-subtle)]"
                    style={{ backgroundColor: style.color }}
                  />
                  <span className="text-[10px] text-[var(--editor-text-secondary)]">Text</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-4 rounded border border-[var(--editor-border-subtle)]"
                    style={{ backgroundColor: style.activeColor }}
                  />
                  <span className="text-[10px] text-[var(--editor-text-secondary)]">Active</span>
                </div>
              </div>
            </div>

            <InlineDivider />

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
          </div>
        )}

        {/* ===== POSITION TAB ===== */}
        {topTab === 'position' && (
          <PositionTab
            style={style}
            customizeStyle={customizeStyle}
            safeZonePlatform={safeZonePlatform}
            setSafeZonePlatform={setSafeZonePlatform}
            setShowSafeZone={setShowSafeZone}
          />
        )}

        {/* ===== TRANSITIONS TAB ===== */}
        {topTab === 'transitions' && (
          <div className="pt-3">
            <TransitionPanel
              animation={style.animation}
              onChange={(animation) => customizeStyle({ animation: animation as unknown as CaptionStyle['animation'] })}
            />
          </div>
        )}

      </div>
    </div>
  );
}

// ============================================
// Position Tab (extracted for clarity)
// ============================================

const GRID_POSITIONS: Array<{ x: number; y: number; label: string }> = [
  { x: 10, y: 10, label: 'Top Left' },
  { x: 50, y: 10, label: 'Top Center' },
  { x: 90, y: 10, label: 'Top Right' },
  { x: 10, y: 50, label: 'Middle Left' },
  { x: 50, y: 50, label: 'Center' },
  { x: 90, y: 50, label: 'Middle Right' },
  { x: 10, y: 85, label: 'Bottom Left' },
  { x: 50, y: 85, label: 'Bottom Center' },
  { x: 90, y: 85, label: 'Bottom Right' },
];

const QUICK_POSITIONS = [
  { label: 'Top', x: 50, y: 10 },
  { label: 'Center', x: 50, y: 50 },
  { label: 'Bottom', x: 50, y: 85 },
  { label: 'Lower \u2153', x: 50, y: 67 },
];

const SIZE_PRESETS = [
  { label: 'S', size: 36 },
  { label: 'M', size: 56 },
  { label: 'L', size: 80 },
];

function PositionTab({
  style,
  customizeStyle,
  safeZonePlatform,
  setSafeZonePlatform,
  setShowSafeZone,
}: {
  style: CaptionStyle;
  customizeStyle: (updates: Partial<CaptionStyle>) => void;
  safeZonePlatform: string;
  setSafeZonePlatform: (platform: string) => void;
  setShowSafeZone: (show: boolean) => void;
}) {
  const pos = getPositionValue(style.position);
  const mode = pos.mode ?? 'anchor';
  const captionWidth = pos.width ?? 90;

  const handleReset = () => {
    if (mode === 'free') {
      customizeStyle({
        position: { ...pos, x: 50, y: 85, rotation: 0, width: 90 },
      });
    } else {
      customizeStyle({
        position: { anchor: pos.anchor, offsetX: 0, offsetY: 0, rotation: 0, textAlign: 'center', width: 90 },
      });
    }
  };

  const switchToFree = () => {
    const coords = anchorToFreeCoords(pos);
    customizeStyle({
      position: { ...pos, mode: 'free', x: coords.x, y: coords.y },
    });
  };

  const switchToAnchor = () => {
    customizeStyle({
      position: { ...pos, mode: 'anchor', offsetX: 0, offsetY: 0 },
    });
  };

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Position
        </label>
        <button
          onClick={handleReset}
          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] transition-colors"
          title="Reset position"
        >
          Reset
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="space-y-1.5">
        <span className="text-xs text-[var(--editor-text-secondary)]">Mode</span>
        <SegmentedControl
          options={[
            { value: 'anchor', label: 'Anchor' },
            { value: 'free', label: 'Free' },
          ]}
          value={mode}
          onChange={(v) => v === 'free' ? switchToFree() : switchToAnchor()}
        />
      </div>

      {mode === 'anchor' ? (
        <>
          {/* Anchor Selector */}
          <div className="space-y-1.5">
            <span className="text-xs text-[var(--editor-text-secondary)]">Anchor</span>
            <SegmentedControl
              options={[
                { value: 'top', label: 'Top' },
                { value: 'center', label: 'Center' },
                { value: 'bottom', label: 'Bottom' },
              ]}
              value={pos.anchor}
              onChange={(value) => customizeStyle({
                position: { ...pos, anchor: value as 'top' | 'center' | 'bottom' }
              })}
            />
          </div>

          {/* Horizontal Offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--editor-text-secondary)]">Horizontal Offset</span>
              {pos.offsetX !== 0 && (
                <button
                  onClick={() => customizeStyle({ position: { ...pos, offsetX: 0 } })}
                  className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
                >
                  Reset
                </button>
              )}
            </div>
            <SliderRow
              value={pos.offsetX}
              min={-50}
              max={50}
              step={1}
              unit="%"
              onChange={(offsetX) => customizeStyle({ position: { ...pos, offsetX } })}
            />
          </div>

          {/* Vertical Offset */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--editor-text-secondary)]">Vertical Offset</span>
              {pos.offsetY !== 0 && (
                <button
                  onClick={() => customizeStyle({ position: { ...pos, offsetY: 0 } })}
                  className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
                >
                  Reset
                </button>
              )}
            </div>
            <SliderRow
              value={pos.offsetY}
              min={-50}
              max={50}
              step={1}
              unit="%"
              onChange={(offsetY) => customizeStyle({ position: { ...pos, offsetY } })}
            />
          </div>
        </>
      ) : (
        <>
          {/* 9-point position grid */}
          <div className="space-y-1.5">
            <span className="text-xs text-[var(--editor-text-secondary)]">Position</span>
            <div
              className="relative rounded-lg border border-[var(--editor-border-subtle)] bg-[var(--editor-bg-elevated)]"
              style={{ width: 140, height: 200 }}
            >
              {GRID_POSITIONS.map((gp) => {
                const isActive = pos.x != null && pos.y != null
                  && Math.abs((pos.x ?? 50) - gp.x) < 5
                  && Math.abs((pos.y ?? 85) - gp.y) < 5;
                return (
                  <button
                    key={`${gp.x}-${gp.y}`}
                    title={gp.label}
                    onClick={() => customizeStyle({
                      position: { ...pos, mode: 'free', x: gp.x, y: gp.y },
                    })}
                    className="absolute rounded-full transition-all"
                    style={{
                      left: `${(gp.x / 100) * 100}%`,
                      top: `${(gp.y / 100) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      width: isActive ? 12 : 8,
                      height: isActive ? 12 : 8,
                      backgroundColor: isActive ? 'var(--editor-accent, #6366f1)' : 'var(--editor-text-secondary)',
                      opacity: isActive ? 1 : 0.4,
                      border: isActive ? '2px solid var(--editor-text-primary)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* X/Y sliders */}
          <div className="space-y-1.5">
            <span className="text-xs text-[var(--editor-text-secondary)]">X Position</span>
            <SliderRow
              value={Math.round(pos.x ?? 50)}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(x) => customizeStyle({ position: { ...pos, x } })}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-[var(--editor-text-secondary)]">Y Position</span>
            <SliderRow
              value={Math.round(pos.y ?? 85)}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(y) => customizeStyle({ position: { ...pos, y } })}
            />
          </div>

          {/* Quick position buttons */}
          <div className="flex gap-1.5">
            {QUICK_POSITIONS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => customizeStyle({
                  position: { ...pos, mode: 'free', x: qp.x, y: qp.y },
                })}
                className="flex-1 px-1.5 py-1 text-[10px] rounded bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-surface)] transition-colors"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </>
      )}

      <InlineDivider />

      {/* Width slider (always visible) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--editor-text-secondary)]">Width</span>
          {captionWidth !== 90 && (
            <button
              onClick={() => customizeStyle({ position: { ...pos, width: 90 } })}
              className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
            >
              Reset
            </button>
          )}
        </div>
        <SliderRow
          value={captionWidth}
          min={20}
          max={100}
          step={1}
          unit="%"
          onChange={(width) => customizeStyle({ position: { ...pos, width } })}
        />
      </div>

      {/* Font size presets */}
      <div className="space-y-1.5">
        <span className="text-xs text-[var(--editor-text-secondary)]">Size Presets</span>
        <div className="flex gap-1.5">
          {SIZE_PRESETS.map((sp) => (
            <button
              key={sp.label}
              onClick={() => customizeStyle({ fontSize: sp.size })}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                style.fontSize === sp.size
                  ? 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)] shadow-sm'
                  : 'bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
              }`}
            >
              {sp.label}
            </button>
          ))}
          <span className="flex-1 px-2 py-1.5 text-xs text-center tabular-nums text-[var(--editor-text-secondary)]">
            {style.fontSize}px
          </span>
        </div>
      </div>

      <InlineDivider />

      {/* Rotation */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--editor-text-secondary)]">Rotation</span>
          {pos.rotation !== 0 && (
            <button
              onClick={() => customizeStyle({ position: { ...pos, rotation: 0 } })}
              className="text-[10px] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]"
            >
              Reset
            </button>
          )}
        </div>
        <SliderRow
          value={pos.rotation}
          min={-180}
          max={180}
          step={1}
          unit="\u00B0"
          onChange={(rotation) => customizeStyle({ position: { ...pos, rotation } })}
        />
      </div>

      {/* Text Alignment */}
      <div className="space-y-1.5">
        <span className="text-xs text-[var(--editor-text-secondary)]">Text Align</span>
        <SegmentedControl
          options={[
            { value: 'left', label: '\u2261L' },
            { value: 'center', label: '\u2261C' },
            { value: 'right', label: '\u2261R' },
          ]}
          value={pos.textAlign}
          onChange={(value) => customizeStyle({
            position: { ...pos, textAlign: value as 'left' | 'center' | 'right' }
          })}
        />
      </div>

      <InlineDivider />

      {/* Safe Zone Section */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Safe Zone Guide
        </label>

        <select
          value={safeZonePlatform}
          onChange={(e) => {
            const platform = e.target.value;
            setSafeZonePlatform(platform);
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

// ============================================
// Transition Panel
// ============================================

const ANIMATION_OPTIONS: { value: AnimationType; label: string; group: string }[] = [
  { value: 'none', label: 'None', group: 'Basic' },
  // Viral
  { value: 'elastic-pop', label: 'Elastic Pop', group: 'Viral' },
  { value: 'bounce-up', label: 'Bounce Up', group: 'Viral' },
  { value: 'shake', label: 'Shake', group: 'Viral' },
  { value: 'color-wipe', label: 'Color Wipe', group: 'Viral' },
  { value: '3d-flip', label: '3D Flip', group: 'Viral' },
  { value: 'punch', label: 'Punch', group: 'Viral' },
  { value: 'scale-bounce', label: 'Scale Bounce', group: 'Viral' },
  { value: 'slide-up', label: 'Slide Up', group: 'Viral' },
  { value: 'weight-shift', label: 'Weight Shift', group: 'Viral' },
  { value: 'float', label: 'Float', group: 'Viral' },
  { value: 'rotate-bounce', label: 'Rotate Bounce', group: 'Viral' },
  { value: 'constant-wiggle', label: 'Wiggle', group: 'Viral' },
  { value: 'slam-down', label: 'Slam Down', group: 'Viral' },
  { value: 'shake-entry', label: 'Shake Entry', group: 'Viral' },
  { value: 'bubble-pop', label: 'Bubble Pop', group: 'Viral' },
  { value: 'wiggle', label: 'Wiggle Alt', group: 'Viral' },
  // Cinematic
  { value: 'fade', label: 'Fade', group: 'Cinematic' },
  { value: 'fade-rise', label: 'Fade Rise', group: 'Cinematic' },
  { value: 'typewriter', label: 'Typewriter', group: 'Cinematic' },
  { value: 'smooth-slide', label: 'Smooth Slide', group: 'Cinematic' },
  { value: 'soft-scale', label: 'Soft Scale', group: 'Cinematic' },
  { value: 'underline-wipe', label: 'Underline Wipe', group: 'Cinematic' },
  { value: 'scan-line', label: 'Scan Line', group: 'Cinematic' },
  { value: 'hand-draw', label: 'Hand Draw', group: 'Cinematic' },
  { value: 'underline-sweep', label: 'Underline Sweep', group: 'Cinematic' },
  // Ad / Premium
  { value: 'apple-fade', label: 'Apple Fade', group: 'Premium' },
  { value: 'google-slide', label: 'Google Slide', group: 'Premium' },
  { value: 'clean-scale', label: 'Clean Scale', group: 'Premium' },
  { value: 'letter-cascade', label: 'Letter Cascade', group: 'Premium' },
  { value: 'smooth-reveal', label: 'Smooth Reveal', group: 'Premium' },
  { value: 'slide-left', label: 'Slide Left', group: 'Premium' },
  // Motion
  { value: 'spotlight-reveal', label: 'Spotlight', group: 'Motion' },
  { value: 'film-burn', label: 'Film Burn', group: 'Motion' },
  { value: 'glitch', label: 'Glitch', group: 'Motion' },
  { value: 'spin-reveal', label: 'Spin Reveal', group: 'Motion' },
  { value: 'drop-slam', label: 'Drop Slam', group: 'Motion' },
  { value: 'wave', label: 'Wave', group: 'Motion' },
  { value: 'blur-zoom', label: 'Blur Zoom', group: 'Motion' },
  { value: 'chromatic-split', label: 'Chromatic Split', group: 'Motion' },
  { value: 'elastic-horizontal', label: 'Elastic Horizontal', group: 'Motion' },
  { value: 'speed-blur', label: 'Speed Blur', group: 'Motion' },
  { value: 'particle-explode', label: 'Particle Explode', group: 'Motion' },
  { value: 'gather', label: 'Gather', group: 'Motion' },
  { value: 'blob-morph', label: 'Blob Morph', group: 'Motion' },
  { value: 'newspaper-rotate', label: 'Newspaper Rotate', group: 'Motion' },
  { value: 'chrome-reflect', label: 'Chrome Reflect', group: 'Motion' },
  { value: 'brutal-slam', label: 'Brutal Slam', group: 'Motion' },
  { value: 'neon-buzz', label: 'Neon Buzz', group: 'Motion' },
  { value: 'flicker', label: 'Flicker', group: 'Motion' },
];

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'elastic', label: 'Elastic' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'linear', label: 'Linear' },
];

function TransitionPanel({
  animation,
  onChange,
}: {
  animation: AnimationConfig | string;
  onChange: (config: AnimationConfig) => void;
}) {
  const config: AnimationConfig = isAnimationConfig(animation)
    ? animation
    : migrateAnimation(animation as string);

  const update = (field: keyof AnimationConfig, value: string) => {
    onChange({ ...config, [field]: value });
  };

  // Group animations by category for optgroup rendering
  const groups = ANIMATION_OPTIONS.reduce<Record<string, typeof ANIMATION_OPTIONS>>((acc, opt) => {
    (acc[opt.group] ??= []).push(opt);
    return acc;
  }, {});

  const renderAnimSelect = (label: string, field: 'in' | 'active' | 'out', value: AnimationType) => (
    <div className="space-y-1">
      <span className="text-[10px] text-[var(--editor-text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(e) => update(field, e.target.value)}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--editor-border-subtle)]
                   bg-[var(--editor-bg-surface)] text-[var(--editor-text-primary)]
                   focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
      >
        {Object.entries(groups).map(([group, options]) => (
          <optgroup key={group} label={group}>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );

  return (
    <div className="px-4 pb-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {renderAnimSelect('Enter', 'in', config.in)}
        {renderAnimSelect('Active', 'active', config.active)}
        {renderAnimSelect('Exit', 'out', config.out)}
      </div>
      <div className="space-y-1">
        <span className="text-[10px] text-[var(--editor-text-secondary)]">Easing</span>
        <div className="flex flex-wrap gap-1.5">
          {EASING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('easing', opt.value)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                config.easing === opt.value
                  ? 'bg-[var(--editor-accent)] border-[var(--editor-accent)] text-white'
                  : 'border-[var(--editor-border-subtle)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-elevated)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
