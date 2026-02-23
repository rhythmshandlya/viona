/**
 * DynamicVisualLoader Component
 * Loads and executes dynamically generated Remotion compositions
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Remotion from 'remotion';
import { AbsoluteFill } from 'remotion';
import * as RemotionNoise from '@remotion/noise';
import * as RemotionShapes from '@remotion/shapes';
import * as RemotionPaths from '@remotion/paths';
import * as RemotionThree from '@remotion/three';

interface DynamicVisualLoaderProps {
  bundleUrl: string;
  compositionId: string;
  className?: string;
  version?: number; // Cache-busting version, change to force reload
}

// Module cache to avoid re-fetching
const moduleCache = new Map<string, React.ComponentType>();

// Cache version - incremented when cache is cleared to bust browser cache
let cacheVersion = Date.now();

// Clear cache for a specific composition or all compositions
export function clearVisualCache(compositionId?: string) {
  // Update cache version to bust browser cache
  cacheVersion = Date.now();

  if (compositionId) {
    // Clear entries matching this composition
    for (const key of moduleCache.keys()) {
      if (key.includes(compositionId)) {
        moduleCache.delete(key);
      }
    }
  } else {
    // Clear all
    moduleCache.clear();
  }
}

// Get current cache version for URL busting
export function getCacheVersion() {
  return cacheVersion;
}

export function DynamicVisualLoader({
  bundleUrl,
  compositionId,
  className,
  version = 0,
}: DynamicVisualLoaderProps) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  // Build composition URL - use .cjs.js for CommonJS format
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Convert bundle URL from index.html to composition.cjs.js
  const compositionUrl = bundleUrl.replace('/index.html', '/composition.cjs.js');
  // Add version to bust browser cache when edits are made
  const urlVersion = version || cacheVersion;
  const fullUrl = `${apiUrl}${compositionUrl}?v=${urlVersion}`;

  const loadComposition = useCallback(async () => {
    const cacheKey = `${compositionUrl}:${compositionId}:${urlVersion}`;

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

      // Create a custom require function that provides React, Remotion, and Remotion packages
      const customRequire = (moduleName: string) => {
        if (moduleName === 'react') return React;
        if (moduleName === 'react/jsx-runtime') {
          // Provide JSX runtime for React 17+ JSX transform
          // IMPORTANT: jsx/jsxs signature is (type, props, key) NOT (type, props, ...children)
          // We need to move the key from the 3rd argument into props
          const jsx = (type: any, props: any, key?: string) => {
            // Handle children arrays by adding keys to prevent warnings
            if (props?.children && Array.isArray(props.children)) {
              props = {
                ...props,
                children: props.children.map((child: any, i: number) => {
                  if (React.isValidElement(child) && child.key === null) {
                    return React.cloneElement(child, { key: `auto-${i}` });
                  }
                  return child;
                }),
              };
            }
            // Fix shorthand/longhand CSS conflicts from generated code
            if (props?.style) {
              const s = props.style;
              if (s.textDecoration && (s.textDecorationColor || s.textDecorationStyle || s.textDecorationThickness)) {
                const { textDecoration, ...rest } = s;
                props = { ...props, style: { textDecorationLine: textDecoration, ...rest } };
              }
            }
            if (key !== undefined) {
              return React.createElement(type, { ...props, key });
            }
            return React.createElement(type, props);
          };
          return {
            jsx,
            jsxs: jsx,
            Fragment: React.Fragment,
          };
        }
        if (moduleName === 'react/jsx-dev-runtime') {
          // Dev runtime - jsxDEV has signature (type, props, key, isStatic, source, self)
          const jsxDEV = (type: any, props: any, key?: string) => {
            // Handle children arrays by adding keys to prevent warnings
            if (props?.children && Array.isArray(props.children)) {
              props = {
                ...props,
                children: props.children.map((child: any, i: number) => {
                  if (React.isValidElement(child) && child.key === null) {
                    return React.cloneElement(child, { key: `auto-${i}` });
                  }
                  return child;
                }),
              };
            }
            // Fix shorthand/longhand CSS conflicts from generated code
            if (props?.style) {
              const s = props.style;
              if (s.textDecoration && (s.textDecorationColor || s.textDecorationStyle || s.textDecorationThickness)) {
                const { textDecoration, ...rest } = s;
                props = { ...props, style: { textDecorationLine: textDecoration, ...rest } };
              }
            }
            if (key !== undefined) {
              return React.createElement(type, { ...props, key });
            }
            return React.createElement(type, props);
          };
          return {
            jsxDEV,
            Fragment: React.Fragment,
          };
        }
        if (moduleName === 'remotion') {
          // Provide Remotion with Composition as a no-op
          // <Composition> is a config component for Root.tsx, not meant for rendering
          // When encountered inside a Player, it should just return null
          //
          // Override staticFile to resolve assets from the API bundle directory
          // instead of the browser origin. Generated code calls staticFile('assets/images/foo.jpg')
          // which Remotion resolves to /assets/images/foo.jpg (localhost:3000), but the actual
          // files live in the bundle's public/ dir served from the API server.
          const bundleBasePath = bundleUrl.replace('/index.html', '');
          const customStaticFile = (relativePath: string) => {
            const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
            return `${apiUrl}${bundleBasePath}/public/${cleanPath}`;
          };
          return {
            ...Remotion,
            Composition: () => null,
            staticFile: customStaticFile,
          };
        }
        // Remotion sub-packages used by generated compositions
        if (moduleName === '@remotion/noise') return RemotionNoise;
        if (moduleName === '@remotion/shapes') return RemotionShapes;
        if (moduleName === '@remotion/paths') return RemotionPaths;
        if (moduleName === '@remotion/three') return RemotionThree;
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

      // Priority order for finding the right component:
      // 1. MainComposition - the standard visual entry point
      // 2. PascalCase version of compositionId
      // 3. underscore version of compositionId
      // 4. default export
      // 5. Any function export (excluding Root which is config)
      const CompositionComponent = (
        exports.MainComposition ||
        exports[pascalName] ||
        exports[compName] ||
        exports.default ||
        Object.entries(exports)
          .filter(([name]) => name !== 'Root' && name !== 'RemotionRoot')
          .map(([, v]) => v)
          .find(v => typeof v === 'function')
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
  }, [fullUrl, compositionId, compositionUrl, urlVersion]);

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
