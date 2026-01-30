/**
 * DynamicVisualLoader Component
 * Loads and executes dynamically generated Remotion compositions
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Remotion from 'remotion';
import { AbsoluteFill } from 'remotion';

interface DynamicVisualLoaderProps {
  bundleUrl: string;
  compositionId: string;
  className?: string;
}

// Module cache to avoid re-fetching
const moduleCache = new Map<string, React.ComponentType>();

export function DynamicVisualLoader({
  bundleUrl,
  compositionId,
  className,
}: DynamicVisualLoaderProps) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  // Build composition URL - use .cjs.js for CommonJS format
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Convert bundle URL from index.html to composition.cjs.js
  const compositionUrl = bundleUrl.replace('/index.html', '/composition.cjs.js');
  const fullUrl = `${apiUrl}${compositionUrl}`;

  const loadComposition = useCallback(async () => {
    const cacheKey = `${compositionUrl}:${compositionId}`;

    // Check cache
    if (moduleCache.has(cacheKey)) {
      setComponent(() => moduleCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    // Skip if already loading this
    if (loadedRef.current === cacheKey) {
      return;
    }
    loadedRef.current = cacheKey;

    setLoading(true);
    setError(null);

    try {
      // Fetch the CommonJS module code
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch composition: ${response.status}`);
      }
      const code = await response.text();

      // Create a custom require function that provides React and Remotion
      const customRequire = (moduleName: string) => {
        if (moduleName === 'react') return React;
        if (moduleName === 'remotion') return Remotion;
        throw new Error(`Unknown module: ${moduleName}`);
      };

      // Create module and exports objects
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };

      // Execute the CommonJS module
      // eslint-disable-next-line no-new-func
      const moduleFunction = new Function(
        'module',
        'exports',
        'require',
        code
      );
      moduleFunction(moduleObj, moduleObj.exports, customRequire);

      // Find the composition component - try various export names
      const exports = moduleObj.exports;
      const compName = compositionId.replace(/-/g, '_');
      const pascalName = compName
        .split('_')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('');

      const CompositionComponent = (
        exports[pascalName] ||
        exports[compName] ||
        exports.default ||
        Object.values(exports).find(v => typeof v === 'function')
      ) as React.ComponentType | undefined;

      if (!CompositionComponent) {
        throw new Error(`Composition component not found. Exports: ${Object.keys(exports).join(', ')}`);
      }

      // Cache and set
      moduleCache.set(cacheKey, CompositionComponent);
      setComponent(() => CompositionComponent);

    } catch (err) {
      console.error('Failed to load composition:', err);
      setError(err instanceof Error ? err.message : 'Failed to load visual');
    } finally {
      setLoading(false);
    }
  }, [fullUrl, compositionId, compositionUrl]);

  useEffect(() => {
    loadComposition();
  }, [loadComposition]);

  if (loading) {
    return (
      <AbsoluteFill className={className}>
        <div className="flex items-center justify-center h-full bg-zinc-900/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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

  // Render the composition directly - it will use Remotion hooks
  return <Component />;
}
