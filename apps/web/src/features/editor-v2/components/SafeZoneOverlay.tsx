'use client';

import React from 'react';
import { PLATFORM_SAFE_ZONES } from '../store/types';

interface SafeZoneOverlayProps {
  platform: string;
}

export function SafeZoneOverlay({ platform }: SafeZoneOverlayProps) {
  if (platform === 'none') return null;

  const zone = PLATFORM_SAFE_ZONES[platform] || PLATFORM_SAFE_ZONES['universal'];

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top danger zone */}
      <div
        className="absolute top-0 left-0 right-0 bg-red-500/20 border-b border-red-500/50"
        style={{ height: `${zone.top}%` }}
      />
      {/* Bottom danger zone */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-red-500/20 border-t border-red-500/50"
        style={{ height: `${zone.bottom}%` }}
      />
      {/* Left danger zone */}
      <div
        className="absolute left-0 bg-red-500/10 border-r border-red-500/30"
        style={{
          top: `${zone.top}%`,
          bottom: `${zone.bottom}%`,
          width: `${zone.left}%`,
        }}
      />
      {/* Right danger zone */}
      <div
        className="absolute right-0 bg-red-500/10 border-l border-red-500/30"
        style={{
          top: `${zone.top}%`,
          bottom: `${zone.bottom}%`,
          width: `${zone.right}%`,
        }}
      />
      {/* Safe area indicator */}
      <div
        className="absolute border-2 border-dashed border-green-500/50"
        style={{
          top: `${zone.top}%`,
          bottom: `${zone.bottom}%`,
          left: `${zone.left}%`,
          right: `${zone.right}%`,
        }}
      />
      {/* Label */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-xs text-green-500/80 font-medium px-2 py-0.5 bg-black/40 rounded"
        style={{ top: `calc(${zone.top}% + 4px)` }}
      >
        Safe Zone ({platform})
      </div>
    </div>
  );
}
