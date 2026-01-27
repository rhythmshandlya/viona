/**
 * ContextPanel Component
 * Sliding panel for editing selected item properties (captions, video position)
 */

'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  useSelectedIds,
  useItem,
  useItems,
  useActiveCaptionStyle,
  useApplyStyleToAll,
  useVideoSettings,
  useEditorActions,
} from '../store/use-editor-store';
import {
  CaptionDisplayMode,
  CaptionAnimationLegacy,
  CaptionStyle,
} from '../store/types';
import { SUBTITLE_PRESETS, PRESET_ORDER } from '@/lib/subtitle-presets';

interface ContextPanelProps {
  onClose: () => void;
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const selectedIds = useSelectedIds();
  const items = useItems();
  const firstSelectedItem = useItem(selectedIds[0] || '');
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Trigger entrance animation
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 200);
    return () => clearTimeout(timer);
  }, [selectedIds[0]]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!firstSelectedItem) return null;

  // Build panel title with multi-selection count
  let panelTitle: string;
  if (selectedIds.length > 1) {
    const allCaptions = selectedIds.every((id) => items[id]?.type === 'caption');
    panelTitle = allCaptions
      ? `${selectedIds.length} captions selected`
      : `${selectedIds.length} items selected`;
  } else {
    panelTitle = firstSelectedItem.type === 'caption' ? 'Caption Style' :
                 firstSelectedItem.type === 'video' ? 'Video Position' :
                 'Properties';
  }

  return (
    <div
      className={`absolute right-0 top-0 h-full w-80 bg-[var(--editor-bg-surface)]
                  border-l border-[var(--editor-border-subtle)] z-50
                  ${isAnimating ? 'editor-panel-enter' : ''}`}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--editor-border-subtle)]">
        <h2 className="text-sm font-medium text-[var(--editor-text-primary)]">
          {panelTitle}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4 text-[var(--editor-text-secondary)]" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100%-48px)]">
        {firstSelectedItem.type === 'caption' && <CaptionStylePanel />}
        {firstSelectedItem.type === 'video' && <VideoPositionPanel />}
      </div>
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
          value={style.animation}
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
                    fontWeight: preset.fontWeight,
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

      {/* Position */}
      <Section label="Position">
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
    </div>
  );
}

// ============================================
// Video Position Panel
// ============================================

function VideoPositionPanel() {
  const videoSettings = useVideoSettings();
  const { updateVideoSettings } = useEditorActions();

  if (!videoSettings) return null;

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
