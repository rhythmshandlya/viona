/**
 * DynamicVisualLoader Component
 * Loads Remotion bundles via iframe for preview
 */

'use client';

import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';

interface DynamicVisualLoaderProps {
  bundleUrl: string;
  compositionId: string;
  className?: string;
}

export function DynamicVisualLoader({
  bundleUrl,
  compositionId,
  className,
}: DynamicVisualLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build the full URL to the bundle's index.html
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const iframeSrc = `${apiUrl}${bundleUrl}`;

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError('Failed to load visual bundle');
    setLoading(false);
  };

  return (
    <AbsoluteFill className={className}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400 text-sm">Loading visual...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex items-center justify-center h-full bg-red-900/20">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </div>
      ) : (
        <iframe
          src={iframeSrc}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: 'transparent',
          }}
          allow="autoplay"
          title={`Visual: ${compositionId}`}
        />
      )}
    </AbsoluteFill>
  );
}
