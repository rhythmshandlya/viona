/**
 * Animation Placement Modal
 * Simplified modal for creating SVG animations from images
 */

'use client';

import React, { useState } from 'react';
import { Pencil, Move, Sparkles, Zap, Minimize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnimationType, AnimationStyle } from '@/lib/api';

interface AnimationPlacementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  isSubmitting: boolean;
  onSubmit: (options: {
    animationType: AnimationType;
    animationStyle: AnimationStyle;
    durationSeconds: number;
  }) => void;
}

const ANIMATION_TYPES = [
  {
    id: 'draw' as AnimationType,
    name: 'Draw / Reveal',
    description: 'Paths draw themselves like hand-drawn',
    icon: Pencil,
  },
  {
    id: 'motion' as AnimationType,
    name: 'Motion',
    description: 'Elements animate in with movement',
    icon: Move,
  },
];

const ANIMATION_STYLES = [
  {
    id: 'elegant' as AnimationStyle,
    name: 'Elegant',
    description: 'Smooth, refined animations',
    icon: Sparkles,
  },
  {
    id: 'playful' as AnimationStyle,
    name: 'Playful',
    description: 'Bouncy, energetic movements',
    icon: Zap,
  },
  {
    id: 'minimal' as AnimationStyle,
    name: 'Minimal',
    description: 'Simple, subtle transitions',
    icon: Minimize2,
  },
];

export function AnimationPlacementModal({
  open,
  onOpenChange,
  imageFile,
  imagePreviewUrl,
  isSubmitting,
  onSubmit,
}: AnimationPlacementModalProps) {
  const [animationType, setAnimationType] = useState<AnimationType>('motion');
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('elegant');
  const [durationSeconds, setDurationSeconds] = useState(3);

  const handleSubmit = () => {
    onSubmit({
      animationType,
      animationStyle,
      durationSeconds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Create Animation</DialogTitle>
          <DialogDescription className="text-gray-500">
            Convert your image to an animated SVG
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Image Preview */}
          {imagePreviewUrl && (
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={imagePreviewUrl}
                  alt="Selected image"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Animation Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Animation Type</label>
            <div className="grid grid-cols-2 gap-3">
              {ANIMATION_TYPES.map(({ id, name, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAnimationType(id)}
                  disabled={isSubmitting}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    animationType === id
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                    isSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon className={cn(
                    'w-6 h-6',
                    animationType === id ? 'text-violet-500' : 'text-gray-400'
                  )} />
                  <div className="text-center">
                    <p className={cn(
                      'font-medium text-sm',
                      animationType === id ? 'text-violet-700' : 'text-gray-900'
                    )}>
                      {name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Animation Style */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Style</label>
            <div className="grid grid-cols-3 gap-2">
              {ANIMATION_STYLES.map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAnimationStyle(id)}
                  disabled={isSubmitting}
                  className={cn(
                    'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border-2 text-sm transition-all',
                    animationStyle === id
                      ? 'border-violet-500 bg-violet-50 text-violet-600'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300',
                    isSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Duration</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value))}
                disabled={isSubmitting}
                className="flex-1 accent-violet-500"
              />
              <span className="text-sm text-gray-600 w-12 text-right">
                {durationSeconds}s
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-100 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !imageFile}
            className="bg-violet-500 hover:bg-violet-600 text-white"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Animation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
