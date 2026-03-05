/**
 * PropertiesContent Component
 * Plain scrollable content for editing selected item properties (captions, video position)
 */

'use client';

import React, { useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  useSelectedIds,
  useItem,
  useActiveCaptionStyle,
  useApplyStyleToAll,
  useVideoSettings,
  useEditorActions,
  useItems,
  useItemIds,
} from '../store/use-editor-store';
import { ZoneSelector } from './ZoneSelector';
import { SegmentationStatus } from './SegmentationStatus';
import {
  CaptionDisplayMode,
  CaptionAnimationLegacy,
  CaptionStyle,
  CaptionPosition,
  AudioItemData,
  VisualItemData,
  VisualDisplayMode,
  VideoItemData,
  OverlayZone,
} from '../store/types';
import { SUBTITLE_PRESETS, PRESET_ORDER } from '@/lib/subtitle-presets';

export function PropertiesContent() {
  const selectedIds = useSelectedIds();
  const firstSelectedItem = useItem(selectedIds[0] || '');

  if (!firstSelectedItem) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-[var(--editor-text-muted)]">Select an item to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {firstSelectedItem.type === 'caption' && <CaptionStylePanel />}
      {firstSelectedItem.type === 'video' && <VideoPanel />}
      {firstSelectedItem.type === 'audio' && <AudioPanel />}
      {firstSelectedItem.type === 'visual' && <VisualPropertiesPanel />}
    </div>
  );
}

// ============================================
// Caption Style Panel
// ============================================

