'use client';

import React from 'react';
import type { SegmentationData } from '../store/types';

interface SegmentationStatusProps {
  segmentation?: SegmentationData;
  className?: string;
}

export function SegmentationStatus({ segmentation, className = '' }: SegmentationStatusProps) {
  if (!segmentation) {
    return (
      <div className={className}>
        <span className="text-xs text-[var(--editor-text-muted)]">No speaker data</span>
      </div>
    );
  }

  const { status, progress = 0, error } = segmentation;

  if (status === 'ready') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-green-400">Speaker extracted</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-red-400">Extraction failed</span>
        </div>
        {error && (
          <p className="text-[10px] text-red-300 mt-1 opacity-75">{error}</p>
        )}
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-[var(--editor-accent)] animate-pulse" />
          <span className="text-xs text-[var(--editor-text-secondary)]">
            Extracting speaker... {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 bg-[var(--editor-bg-elevated)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--editor-accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Pending
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="w-2 h-2 rounded-full bg-[var(--editor-text-muted)]" />
      <span className="text-xs text-[var(--editor-text-muted)]">Queued for extraction</span>
    </div>
  );
}
