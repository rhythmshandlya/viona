'use client';

import React from 'react';

interface ActivityIndicatorProps {
  percent: number;
  message?: string;
  isActive: boolean;
  error?: boolean;
}

export function ActivityIndicator({ percent, message, isActive, error }: ActivityIndicatorProps) {
  if (!isActive && percent === 0) return null;

  const isDone = percent >= 100 && !error;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 border-b"
      style={{
        borderColor: 'var(--editor-border-default)',
        backgroundColor: 'var(--editor-bg-elevated)',
      }}
    >
      {/* Animated orb */}
      <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
        {isActive && !isDone ? (
          <>
            {/* Pulsing core */}
            <div
              className="absolute rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: error ? '#ef4444' : 'var(--editor-accent)',
                animation: 'activity-pulse 1.5s ease-in-out infinite',
              }}
            />
            {/* Orbiting ring */}
            <div
              className="absolute rounded-full"
              style={{
                width: 14,
                height: 14,
                border: `1.5px solid ${error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                animation: 'activity-orbit 2s linear infinite',
              }}
            />
          </>
        ) : (
          /* Static dot when done */
          <div
            className="rounded-full"
            style={{
              width: 8,
              height: 8,
              backgroundColor: isDone ? '#22c55e' : 'var(--editor-text-muted)',
            }}
          />
        )}
      </div>

      {/* Percentage */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: error ? '#ef4444' : isDone ? '#22c55e' : 'var(--editor-accent)',
          minWidth: 32,
        }}
      >
        {Math.round(percent)}%
      </span>

      {/* Status message */}
      {message && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--editor-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {message}
        </span>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes activity-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @keyframes activity-orbit {
          0% { transform: rotate(0deg); border-top-color: var(--editor-accent); }
          100% { transform: rotate(360deg); border-top-color: var(--editor-accent); }
        }
      `}</style>
    </div>
  );
}
