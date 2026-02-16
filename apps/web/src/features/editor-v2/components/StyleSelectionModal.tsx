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
    colors: ['#7C3AED', '#eab308', '#22c55e'],
    preview: (
      <div className="w-full h-full bg-amber-100 flex items-center justify-center gap-1">
        <div className="w-3 h-3 bg-violet-500 rounded-full" />
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
  {
    id: 'apple',
    name: 'Apple',
    description: 'Premium minimalism, fade+blur, pure black/white',
    colors: ['#000000', '#ffffff', '#0071e3'],
    preview: (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="w-8 h-8 bg-white rounded-lg" />
      </div>
    ),
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Material Design 3, cards, Google color palette',
    colors: ['#ffffff', '#1a73e8', '#34a853'],
    preview: (
      <div className="w-full h-full bg-white flex items-center justify-center gap-1.5">
        <div className="w-2.5 h-2.5 bg-[#1a73e8] rounded-full" />
        <div className="w-2.5 h-2.5 bg-[#ea4335] rounded-full" />
        <div className="w-2.5 h-2.5 bg-[#fbbc04] rounded-full" />
        <div className="w-2.5 h-2.5 bg-[#34a853] rounded-full" />
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              Visuals Generated!
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Review the generated visuals before adding them to your timeline
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Preview thumbnail */}
            {previewUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
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
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Model</p>
                    <p className="text-sm text-gray-800">{metrics.llmModel}</p>
                  </div>
                )}
                {metrics.durationMs !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="text-sm text-gray-800">
                      {Math.round(metrics.durationMs / 1000)}s
                    </p>
                  </div>
                )}
                {(metrics.inputTokens !== undefined || metrics.outputTokens !== undefined) && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Tokens Used</p>
                    <p className="text-sm text-gray-800">
                      {((metrics.inputTokens ?? 0) + (metrics.outputTokens ?? 0)).toLocaleString()}
                    </p>
                  </div>
                )}
                {metrics.estimatedCostUsd !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Estimated Cost</p>
                    <p className="text-sm text-gray-800">
                      ${metrics.estimatedCostUsd.toFixed(4)}
                    </p>
                  </div>
                )}
                {metrics.filesWritten !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Files Created</p>
                    <p className="text-sm text-gray-800">{metrics.filesWritten}</p>
                  </div>
                )}
                {metrics.screenshotsTaken !== undefined && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Screenshots</p>
                    <p className="text-sm text-gray-800">{metrics.screenshotsTaken}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Generation Failed
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Something went wrong while generating visuals
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Error message */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 whitespace-pre-wrap line-clamp-4">{error}</p>
            </div>

            {/* Retry options */}
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600 mb-3">Try again with a different style:</p>

              {/* Compact style selector */}
              <div className="grid grid-cols-5 gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-md border transition-all',
                      selectedStyle === style.id
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    <div className="w-full aspect-video rounded overflow-hidden border border-gray-200">
                      {style.preview}
                    </div>
                    <span className={cn(
                      'text-xs',
                      selectedStyle === style.id ? 'text-violet-600' : 'text-gray-600'
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
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                // Clear error by triggering a new generation
                handleGenerate();
              }}
              className="bg-violet-500 hover:bg-violet-600 text-white"
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
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white border-gray-200">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-900">Generate AI Visuals</DialogTitle>
          <DialogDescription className="text-gray-500">
            Choose how visuals will appear with your video
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {/* Layout Selection */}
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-gray-700">Layout Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setLayoutMode('pip')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                layoutMode === 'pip'
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <PictureInPicture className={cn(
                'w-6 h-6',
                layoutMode === 'pip' ? 'text-violet-500' : 'text-gray-400'
              )} />
              <div className="text-left">
                <p className={cn(
                  'font-medium text-sm',
                  layoutMode === 'pip' ? 'text-violet-700' : 'text-gray-900'
                )}>
                  Picture-in-Picture
                </p>
                <p className="text-xs text-gray-500">
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
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Rows className={cn(
                'w-6 h-6',
                layoutMode === 'split-horizontal' ? 'text-violet-500' : 'text-gray-400'
              )} />
              <div className="text-left">
                <p className={cn(
                  'font-medium text-sm',
                  layoutMode === 'split-horizontal' ? 'text-violet-700' : 'text-gray-900'
                )}>
                  Split Screen
                </p>
                <p className="text-xs text-gray-500">
                  Visuals top, video bottom
                </p>
              </div>
            </button>
          </div>

          {/* Split ratio slider - only show for split mode */}
          {layoutMode === 'split-horizontal' && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Split Ratio</span>
                <span className="text-gray-700">{splitRatio}% visuals / {100 - splitRatio}% video</span>
              </div>
              <Slider
                value={[splitRatio]}
                min={30}
                max={70}
                step={10}
                onValueChange={([v]) => setSplitRatio(v)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Visuals: {dimensions.width}x{dimensions.height}px
              </p>
            </div>
          )}
        </div>

        {/* Style Selection */}
        <div className="space-y-3 py-2 border-t border-gray-200">
          <label className="text-sm font-medium text-gray-700">Visual Style</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STYLE_OPTIONS.map((style) => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                disabled={isLoading}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                  'hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500',
                  selectedStyle === style.id
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-200 bg-gray-50',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {/* Preview thumbnail */}
                <div className="w-full aspect-video rounded-md overflow-hidden border border-gray-200">
                  {style.preview}
                </div>

                {/* Style name */}
                <span className={cn(
                  'font-medium text-sm',
                  selectedStyle === style.id ? 'text-violet-600' : 'text-gray-900'
                )}>
                  {style.name}
                </span>

                {/* Color swatches */}
                <div className="flex gap-1">
                  {style.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Style Guide Input */}
        <div className="space-y-2 py-2 border-t border-gray-200">
          <label className="text-sm font-medium text-gray-700">Style & Layout Guide (Optional)</label>
          <textarea
            value={styleGuide}
            onChange={(e) => setStyleGuide(e.target.value)}
            disabled={isLoading}
            placeholder="Describe your visual preferences, e.g.: 'Use dark purple theme with geometric shapes', 'Make it feel energetic with fast transitions', 'Include data visualizations for the statistics mentioned'..."
            className={cn(
              'w-full h-24 px-3 py-2 rounded-lg border text-sm resize-none',
              'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            maxLength={2000}
          />
          <p className="text-xs text-gray-500">
            {styleGuide.length}/2000 characters
          </p>
        </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-gray-100 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-violet-500 hover:bg-violet-600 text-white"
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
