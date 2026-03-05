'use client';

import React from 'react';
import type { OverlayZone } from '../store/types';

interface ZoneSelectorProps {
  value: OverlayZone;
  onChange: (zone: OverlayZone) => void;
  disabled?: boolean;
  segmentationReady?: boolean;
}

const ZONE_OPTIONS: { value: OverlayZone; label: string; icon: string; description: string }[] = [
  { value: 'none', label: 'None', icon: '⊘', description: 'Use display mode' },
  { value: 'behind', label: 'Behind', icon: '⬛', description: 'Behind speaker' },
  { value: 'lower-third', label: 'Lower', icon: '▂', description: 'Bottom 20%' },
  { value: 'top', label: 'Top', icon: '▔', description: 'Top 15%' },
  { value: 'frame', label: 'Frame', icon: '◻', description: 'Speaker border' },
  { value: 'background', label: 'BG', icon: '▣', description: 'Full background' },
];

export function ZoneSelector({
  value,
  onChange,
  disabled = false,
  segmentationReady = false,
}: ZoneSelectorProps) {
  // Zones that require segmentation to work properly
  const requiresSegmentation = (zone: OverlayZone) =>
    zone === 'behind' || zone === 'frame' || zone === 'background';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {ZONE_OPTIONS.map((option) => {
          const needsSeg = requiresSegmentation(option.value);
          const isDisabled = disabled || (needsSeg && !segmentationReady);

          return (
            <button
              key={option.value}
              onClick={() => !isDisabled && onChange(option.value)}
              disabled={isDisabled}
              title={isDisabled && needsSeg ? 'Requires speaker segmentation' : option.description}
              className={`flex flex-col items-center p-2 rounded-md border transition-all ${
                value === option.value
                  ? 'border-[var(--editor-accent)] bg-[var(--editor-accent-muted)] text-[var(--editor-accent)]'
                  : isDisabled
                    ? 'border-[var(--editor-border-subtle)] bg-[var(--editor-bg-base)] text-[var(--editor-text-muted)] opacity-50 cursor-not-allowed'
                    : 'border-[var(--editor-border-default)] bg-[var(--editor-bg-elevated)] text-[var(--editor-text-secondary)] hover:border-[var(--editor-border-hover)] hover:bg-[var(--editor-bg-hover)]'
              }`}
            >
              <span className="text-base">{option.icon}</span>
              <span className="text-[10px] mt-0.5 font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>
      {!segmentationReady && (
        <p className="text-[10px] text-[var(--editor-text-muted)]">
          Some zones require speaker extraction (processing...)
        </p>
      )}
    </div>
  );
}
