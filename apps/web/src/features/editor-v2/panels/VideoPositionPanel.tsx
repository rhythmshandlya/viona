'use client';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import {
  useVideoSettings,
  useSourceDimensions,
  useProjectActions,
} from '../store/use-editor-store';
import { DEFAULT_VIDEO_SETTINGS } from '../store/types';

export function VideoPositionPanel() {
  const videoSettings = useVideoSettings();
  const sourceDimensions = useSourceDimensions();
  const { updateVideoSettings } = useProjectActions();

  if (!videoSettings || !sourceDimensions) {
    return (
      <div className="p-4 text-zinc-400 text-sm">
        No video loaded.
      </div>
    );
  }

  const sourceAspect = sourceDimensions.width / sourceDimensions.height;
  const canvasAspect = videoSettings.canvasWidth / videoSettings.canvasHeight;
  const isLandscapeSource = sourceAspect > canvasAspect;

  const handleReset = () => {
    updateVideoSettings({
      cropX: DEFAULT_VIDEO_SETTINGS.cropX,
      cropY: DEFAULT_VIDEO_SETTINGS.cropY,
      scale: DEFAULT_VIDEO_SETTINGS.scale,
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Output Format */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400 font-medium">Output Format</label>
        <div className="text-sm text-zinc-300">
          {videoSettings.canvasWidth} x {videoSettings.canvasHeight}
          <span className="text-zinc-500 ml-2">(9:16 Reel)</span>
        </div>
        <div className="text-xs text-zinc-500">
          Source: {sourceDimensions.width} x {sourceDimensions.height}
        </div>
      </div>

      {/* Horizontal Pan (for landscape source) */}
      {isLandscapeSource && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm text-zinc-400 font-medium">Horizontal Position</label>
            <span className="text-sm text-zinc-300">
              {(videoSettings.cropX ?? 50) === 50
                ? 'Center'
                : (videoSettings.cropX ?? 50) < 50
                ? `${50 - (videoSettings.cropX ?? 50)}% Left`
                : `${(videoSettings.cropX ?? 50) - 50}% Right`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-4">L</span>
            <Slider
              value={[videoSettings.cropX ?? 50]}
              min={0}
              max={100}
              step={1}
              onValueChange={([x]) => updateVideoSettings({ cropX: x })}
              className="flex-1 py-2"
            />
            <span className="text-xs text-zinc-500 w-4">R</span>
          </div>
        </div>
      )}

      {/* Vertical Pan (for portrait source) */}
      {!isLandscapeSource && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm text-zinc-400 font-medium">Vertical Position</label>
            <span className="text-sm text-zinc-300">
              {(videoSettings.cropY ?? 50) === 50
                ? 'Center'
                : (videoSettings.cropY ?? 50) < 50
                ? `${50 - (videoSettings.cropY ?? 50)}% Up`
                : `${(videoSettings.cropY ?? 50) - 50}% Down`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-4">T</span>
            <Slider
              value={[videoSettings.cropY ?? 50]}
              min={0}
              max={100}
              step={1}
              onValueChange={([y]) => updateVideoSettings({ cropY: y })}
              className="flex-1 py-2"
            />
            <span className="text-xs text-zinc-500 w-4">B</span>
          </div>
        </div>
      )}

      {/* Zoom */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm text-zinc-400 font-medium">Zoom</label>
          <span className="text-sm text-zinc-300">{Math.round((videoSettings.scale ?? 1) * 100)}%</span>
        </div>
        <Slider
          value={[videoSettings.scale ?? 1]}
          min={1.0}
          max={2.0}
          step={0.05}
          onValueChange={([scale]) => updateVideoSettings({ scale })}
          className="py-2"
        />
      </div>

      {/* Reset Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        className="w-full"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset to Center
      </Button>

      {/* Info */}
      <div className="pt-4 border-t border-zinc-700">
        <p className="text-xs text-zinc-500">
          {isLandscapeSource
            ? 'Your video is landscape. Adjust horizontal position to choose which part is visible.'
            : 'Your video fits the vertical format. Zoom to adjust framing.'}
        </p>
      </div>
    </div>
  );
}
