/**
 * DynamicVisualLoader Component
 * Loads and renders dynamically bundled Remotion compositions
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if already loaded this bundle
    const cacheKey = `${bundleUrl}:${compositionId}`;
    if (loadedRef.current === cacheKey && Component) {
      return;
    }

    async function loadBundle() {
      setLoading(true);
      setError(null);

      try {
        // Dynamic import of the bundle
        // The bundle should export the composition component
        const module = await import(/* webpackIgnore: true */ bundleUrl);

        // Try to find the component by compositionId or use default
        const comp = module[compositionId] || module.default;

        if (!comp) {
          throw new Error(`Composition "${compositionId}" not found in bundle`);
        }

        setComponent(() => comp);
        loadedRef.current = cacheKey;
      } catch (err) {
        console.error('Failed to load visual bundle:', err);
        setError(err instanceof Error ? err.message : 'Failed to load visual');
      } finally {
        setLoading(false);
      }
    }

    loadBundle();
  }, [bundleUrl, compositionId, Component]);

  if (loading) {
    return (
      <AbsoluteFill className={className}>
        <div className="flex items-center justify-center h-full bg-zinc-900/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400 text-sm">Loading visual...</span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (error) {
    return (
      <AbsoluteFill className={className}>
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
      </AbsoluteFill>
    );
  }

  if (!Component) {
    return null;
  }

  return <Component />;
}
