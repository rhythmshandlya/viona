/**
 * CanvasFormatSelector Component
 * Dropdown to switch between canvas aspect ratios (9:16, 16:9, 1:1, 4:5)
 */

'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProject, useProjectActions } from '../store/use-editor-store';

interface CanvasFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
  description: string;
}

const CANVAS_FORMATS: CanvasFormat[] = [
  { id: '9:16', name: 'Vertical', width: 1080, height: 1920, aspectRatio: '9:16', description: 'Reels / TikTok / Shorts' },
  { id: '16:9', name: 'Landscape', width: 1920, height: 1080, aspectRatio: '16:9', description: 'YouTube / Ads' },
  { id: '1:1', name: 'Square', width: 1080, height: 1080, aspectRatio: '1:1', description: 'Instagram / Ads' },
  { id: '4:5', name: 'Portrait', width: 1080, height: 1350, aspectRatio: '4:5', description: 'Instagram Portrait' },
];

function getCurrentFormat(width: number, height: number): CanvasFormat {
  const match = CANVAS_FORMATS.find(f => f.width === width && f.height === height);
  return match || CANVAS_FORMATS[0];
}

export function CanvasFormatSelector() {
  const project = useProject();
  const { updateVideoSettings } = useProjectActions();

  if (!project) return null;

  const current = getCurrentFormat(
    project.videoSettings.canvasWidth,
    project.videoSettings.canvasHeight
  );

  const handleSelect = (format: CanvasFormat) => {
    updateVideoSettings({
      canvasWidth: format.width,
      canvasHeight: format.height,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                     text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)]
                     hover:bg-[var(--editor-bg-hover)] transition-colors"
          title="Canvas format"
        >
          {/* Aspect ratio thumbnail */}
          <div
            className="border border-current rounded-sm"
            style={{
              width: current.width > current.height ? 16 : Math.round(16 * current.width / current.height),
              height: current.height > current.width ? 16 : Math.round(16 * current.height / current.width),
            }}
          />
          <span>{current.aspectRatio}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 bg-[var(--editor-bg-surface)] border border-[var(--editor-border-default)] shadow-lg"
      >
        {CANVAS_FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.id}
            onClick={() => handleSelect(format)}
            className={`flex items-center gap-3 text-[var(--editor-text-primary)] focus:bg-[var(--editor-bg-hover)] ${
              format.id === current.id ? 'bg-[var(--editor-bg-hover)]' : ''
            }`}
          >
            {/* Aspect ratio preview */}
            <div
              className="border border-[var(--editor-text-muted)] rounded-sm flex-shrink-0"
              style={{
                width: format.width > format.height ? 20 : Math.round(20 * format.width / format.height),
                height: format.height > format.width ? 20 : Math.round(20 * format.height / format.width),
              }}
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {format.name} ({format.aspectRatio})
              </span>
              <span className="text-xs text-[var(--editor-text-muted)]">
                {format.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