function CaptionStylePanel() {
  const style = useActiveCaptionStyle();
  const applyToAll = useApplyStyleToAll();
  const selectedIds = useSelectedIds();
  const { updateAllCaptionStyles, updateSelectedCaptionStyles, setApplyStyleToAll } = useEditorActions();

  // Default: apply-to-all when single selection, per-selection when multi
  useEffect(() => {
    setApplyStyleToAll(selectedIds.length <= 1);
  }, [selectedIds.length, setApplyStyleToAll]);

  if (!style) return null;

  const updateStyle = (updates: Partial<CaptionStyle>) => {
    if (applyToAll) {
      updateAllCaptionStyles(updates);
    } else {
      updateSelectedCaptionStyles(selectedIds, updates);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Apply to All Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Apply to all
        </span>
        <button
          onClick={() => setApplyStyleToAll(!applyToAll)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            applyToAll ? 'bg-[var(--editor-accent)]' : 'bg-gray-300'
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

      {/* Display Mode */}
      <Section label="Display Mode">
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

      {/* Animation */}
      <Section label="Animation">
        <SegmentedControl
          options={[
            { value: 'none', label: 'None' },
            { value: 'pop', label: 'Pop' },
            { value: 'fade', label: 'Fade' },
            { value: 'highlight', label: 'Glow' },
          ]}
          value={typeof style.animation === 'string' ? style.animation : 'none'}
          onChange={(value) => updateStyle({ animation: value as CaptionAnimationLegacy })}
        />
      </Section>

      <Divider />

      {/* Style Presets */}
      <Section label="Preset">
        <div className="grid grid-cols-2 gap-2">
          {PRESET_ORDER.map((presetId) => {
            const preset = SUBTITLE_PRESETS[presetId];
            const isSelected = style.color === preset.color && style.activeColor === preset.activeColor;

            return (
              <button
                key={presetId}
                onClick={() =>
                  updateStyle({
                    color: preset.color,
                    activeColor: preset.activeColor,
                    backgroundColor: preset.backgroundColor,
                    activeBackgroundColor: preset.activeBackgroundColor,
                    textShadow: preset.textShadow,
                    textStroke: preset.textStroke,
                    stroke: preset.stroke ?? null,
                    fontWeight: preset.fontWeight,
                    opacity: preset.opacity ?? 1,
                    lineHeight: preset.lineHeight ?? 1.4,
                  })
                }
                className={`p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-[var(--editor-accent)] bg-[var(--editor-accent-muted)]'
                    : 'border-[var(--editor-border-default)] bg-[var(--editor-bg-elevated)] hover:border-[var(--editor-border-default)] hover:bg-[var(--editor-bg-hover)]'
                }`}
              >
                <div
                  className="text-sm font-bold truncate"
                  style={{
                    color: preset.activeColor,
                    textShadow: preset.textShadow,
                  }}
                >
                  Hello
                </div>
                <div className="text-xs text-[var(--editor-text-muted)] mt-1">
                  {preset.name}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Divider />

      {/* Colors */}
      <Section label="Colors">
        <div className="flex gap-3">
          <ColorPicker
            label="Text"
            value={style.color}
            onChange={(color) => updateStyle({ color })}
          />
          <ColorPicker
            label="Active"
            value={style.activeColor}
            onChange={(color) => updateStyle({ activeColor: color })}
          />
          <ColorPicker
            label="BG"
            value={style.backgroundColor || 'transparent'}
            onChange={(color) => updateStyle({ backgroundColor: color === '#000000' ? 'transparent' : color })}
          />
        </div>
      </Section>

      <Divider />

      {/* Font Size */}
      <Section label="Size">
        <div className="flex items-center gap-3">
          <Slider
            value={[style.fontSize]}
            min={24}
            max={96}
            step={2}
            onValueChange={([size]) => updateStyle({ fontSize: size })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {style.fontSize}px
          </span>
        </div>
      </Section>

      {/* Line Height */}
      <Section label="Line Height">
        <div className="flex items-center gap-3">
          <Slider
            value={[style.lineHeight ?? 1.4]}
            min={1.0}
            max={2.5}
            step={0.1}
            onValueChange={([lh]) => updateStyle({ lineHeight: lh })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {(style.lineHeight ?? 1.4).toFixed(1)}
          </span>
        </div>
      </Section>

      {/* Position */}
      <Section label="Position">
        <SegmentedControl
          options={[
            { value: 'top', label: 'Top' },
            { value: 'center', label: 'Center' },
            { value: 'bottom', label: 'Bottom' },
          ]}
          value={typeof style.position === 'object' ? style.position.anchor : style.position}
          onChange={(value) => {
            const anchor = value as 'top' | 'center' | 'bottom';
            // If current position is already an object, update just the anchor
            // Otherwise create a new position object
            if (typeof style.position === 'object') {
              updateStyle({ position: { ...style.position, anchor } });
            } else {
              updateStyle({ position: { anchor, offsetX: 0, offsetY: 0, rotation: 0, textAlign: 'center' } });
            }
          }}
        />
      </Section>

      <Divider />

      {/* Opacity */}
      <Section label="Opacity">
        <div className="flex items-center gap-3">
          <Slider
            value={[Math.round((style.opacity ?? 1) * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={([op]) => updateStyle({ opacity: op / 100 })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {Math.round((style.opacity ?? 1) * 100)}%
          </span>
        </div>
      </Section>

      <Divider />

      {/* Text Stroke */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
          Stroke
        </span>
        <button
          onClick={() => updateStyle({ stroke: style.stroke ? null : { width: 2, color: '#000000' } })}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            style.stroke ? 'bg-[var(--editor-accent)]' : 'bg-gray-300'
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
      {style.stroke && (
        <Section label="Stroke Width">
          <div className="flex items-center gap-3">
            <Slider
              value={[style.stroke.width]}
              min={0.5}
              max={10}
              step={0.5}
              onValueChange={([w]) => updateStyle({ stroke: { ...style.stroke!, width: w } })}
              className="flex-1"
            />
            <input
              type="color"
              value={style.stroke.color}
              onChange={(e) => updateStyle({ stroke: { ...style.stroke!, color: e.target.value } })}
              className="w-8 h-8 rounded border border-[var(--editor-border-default)] cursor-pointer"
            />
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================
// Video Panel (position + audio separation)
// ============================================

function VideoPanel() {
  const selectedIds = useSelectedIds();
  const videoItem = useItem(selectedIds[0] || '');
  const videoSettings = useVideoSettings();
  const { updateVideoSettings } = useEditorActions();

  if (!videoSettings || !videoItem) return null;

  return (
    <div className="p-4 space-y-6">

      {/* Horizontal Position */}
      <Section label="Horizontal Pan">
        <div className="flex items-center gap-3">
          <Slider
            value={[videoSettings.cropX]}
            min={0}
            max={100}
            step={1}
            onValueChange={([cropX]) => updateVideoSettings({ cropX })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {videoSettings.cropX}%
          </span>
        </div>
      </Section>

      {/* Vertical Position */}
      <Section label="Vertical Pan">
        <div className="flex items-center gap-3">
          <Slider
            value={[videoSettings.cropY]}
            min={0}
            max={100}
            step={1}
            onValueChange={([cropY]) => updateVideoSettings({ cropY })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {videoSettings.cropY}%
          </span>
        </div>
      </Section>

      <Divider />

      {/* Zoom */}
      <Section label="Zoom">
        <div className="flex items-center gap-3">
          <Slider
            value={[videoSettings.scale * 100]}
            min={100}
            max={200}
            step={5}
            onValueChange={([scale]) => updateVideoSettings({ scale: scale / 100 })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {Math.round(videoSettings.scale * 100)}%
          </span>
        </div>
      </Section>

      {/* Reset button */}
      <button
        onClick={() => updateVideoSettings({ cropX: 50, cropY: 50, scale: 1 })}
        className="w-full py-2 text-sm text-[var(--editor-text-secondary)]
                   hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)]
                   rounded transition-colors"
      >
        Reset to center
      </button>
    </div>
  );
}

// ============================================
// Audio Panel
// ============================================

function AudioPanel() {
  const selectedIds = useSelectedIds();
  const audioItem = useItem(selectedIds[0] || '');
  const { toggleEnhancement, updateItemData } = useEditorActions();

  if (!audioItem || audioItem.type !== 'audio') return null;

  const data = audioItem.data as AudioItemData;
  const isProcessing = data.enhancementStatus === 'processing';
  const isComplete = data.enhancementStatus === 'complete';
  const isError = data.enhancementStatus === 'error';

  return (
    <div className="p-4 space-y-6">
      {/* Enhancement Status */}
      <Section label="Enhancement">
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--editor-accent)] animate-pulse" />
              <span className="text-xs text-[var(--editor-text-secondary)]">
                Enhancing audio... {data.enhancementProgress || 0}%
              </span>
            </div>
            <div className="w-full h-1 bg-[var(--editor-bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--editor-accent)] transition-all duration-300"
                style={{ width: `${data.enhancementProgress || 0}%` }}
              />
            </div>
          </div>
        )}

        {isComplete && (
          <button
            onClick={() => toggleEnhancement(audioItem.id)}
            className={`w-full py-2 px-3 text-sm font-medium rounded-md transition-all ${
              data.isEnhanced
                ? 'bg-[var(--editor-accent)] text-white'
                : 'bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] border border-[var(--editor-border-default)]'
            }`}
          >
            {data.isEnhanced ? 'Enhanced' : 'Use Original'}
          </button>
        )}

        {isError && (
          <div className="py-2 px-3 text-xs text-red-400 bg-red-900/20 rounded-md">
            Enhancement failed. Using original audio.
          </div>
        )}
      </Section>

      <Divider />

      {/* Volume */}
      <Section label="Volume">
        <div className="flex items-center gap-3">
          <Slider
            value={[data.volume * 100]}
            min={0}
            max={200}
            step={1}
            onValueChange={([vol]) => updateItemData(audioItem.id, { volume: vol / 100 })}
            className="flex-1"
          />
          <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
            {Math.round(data.volume * 100)}%
          </span>
        </div>
      </Section>
    </div>
  );
}

// ============================================
// Visual Properties Panel
// ============================================

function VisualPropertiesPanel() {
  const selectedIds = useSelectedIds();
  const visualItem = useItem(selectedIds[0] || '');
  const { updateVisualDisplayMode, updateOverlayOpacity, updateItemData, updateVisualOverlayZone } = useEditorActions();

  // Get all items to find video for segmentation status
  const allItems = useItems();
  const allItemIds = useItemIds();

  if (!visualItem || visualItem.type !== 'visual') return null;

  const data = visualItem.data as VisualItemData;
  const rawDm = data.displayMode;
  const displayMode = (!rawDm || (rawDm as string) === 'pip') ? 'default' : rawDm;
  const overlayOpacity = data.overlayOpacity ?? 0.85;

  // Find first video item for segmentation data
  const videoItem = allItemIds
    .map(id => allItems[id])
    .find(item => item?.type === 'video');
  const videoData = videoItem?.data as VideoItemData | undefined;
  const segmentation = videoData?.segmentation;
  const segmentationReady = segmentation?.status === 'ready';

  // Get overlay zone for this visual
  const overlayZone = (data.overlayZone || 'none') as OverlayZone;

  // Check if this is a template-based visual
  const isYouTubeClip = data.templateId === 'youtube-clip';
  const templateProps = data.templateProps || {};

  const updateTemplateProps = (updates: Record<string, unknown>) => {
    updateItemData(visualItem.id, {
      templateProps: { ...templateProps, ...updates },
    });
  };

  return (
    <div className="p-4 space-y-6">
      <Section label="Display Mode">
        <SegmentedControl
          options={[
            { value: 'default', label: 'Standard' },
            { value: 'fullscreen', label: 'Full' },
            { value: 'overlay', label: 'Overlay' },
          ]}
          value={displayMode}
          onChange={(value) => updateVisualDisplayMode(visualItem.id, value as VisualDisplayMode)}
        />
      </Section>

      <Divider />

      {/* Overlay Zone */}
      <Section label="Overlay Zone">
        <ZoneSelector
          value={overlayZone}
          onChange={(zone) => updateVisualOverlayZone(visualItem.id, zone)}
          segmentationReady={segmentationReady}
        />
      </Section>

      {/* Segmentation Status */}
      {videoItem && (
        <SegmentationStatus segmentation={segmentation} className="mt-2" />
      )}

      {displayMode === 'overlay' && (
        <>
          <Divider />
          <Section label="Overlay Opacity">
            <div className="flex items-center gap-3">
              <Slider
                value={[Math.round(overlayOpacity * 100)]}
                min={20}
                max={100}
                step={5}
                onValueChange={([op]) => updateOverlayOpacity(visualItem.id, op / 100)}
                className="flex-1"
              />
              <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </div>
          </Section>
        </>
      )}

      {/* YouTube Clip Template Properties */}
      {isYouTubeClip && (
        <>
          <Divider />
          <Section label="Clip Timing">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--editor-text-secondary)]">Trim Start</span>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[Number(templateProps.trimStartSeconds) || 0]}
                    min={0}
                    max={60}
                    step={0.5}
                    onValueChange={([v]) => updateTemplateProps({ trimStartSeconds: v })}
                    className="flex-1"
                  />
                  <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
                    {(Number(templateProps.trimStartSeconds) || 0).toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section label="Volume">
            <div className="flex items-center gap-3">
              <Slider
                value={[Math.round((Number(templateProps.volume) ?? 1) * 100)]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => updateTemplateProps({ volume: v / 100 })}
                className="flex-1"
              />
              <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
                {Math.round((Number(templateProps.volume) ?? 1) * 100)}%
              </span>
            </div>
          </Section>

          <Section label="Border">
            <SegmentedControl
              options={[
                { value: 'none', label: 'None' },
                { value: 'thin', label: 'Thin' },
                { value: 'medium', label: 'Med' },
                { value: 'thick', label: 'Thick' },
              ]}
              value={String(templateProps.border || 'none')}
              onChange={(value) => updateTemplateProps({ border: value })}
            />
            {templateProps.border && templateProps.border !== 'none' && (
              <div className="mt-3 flex items-center gap-3">
                <ColorPicker
                  label="Color"
                  value={String(templateProps.borderColor || '#FFFFFF')}
                  onChange={(color) => updateTemplateProps({ borderColor: color })}
                />
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[10px] text-[var(--editor-text-secondary)]">Radius</span>
                  <Slider
                    value={[Number(templateProps.borderRadius) || 0]}
                    min={0}
                    max={50}
                    step={2}
                    onValueChange={([v]) => updateTemplateProps({ borderRadius: v })}
                    className="flex-1"
                  />
                </div>
              </div>
            )}
          </Section>

          <Section label="Frame">
            <SegmentedControl
              options={[
                { value: 'none', label: 'None' },
                { value: 'phone', label: 'Phone' },
                { value: 'browser', label: 'Browser' },
                { value: 'polaroid', label: 'Polaroid' },
              ]}
              value={String(templateProps.frame || 'none')}
              onChange={(value) => updateTemplateProps({ frame: value })}
            />
          </Section>

          <Section label="Shadow">
            <SegmentedControl
              options={[
                { value: 'none', label: 'None' },
                { value: 'subtle', label: 'Subtle' },
                { value: 'medium', label: 'Medium' },
                { value: 'strong', label: 'Strong' },
              ]}
              value={String(templateProps.shadowIntensity || 'none')}
              onChange={(value) => updateTemplateProps({ shadowIntensity: value })}
            />
          </Section>

          <Section label="Transform">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--editor-text-secondary)]">Scale</span>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[(Number(templateProps.scale) || 1) * 100]}
                    min={50}
                    max={150}
                    step={5}
                    onValueChange={([v]) => updateTemplateProps({ scale: v / 100 })}
                    className="flex-1"
                  />
                  <span className="text-xs text-[var(--editor-text-secondary)] w-10 text-right">
                    {Math.round((Number(templateProps.scale) || 1) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section label="Background">
            <ColorPicker
              label="Color"
              value={String(templateProps.backgroundColor || '#000000')}
              onChange={(color) => updateTemplateProps({ backgroundColor: color })}
            />
          </Section>
        </>
      )}
    </div>
  );
}

// ============================================
// Shared Components
// ============================================

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--editor-text-secondary)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
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
              ? 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)] shadow-sm'
              : 'text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({
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
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <input
          type="color"
          value={isTransparent ? '#000000' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-md border border-[var(--editor-border-default)]
                     cursor-pointer bg-transparent appearance-none overflow-hidden"
          style={{ backgroundColor: isTransparent ? 'transparent' : value }}
        />
        {isTransparent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-6 h-0.5 bg-red-500 rotate-45" />
          </div>
        )}
      </div>
      <span className="text-xs text-[var(--editor-text-muted)]">{label}</span>
    </div>
  );
}
