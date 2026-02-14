'use client';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Plus,
  Trash2,
} from 'lucide-react';
import {
  useLayoutSettings,
  useLayoutPresetId,
  useLayoutActions,
  useFullscreenSegments,
  useFullscreenSegmentActions,
  useCurrentTimeMs,
} from '../store/use-editor-store';
import {
  LAYOUT_PRESETS,
  PiPPosition,
  PiPShape,
  LayoutMode,
  LayoutPresetId,
} from '../store/types';
import { cn } from '@/lib/utils';

export function PiPControlPanel() {
  const layoutSettings = useLayoutSettings();
  const presetId = useLayoutPresetId();
  const { updatePiPSettings, updateSplitSettings, setLayoutPreset, setLayoutMode } = useLayoutActions();
  const fullscreenSegments = useFullscreenSegments();
  const { addFullscreenSegment, updateFullscreenSegment, removeFullscreenSegment } = useFullscreenSegmentActions();
  const currentTimeMs = useCurrentTimeMs();

  const { mode, pip, split } = layoutSettings;

  // Layout mode options
  const layoutModes: { value: LayoutMode; icon: React.ReactNode; label: string }[] = [
    { value: 'split-horizontal', icon: <Rows className="w-4 h-4" />, label: 'Split' },
    { value: 'pip', icon: <PictureInPicture className="w-4 h-4" />, label: 'PiP' },
  ];

  // PiP position options
  const positionOptions: { value: PiPPosition; icon: React.ReactNode; label: string }[] = [
    { value: 'top-left', icon: <CornerLeftUp className="w-4 h-4" />, label: 'Top Left' },
    { value: 'top-right', icon: <CornerRightUp className="w-4 h-4" />, label: 'Top Right' },
    { value: 'bottom-left', icon: <CornerLeftDown className="w-4 h-4" />, label: 'Bottom Left' },
    { value: 'bottom-right', icon: <CornerRightDown className="w-4 h-4" />, label: 'Bottom Right' },
  ];

  // PiP shape options
  const shapeOptions: { value: PiPShape; icon: React.ReactNode; label: string }[] = [
    { value: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { value: 'rounded', icon: <RectangleHorizontal className="w-4 h-4" />, label: 'Rounded' },
    { value: 'square', icon: <Square className="w-4 h-4" />, label: 'Square' },
  ];

  // PiP size options
  const sizeOptions = [
    { value: 'small', label: 'S', size: 18 },
    { value: 'medium', label: 'M', size: 25 },
    { value: 'large', label: 'L', size: 35 },
  ] as const;

  // Split ratio presets
  const splitRatios = [
    { label: '30/70', ratio: 30 },
    { label: '50/50', ratio: 50 },
    { label: '70/30', ratio: 70 },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Layout Mode Selector */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400">Layout Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          {layoutModes.map((opt) => (
            <Button
              key={opt.value}
              variant={mode === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLayoutMode(opt.value)}
              className={cn(
                'h-10 flex items-center justify-center gap-2',
                mode === opt.value && 'bg-purple-600 hover:bg-purple-700'
              )}
              title={opt.label}
            >
              {opt.icon}
              <span className="text-sm">{opt.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400">Quick Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_PRESETS.filter(p => p.id !== 'custom').map((preset) => (
            <Button
              key={preset.id}
              variant={presetId === preset.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLayoutPreset(preset.id)}
              className={cn(
                'text-xs h-auto py-2 px-2 justify-start',
                presetId === preset.id && 'bg-purple-600 hover:bg-purple-700'
              )}
              title={preset.description}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Split Mode Controls */}
      {(mode === 'split-horizontal' || mode === 'split-vertical') && (
        <div className="space-y-4 pt-2 border-t border-zinc-700">
          <Label className="text-sm text-zinc-400">Split Settings</Label>

          {/* Split Direction */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500">Direction</span>
            <div className="flex gap-2">
              <Button
                variant={mode === 'split-horizontal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLayoutMode('split-horizontal')}
                className={cn(
                  'flex-1 gap-1',
                  mode === 'split-horizontal' && 'bg-purple-600 hover:bg-purple-700'
                )}
              >
                <Rows className="w-4 h-4" />
                Top/Bottom
              </Button>
              <Button
                variant={mode === 'split-vertical' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLayoutMode('split-vertical')}
                className={cn(
                  'flex-1 gap-1',
                  mode === 'split-vertical' && 'bg-purple-600 hover:bg-purple-700'
                )}
              >
                <Columns className="w-4 h-4" />
                Left/Right
              </Button>
            </div>
          </div>

          {/* Split Ratio */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-zinc-500">Visuals / Video Ratio</span>
              <span className="text-xs text-zinc-400">{split.ratio}% / {100 - split.ratio}%</span>
            </div>
            <div className="flex gap-2 mb-2">
              {splitRatios.map((opt) => (
                <Button
                  key={opt.ratio}
                  variant={split.ratio === opt.ratio ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSplitSettings({ ratio: opt.ratio })}
                  className={cn(
                    'flex-1 text-xs',
                    split.ratio === opt.ratio && 'bg-purple-600 hover:bg-purple-700'
                  )}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Slider
              value={[split.ratio]}
              min={20}
              max={80}
              step={5}
              onValueChange={([v]) => updateSplitSettings({ ratio: v })}
              className="py-1"
            />
          </div>

          {/* Which is on top/left */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500">{mode === 'split-horizontal' ? 'Top' : 'Left'} Content</span>
            <div className="flex gap-2">
              <Button
                variant={split.position === 'visuals-first' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSplitSettings({ position: 'visuals-first' })}
                className={cn(
                  'flex-1 gap-1',
                  split.position === 'visuals-first' && 'bg-purple-600 hover:bg-purple-700'
                )}
              >
                <Sparkles className="w-4 h-4" />
                Visuals
              </Button>
              <Button
                variant={split.position === 'video-first' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSplitSettings({ position: 'video-first' })}
                className={cn(
                  'flex-1 gap-1',
                  split.position === 'video-first' && 'bg-purple-600 hover:bg-purple-700'
                )}
              >
                <Video className="w-4 h-4" />
                Video
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PiP Mode Controls */}
      {mode === 'pip' && (
        <div className="space-y-4 pt-2 border-t border-zinc-700">
          <Label className="text-sm text-zinc-400">PiP Settings</Label>

          {/* Position */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500">Position</span>
            <div className="grid grid-cols-4 gap-2">
              {positionOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={pip.position === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updatePiPSettings({ position: opt.value })}
                  className={cn(
                    'h-9 px-2',
                    pip.position === opt.value && 'bg-purple-600 hover:bg-purple-700'
                  )}
                  title={opt.label}
                >
                  {opt.icon}
                </Button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500">Size</span>
            <div className="flex gap-2">
              {sizeOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={pip.size === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updatePiPSettings({ size: opt.value, customSize: opt.size })}
                  className={cn(
                    'flex-1 h-9',
                    pip.size === opt.value && 'bg-purple-600 hover:bg-purple-700'
                  )}
                >
                  {opt.label}
                </Button>
              ))}
              <Button
                variant={pip.size === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updatePiPSettings({ size: 'custom' })}
                className={cn(
                  'flex-1 h-9',
                  pip.size === 'custom' && 'bg-purple-600 hover:bg-purple-700'
                )}
              >
                Custom
              </Button>
            </div>
            {pip.size === 'custom' && (
              <Slider
                value={[pip.customSize]}
                min={10}
                max={50}
                step={1}
                onValueChange={([v]) => updatePiPSettings({ customSize: v })}
                className="py-2"
              />
            )}
          </div>

          {/* Shape */}
          <div className="space-y-2">
            <span className="text-xs text-zinc-500">Shape</span>
            <div className="flex gap-2">
              {shapeOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={pip.shape === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updatePiPSettings({ shape: opt.value })}
                  className={cn(
                    'flex-1 h-9 gap-1',
                    pip.shape === opt.value && 'bg-purple-600 hover:bg-purple-700'
                  )}
                >
                  {opt.icon}
                  <span className="text-xs">{opt.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Advanced: Border & Shadow */}
          <div className="space-y-3 pt-2 border-t border-zinc-700/50">
            <span className="text-xs text-zinc-500">Style</span>

            {/* Border */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Border</span>
                <span className="text-xs text-zinc-400">{pip.borderWidth}px</span>
              </div>
              <Slider
                value={[pip.borderWidth]}
                min={0}
                max={6}
                step={1}
                onValueChange={([v]) => updatePiPSettings({ borderWidth: v })}
                className="py-1"
              />
            </div>

            {/* Corner Radius (for rounded) */}
            {pip.shape === 'rounded' && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-zinc-500">Corners</span>
                  <span className="text-xs text-zinc-400">{pip.borderRadius}px</span>
                </div>
                <Slider
                  value={[pip.borderRadius]}
                  min={0}
                  max={40}
                  step={2}
                  onValueChange={([v]) => updatePiPSettings({ borderRadius: v })}
                  className="py-1"
                />
              </div>
            )}

            {/* Shadow */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Shadow</span>
              <Switch
                checked={pip.shadowEnabled}
                onCheckedChange={(v) => updatePiPSettings({ shadowEnabled: v })}
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Opacity</span>
                <span className="text-xs text-zinc-400">{Math.round(pip.opacity * 100)}%</span>
              </div>
              <Slider
                value={[pip.opacity]}
                min={0.5}
                max={1}
                step={0.05}
                onValueChange={([v]) => updatePiPSettings({ opacity: v })}
                className="py-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Segments */}
      <div className="space-y-3 pt-4 border-t border-zinc-700">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-zinc-400">Fullscreen Segments</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 gap-1"
            onClick={() => {
              const startMs = currentTimeMs;
              const endMs = startMs + 5000;
              addFullscreenSegment({ startMs, endMs });
            }}
          >
            <Plus className="w-3 h-3" />
            Add
          </Button>
        </div>

        {fullscreenSegments.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No fullscreen segments. Add one to show the video full-screen (hiding visuals) during specific time ranges.
          </p>
        ) : (
          <div className="space-y-2">
            {fullscreenSegments.map((seg) => (
              <div key={seg.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-md p-2">
                <div className="flex-1 flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={parseFloat((seg.startMs / 1000).toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        updateFullscreenSegment(seg.id, { startMs: Math.round(val * 1000) });
                      }
                    }}
                    className="h-7 w-20 text-xs text-center bg-zinc-900 border-zinc-700"
                  />
                  <span className="text-xs text-zinc-500">to</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={parseFloat((seg.endMs / 1000).toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        updateFullscreenSegment(seg.id, { endMs: Math.round(val * 1000) });
                      }
                    }}
                    className="h-7 w-20 text-xs text-center bg-zinc-900 border-zinc-700"
                  />
                  <span className="text-xs text-zinc-500">s</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                  onClick={() => removeFullscreenSegment(seg.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-4 border-t border-zinc-700">
        <p className="text-xs text-zinc-500">
          {mode === 'pip' && 'Talking head overlays the AI visuals. Customize position, size, and style.'}
          {(mode === 'split-horizontal' || mode === 'split-vertical') && 'Split screen between visuals and video. Adjust the ratio to your preference.'}
        </p>
      </div>
    </div>
  );
}
