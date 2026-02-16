'use client';

import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Circle,
  Square,
  RectangleHorizontal,
  CornerLeftUp,
  CornerRightUp,
  CornerLeftDown,
  CornerRightDown,
  Columns,
  Rows,
  PictureInPicture,
  Video,
  Sparkles,
} from 'lucide-react';
import {
  useLayoutSettings,
  useLayoutPresetId,
  useLayoutActions,
} from '../store/use-editor-store';
import {
  LAYOUT_PRESETS,
  PiPPosition,
  PiPShape,
  LayoutMode,
} from '../store/types';
import { cn } from '@/lib/utils';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--editor-text-muted)]">
      {children}
    </span>
  );
}

function FieldLabel({ children, value }: { children: React.ReactNode; value?: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--editor-text-secondary)]">{children}</span>
      {value !== undefined && (
        <span className="text-[11px] tabular-nums text-[var(--editor-text-muted)]">{value}</span>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
  title,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all',
        'border',
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-[var(--editor-bg-surface)] text-[var(--editor-text-secondary)] border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)] hover:text-[var(--editor-text-primary)]',
        className
      )}
    >
      {children}
    </button>
  );
}

export function PiPControlPanel() {
  const layoutSettings = useLayoutSettings();
  const presetId = useLayoutPresetId();
  const { updatePiPSettings, updateSplitSettings, setLayoutPreset, setLayoutMode } = useLayoutActions();
  const { mode, pip, split } = layoutSettings;

  const layoutModes: { value: LayoutMode; icon: React.ReactNode; label: string }[] = [
    { value: 'split-horizontal', icon: <Rows className="w-4 h-4" />, label: 'Split' },
    { value: 'pip', icon: <PictureInPicture className="w-4 h-4" />, label: 'PiP' },
  ];

  const positionOptions: { value: PiPPosition; icon: React.ReactNode; label: string }[] = [
    { value: 'top-left', icon: <CornerLeftUp className="w-3.5 h-3.5" />, label: 'Top Left' },
    { value: 'top-right', icon: <CornerRightUp className="w-3.5 h-3.5" />, label: 'Top Right' },
    { value: 'bottom-left', icon: <CornerLeftDown className="w-3.5 h-3.5" />, label: 'Bottom Left' },
    { value: 'bottom-right', icon: <CornerRightDown className="w-3.5 h-3.5" />, label: 'Bottom Right' },
  ];

  const shapeOptions: { value: PiPShape; icon: React.ReactNode; label: string }[] = [
    { value: 'circle', icon: <Circle className="w-3.5 h-3.5" />, label: 'Circle' },
    { value: 'rounded', icon: <RectangleHorizontal className="w-3.5 h-3.5" />, label: 'Rounded' },
    { value: 'square', icon: <Square className="w-3.5 h-3.5" />, label: 'Square' },
  ];

  const sizeOptions = [
    { value: 'small', label: 'S', size: 18 },
    { value: 'medium', label: 'M', size: 25 },
    { value: 'large', label: 'L', size: 35 },
  ] as const;

  const splitRatios = [
    { label: '30/70', ratio: 30 },
    { label: '50/50', ratio: 50 },
    { label: '70/30', ratio: 70 },
  ];

  return (
    <div className="p-4 space-y-5">
      {/* Layout Mode */}
      <div className="space-y-2">
        <SectionLabel>Layout Mode</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {layoutModes.map((opt) => (
            <ToggleButton
              key={opt.value}
              active={mode === opt.value}
              onClick={() => setLayoutMode(opt.value)}
              title={opt.label}
              className="h-9 px-3"
            >
              {opt.icon}
              <span>{opt.label}</span>
            </ToggleButton>
          ))}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="space-y-2">
        <SectionLabel>Presets</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYOUT_PRESETS.filter(p => p.id !== 'custom').map((preset) => (
            <ToggleButton
              key={preset.id}
              active={presetId === preset.id}
              onClick={() => setLayoutPreset(preset.id)}
              title={preset.description}
              className="h-8 px-2.5 text-[11px]"
            >
              {preset.name}
            </ToggleButton>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--editor-border-subtle)]" />

      {/* Split Mode Controls */}
      {(mode === 'split-horizontal' || mode === 'split-vertical') && (
        <div className="space-y-4">
          <SectionLabel>Split Settings</SectionLabel>

          {/* Direction */}
          <div className="space-y-1.5">
            <FieldLabel>Direction</FieldLabel>
            <div className="grid grid-cols-2 gap-1.5">
              <ToggleButton
                active={mode === 'split-horizontal'}
                onClick={() => setLayoutMode('split-horizontal')}
                className="h-8 px-2"
              >
                <Rows className="w-3.5 h-3.5" />
                <span>Top/Bottom</span>
              </ToggleButton>
              <ToggleButton
                active={mode === 'split-vertical'}
                onClick={() => setLayoutMode('split-vertical')}
                className="h-8 px-2"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Left/Right</span>
              </ToggleButton>
            </div>
          </div>

          {/* Ratio */}
          <div className="space-y-2">
            <FieldLabel value={`${split.ratio}% / ${100 - split.ratio}%`}>
              Ratio
            </FieldLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {splitRatios.map((opt) => (
                <ToggleButton
                  key={opt.ratio}
                  active={split.ratio === opt.ratio}
                  onClick={() => updateSplitSettings({ ratio: opt.ratio })}
                  className="h-7 text-[11px]"
                >
                  {opt.label}
                </ToggleButton>
              ))}
            </div>
            <Slider
              value={[split.ratio]}
              min={20}
              max={80}
              step={5}
              onValueChange={([v]) => updateSplitSettings({ ratio: v })}
              className="pt-1"
            />
          </div>

          {/* Content Order */}
          <div className="space-y-1.5">
            <FieldLabel>{mode === 'split-horizontal' ? 'Top' : 'Left'} Content</FieldLabel>
            <div className="grid grid-cols-2 gap-1.5">
              <ToggleButton
                active={split.position === 'visuals-first'}
                onClick={() => updateSplitSettings({ position: 'visuals-first' })}
                className="h-8 px-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Visuals</span>
              </ToggleButton>
              <ToggleButton
                active={split.position === 'video-first'}
                onClick={() => updateSplitSettings({ position: 'video-first' })}
                className="h-8 px-2"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video</span>
              </ToggleButton>
            </div>
          </div>
        </div>
      )}

      {/* PiP Mode Controls */}
      {mode === 'pip' && (
        <div className="space-y-4">
          <SectionLabel>PiP Settings</SectionLabel>

          {/* Position */}
          <div className="space-y-1.5">
            <FieldLabel>Position</FieldLabel>
            <div className="grid grid-cols-4 gap-1.5">
              {positionOptions.map((opt) => (
                <ToggleButton
                  key={opt.value}
                  active={pip.position === opt.value}
                  onClick={() => updatePiPSettings({ position: opt.value })}
                  title={opt.label}
                  className="h-8"
                >
                  {opt.icon}
                </ToggleButton>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <FieldLabel>Size</FieldLabel>
            <div className="grid grid-cols-4 gap-1.5">
              {sizeOptions.map((opt) => (
                <ToggleButton
                  key={opt.value}
                  active={pip.size === opt.value}
                  onClick={() => updatePiPSettings({ size: opt.value, customSize: opt.size })}
                  className="h-8"
                >
                  {opt.label}
                </ToggleButton>
              ))}
              <ToggleButton
                active={pip.size === 'custom'}
                onClick={() => updatePiPSettings({ size: 'custom' })}
                className="h-8 text-[11px]"
              >
                Custom
              </ToggleButton>
            </div>
            {pip.size === 'custom' && (
              <Slider
                value={[pip.customSize]}
                min={10}
                max={50}
                step={1}
                onValueChange={([v]) => updatePiPSettings({ customSize: v })}
                className="pt-1"
              />
            )}
          </div>

          {/* Shape */}
          <div className="space-y-1.5">
            <FieldLabel>Shape</FieldLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {shapeOptions.map((opt) => (
                <ToggleButton
                  key={opt.value}
                  active={pip.shape === opt.value}
                  onClick={() => updatePiPSettings({ shape: opt.value })}
                  className="h-8"
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </ToggleButton>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="border-t border-[var(--editor-border-subtle)]" />

          <div className="space-y-3">
            <SectionLabel>Style</SectionLabel>

            {/* Border */}
            <div className="space-y-1.5">
              <FieldLabel value={`${pip.borderWidth}px`}>Border</FieldLabel>
              <Slider
                value={[pip.borderWidth]}
                min={0}
                max={6}
                step={1}
                onValueChange={([v]) => updatePiPSettings({ borderWidth: v })}
              />
            </div>

            {/* Corner Radius */}
            {pip.shape === 'rounded' && (
              <div className="space-y-1.5">
                <FieldLabel value={`${pip.borderRadius}px`}>Corners</FieldLabel>
                <Slider
                  value={[pip.borderRadius]}
                  min={0}
                  max={40}
                  step={2}
                  onValueChange={([v]) => updatePiPSettings({ borderRadius: v })}
                />
              </div>
            )}

            {/* Shadow */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--editor-text-secondary)]">Shadow</span>
              <Switch
                checked={pip.shadowEnabled}
                onCheckedChange={(v) => updatePiPSettings({ shadowEnabled: v })}
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1.5">
              <FieldLabel value={`${Math.round(pip.opacity * 100)}%`}>Opacity</FieldLabel>
              <Slider
                value={[pip.opacity]}
                min={0.5}
                max={1}
                step={0.05}
                onValueChange={([v]) => updatePiPSettings({ opacity: v })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="pt-3 border-t border-[var(--editor-border-subtle)]">
        <p className="text-[11px] leading-relaxed text-[var(--editor-text-muted)]">
          {mode === 'pip' && 'Talking head overlays the AI visuals. Customize position, size, and style.'}
          {(mode === 'split-horizontal' || mode === 'split-vertical') && 'Split screen between visuals and video. Adjust the ratio to your preference.'}
        </p>
      </div>
    </div>
  );
}
