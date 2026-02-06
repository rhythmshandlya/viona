/**
 * StyleSelectionModal Component
 * Modal for selecting visual style preset before generating AI visuals
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { StylePreset, GenerateVisualsOptions, VisualsLayoutMode } from '@/lib/api';
import { Sparkles, AlertTriangle, Rows, PictureInPicture } from 'lucide-react';

interface StyleOption {
  id: StylePreset;
  name: string;
  description: string;
  colors: string[];
  preview: React.ReactNode;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean lines, whitespace, monochrome with single accent',
    colors: ['#1a1a1a', '#ffffff', '#3b82f6'],
    preview: (
      <div className="w-full h-full bg-white flex items-center justify-center">
        <div className="w-12 h-1 bg-zinc-900 rounded" />
      </div>
    ),
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Gradients, rounded corners, vibrant colors',
    colors: ['#6366f1', '#8b5cf6', '#06b6d4'],
    preview: (
      <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center">
        <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl" />
      </div>
    ),
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Bright colors, bouncy animations, friendly feel',
    colors: ['#f97316', '#eab308', '#22c55e'],
    preview: (
      <div className="w-full h-full bg-amber-100 flex items-center justify-center gap-1">
        <div className="w-3 h-3 bg-orange-500 rounded-full" />
        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
        <div className="w-3 h-3 bg-green-500 rounded-full" />
      </div>
    ),
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High contrast, large text, dramatic impact',
    colors: ['#000000', '#ffffff', '#ef4444'],
    preview: (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <span className="text-white font-black text-lg">AB</span>
      </div>
    ),
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional charts, serif fonts, professional tones',
    colors: ['#1e3a5f', '#d4af37', '#f5f5dc'],
    preview: (
      <div className="w-full h-full bg-[#f5f5dc] flex items-end justify-center gap-1 p-2">
        <div className="w-2 h-4 bg-[#1e3a5f]" />
        <div className="w-2 h-6 bg-[#1e3a5f]" />
        <div className="w-2 h-8 bg-[#d4af37]" />
        <div className="w-2 h-5 bg-[#1e3a5f]" />
      </div>
    ),
  },
];

interface JobMetrics {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  durationMs?: number;
  llmModel?: string;
  filesWritten?: number;
  screenshotsTaken?: number;
}

interface StyleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (options: GenerateVisualsOptions) => void;
  onCancel?: () => void;
  onConfirmAdd?: () => void; // Called when user confirms adding to timeline
  isLoading?: boolean;
  progress?: number;
  status?: string;
  error?: string | null;
  isComplete?: boolean; // Show preview/confirmation view
  metrics?: JobMetrics | null;
  previewUrl?: string | null; // URL to preview image if available
  canvasWidth?: number;  // From project settings
  canvasHeight?: number; // From project settings
}

// Calculate visuals dimensions based on layout
function calculateVisualsDimensions(
  canvasWidth: number,
  canvasHeight: number,
  layoutMode: VisualsLayoutMode,
  splitRatio: number
): { width: number; height: number } {
  if (layoutMode === 'pip') {
    // PiP: visuals take full canvas
    return { width: canvasWidth, height: canvasHeight };
  } else if (layoutMode === 'split-horizontal') {
    // Horizontal split: visuals get top portion based on ratio
    const visualsHeight = Math.round(canvasHeight * (splitRatio / 100));
    return { width: canvasWidth, height: visualsHeight };
  } else {
    // Vertical split: visuals get left portion based on ratio
    const visualsWidth = Math.round(canvasWidth * (splitRatio / 100));
    return { width: visualsWidth, height: canvasHeight };
  }
}

export function StyleSelectionModal({
  open,
  onOpenChange,
  onSelect,
  onCancel,
  onConfirmAdd,
  isLoading = false,
  progress = 0,
  status = '',
  error = null,
  isComplete = false,
  metrics = null,
  previewUrl = null,
  canvasWidth = 1080,
  canvasHeight = 1920,
}: StyleSelectionModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<StylePreset>('modern');
  const [layoutMode, setLayoutMode] = useState<VisualsLayoutMode>('pip');
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for visuals
  const [styleGuide, setStyleGuide] = useState('');

  const dimensions = calculateVisualsDimensions(canvasWidth, canvasHeight, layoutMode, splitRatio);

  const handleGenerate = () => {
    onSelect({
      stylePreset: selectedStyle,
      layoutMode,
      dimensions,
      styleGuide: styleGuide.trim() || undefined,
    });
  };

  // Don't show modal during loading - progress is shown in JobLogsPanel
  if (isLoading) {
    return null;
  }

  // Show success/preview view when generation is complete
  if (isComplete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-500" />
              Visuals Generated!
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Review the generated visuals before adding them to your timeline
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Preview thumbnail */}
            {previewUrl && (
              <div className="rounded-lg overflow-hidden border border-zinc-700">
                <img
                  src={previewUrl}
                  alt="Generated visual preview"
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Metrics display */}
            {metrics && (
              <div className="grid grid-cols-2 gap-3">
                {metrics.llmModel && (
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Model</p>
                    <p className="text-sm text-zinc-200">{metrics.llmModel}</p>
                  </div>
                )}
                {metrics.durationMs !== undefined && (
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Duration</p>
                    <p className="text-sm text-zinc-200">
                      {Math.round(metrics.durationMs / 1000)}s
                    </p>
                  </div>
                )}
                {(metrics.inputTokens !== undefined || metrics.outputTokens !== undefined) && (
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Tokens Used</p>
                    <p className="text-sm text-zinc-200">
                      {((metrics.inputTokens ?? 0) + (metrics.outputTokens ?? 0)).toLocaleString()}
                    </p>
                  </div>
                )}
                {metrics.estimatedCostUsd !== undefined && (
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Estimated Cost</p>
                    <p className="text-sm text-zinc-200">
                      ${metrics.estimatedCostUsd.toFixed(4)}
                    </p>
                  </div>
                )}
                {metrics.filesWritten !== undefined && (
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Files Created</p>
                    <p className="text-sm text-zinc-200">{metrics.filesWritten}</p>
                  </div>
                )}
                {metrics.screenshotsTaken !== undefined && (
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Screenshots</p>
                    <p className="text-sm text-zinc-200">{metrics.screenshotsTaken}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Discard
            </Button>
            <Button
              onClick={onConfirmAdd}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Add to Timeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error view if there was an error
  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Generation Failed
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Something went wrong while generating visuals
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Error message */}
            <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg">
              <p className="text-sm text-red-300 whitespace-pre-wrap line-clamp-4">{error}</p>
            </div>

            {/* Retry options */}
            <div className="border-t border-zinc-800 pt-4">
              <p className="text-sm text-zinc-400 mb-3">Try again with a different style:</p>

              {/* Compact style selector */}
              <div className="grid grid-cols-5 gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-md border transition-all',
                      selectedStyle === style.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    )}
                  >
                    <div className="w-full aspect-video rounded overflow-hidden border border-zinc-700">
                      {style.preview}
                    </div>
                    <span className={cn(
                      'text-xs',
                      selectedStyle === style.id ? 'text-blue-400' : 'text-zinc-400'
                    )}>
                      {style.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                // Clear error by triggering a new generation
                handleGenerate();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white">Generate AI Visuals</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose how visuals will appear with your video
          </DialogDescription>
        </DialogHeader>

        {/* Layout Selection */}
        <div className="space-y-3 py-2">
          <label className="text-sm font-medium text-zinc-300">Layout Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setLayoutMode('pip')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                layoutMode === 'pip'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <PictureInPicture className={cn(
                'w-6 h-6',
                layoutMode === 'pip' ? 'text-purple-400' : 'text-zinc-400'
              )} />
              <div className="text-left">
                <p className={cn(
                  'font-medium text-sm',
                  layoutMode === 'pip' ? 'text-purple-300' : 'text-white'
                )}>
                  Picture-in-Picture
                </p>
                <p className="text-xs text-zinc-500">
                  Full-screen visuals, video overlay
                </p>
              </div>
            </button>
            <button
              onClick={() => setLayoutMode('split-horizontal')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                layoutMode === 'split-horizontal'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Rows className={cn(
                'w-6 h-6',
                layoutMode === 'split-horizontal' ? 'text-purple-400' : 'text-zinc-400'
              )} />
              <div className="text-left">
                <p className={cn(
                  'font-medium text-sm',
                  layoutMode === 'split-horizontal' ? 'text-purple-300' : 'text-white'
                )}>
                  Split Screen
                </p>
                <p className="text-xs text-zinc-500">
                  Visuals top, video bottom
                </p>
              </div>
            </button>
          </div>

          {/* Split ratio slider - only show for split mode */}
          {layoutMode === 'split-horizontal' && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Split Ratio</span>
                <span className="text-zinc-300">{splitRatio}% visuals / {100 - splitRatio}% video</span>
              </div>
              <Slider
                value={[splitRatio]}
                min={30}
                max={70}
                step={10}
                onValueChange={([v]) => setSplitRatio(v)}
                disabled={isLoading}
              />
              <p className="text-xs text-zinc-500">
                Visuals: {dimensions.width}x{dimensions.height}px
              </p>
            </div>
          )}
        </div>

        {/* Style Selection */}
        <div className="space-y-3 py-2 border-t border-zinc-800">
          <label className="text-sm font-medium text-zinc-300">Visual Style</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STYLE_OPTIONS.map((style) => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                disabled={isLoading}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                  'hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500',
                  selectedStyle === style.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-zinc-700 bg-zinc-800/50',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {/* Preview thumbnail */}
                <div className="w-full aspect-video rounded-md overflow-hidden border border-zinc-700">
                  {style.preview}
                </div>

                {/* Style name */}
                <span className={cn(
                  'font-medium text-sm',
                  selectedStyle === style.id ? 'text-purple-400' : 'text-white'
                )}>
                  {style.name}
                </span>

                {/* Color swatches */}
                <div className="flex gap-1">
                  {style.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-zinc-600"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Style Guide Input */}
        <div className="space-y-2 py-2 border-t border-zinc-800">
          <label className="text-sm font-medium text-zinc-300">Style & Layout Guide (Optional)</label>
          <textarea
            value={styleGuide}
            onChange={(e) => setStyleGuide(e.target.value)}
            disabled={isLoading}
            placeholder="Describe your visual preferences, e.g.: 'Use dark purple theme with geometric shapes', 'Make it feel energetic with fast transitions', 'Include data visualizations for the statistics mentioned'..."
            className={cn(
              'w-full h-24 px-3 py-2 rounded-lg border text-sm resize-none',
              'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            maxLength={2000}
          />
          <p className="text-xs text-zinc-500">
            {styleGuide.length}/2000 characters
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Generating...
              </>
            ) : (
              'Generate Visuals'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
