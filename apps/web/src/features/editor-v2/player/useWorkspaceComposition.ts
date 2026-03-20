'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Remotion from 'remotion';
import * as RemotionNoise from '@remotion/noise';
import * as RemotionShapes from '@remotion/shapes';
import * as RemotionPaths from '@remotion/paths';
import { FONT_REGISTRY, loadFont } from '@/lib/font-registry';

// ---------------------------------------------------------------------------
// Composition cache
// ---------------------------------------------------------------------------
const compositionCache = new Map<string, React.ComponentType<any>>();

export function clearCompositionCache() {
  compositionCache.clear();
}

// ---------------------------------------------------------------------------
// Lazy-loaded @remotion/three (heavy 3D package)
// ---------------------------------------------------------------------------
let _remotionThree: typeof import('@remotion/three') | null = null;

async function getRemotionThree() {
  if (!_remotionThree) {
    try {
      _remotionThree = await import('@remotion/three');
    } catch {
      _remotionThree = {} as any;
    }
  }
  return _remotionThree;
}

// ---------------------------------------------------------------------------
// JSX helpers — CSS textDecoration shorthand fix + auto-keys
// ---------------------------------------------------------------------------

function fixProps(props: any): any {
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
  if (props?.style) {
    const s = props.style;
    if (
      s.textDecoration &&
      (s.textDecorationColor || s.textDecorationStyle || s.textDecorationThickness)
    ) {
      const { textDecoration, ...rest } = s;
      props = { ...props, style: { textDecorationLine: textDecoration, ...rest } };
    }
  }
  return props;
}

function makeJsx() {
  const jsx = (type: any, props: any, key?: string) => {
    props = fixProps(props);
    if (key !== undefined) {
      return React.createElement(type, { ...props, key });
    }
    return React.createElement(type, props);
  };
  return jsx;
}

// ---------------------------------------------------------------------------
// Resolve the public base URL from a bundle URL
// ---------------------------------------------------------------------------
export function resolvePublicBase(bundleBaseUrl: string): string {
  const match = bundleBaseUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
  return match
    ? `/api/projects/${match[1]}/${match[2]}/public`
    : `${bundleBaseUrl}/public`;
}

// ---------------------------------------------------------------------------
// Custom require() — provides module shims for CJS evaluation
// ---------------------------------------------------------------------------

function createRequire(bundleBaseUrl: string) {
  const publicBase = resolvePublicBase(bundleBaseUrl);

  // staticFile returns a deterministic same-origin proxy URL.
  // Remotion's prefetch() in WorkspacePlayer downloads these into blob URLs,
  // so after initial load all playback is from memory — zero network.
  const customStaticFile = (relativePath: string) => {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return `${publicBase}/${cleanPath}`;
  };

  const jsx = makeJsx();

  const jsxDEV = (type: any, props: any, key?: string) => {
    props = fixProps(props);
    if (key !== undefined) {
      return React.createElement(type, { ...props, key });
    }
    return React.createElement(type, props);
  };

  return (moduleName: string): any => {
    if (moduleName === 'react') return React;

    if (moduleName === 'react/jsx-runtime') {
      return { jsx, jsxs: jsx, Fragment: React.Fragment };
    }

    if (moduleName === 'react/jsx-dev-runtime') {
      return { jsxDEV, Fragment: React.Fragment };
    }

    if (moduleName === 'remotion') {
      // Disable premounting — blob prefetch already keeps all media in memory,
      // so videos load from blob URLs in <1 frame. Premounting creates offscreen
      // <video> elements that Chrome's power saver pauses, causing AbortError
      // on play() and chunky lag.
      const NoPremountSequence = (props: any) => {
        const { premountFor, ...rest } = props;
        return React.createElement(Remotion.Sequence, rest);
      };

      return {
        ...Remotion,
        Sequence: NoPremountSequence,
        Composition: () => null,
        staticFile: customStaticFile,
        // OffthreadVideo is for rendering; in the Player context, use Video
        // which renders a native <video> element with proper frame sync
        OffthreadVideo: Remotion.Video,
        // Stub for resolveMediaSrc proxy logic — browser Player is always preview mode
        getRemotionEnvironment: () => ({ isRendering: false, isPlayer: true }),
      };
    }

    if (moduleName === '@remotion/noise') return RemotionNoise;
    if (moduleName === '@remotion/shapes') return RemotionShapes;
    if (moduleName === '@remotion/paths') return RemotionPaths;
    if (moduleName === '@remotion/three') return _remotionThree ?? {};

    if (moduleName === '@remotion/google-fonts') {
      return {
        getAvailableFonts: () => [],
      };
    }

    if (moduleName.startsWith('@remotion/google-fonts/')) {
      const fontName = moduleName.replace('@remotion/google-fonts/', '').replace(/-/g, ' ');
      return {
        loadFont: () => ({ fontFamily: `'${fontName}', sans-serif` }),
        getInfo: () => ({ fontFamily: fontName }),
      };
    }

    if (moduleName === 'remotion/no-react') {
      return {
        NoReactInternals: {
          ENABLE_V5_BREAKING_CHANGES: false,
        },
      };
    }

    throw new Error(`Unknown module: ${moduleName}`);
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkspaceComposition(
  bundleUrl: string | null,
  bundleVersion: number,
): {
  Component: React.ComponentType<any> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const reload = useCallback(() => {
    if (bundleUrl) {
      // Remove from cache so it re-fetches
      for (const key of compositionCache.keys()) {
        if (key.startsWith(bundleUrl)) {
          compositionCache.delete(key);
        }
      }
    }
    loadedRef.current = null;
    setReloadCounter((c) => c + 1);
  }, [bundleUrl]);

  useEffect(() => {
    if (!bundleUrl || bundleVersion === 0) {
      setComponent(null);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${bundleUrl}:${bundleVersion}:${reloadCounter}`;

    // Check cache
    if (compositionCache.has(cacheKey)) {
      setComponent(() => compositionCache.get(cacheKey)!);
      setLoading(false);
      setError(null);
      return;
    }

    // Skip if already loading this exact key
    if (loadedRef.current === cacheKey) {
      return;
    }
    loadedRef.current = cacheKey;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Pre-load @remotion/three before CJS eval
        await getRemotionThree();

        // Use same-origin path — Next.js rewrites /api/* to the backend
        const fullUrl = `${bundleUrl}/player-composition.cjs.js?v=${bundleVersion}`;
        const response = await fetch(fullUrl, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch composition: ${response.status}`);
        }
        const code = await response.text();

        const contentType = response.headers.get('content-type') || '';

        // Validate response before eval
        if (!contentType.includes('javascript') && !contentType.includes('text/plain')) {
          throw new Error(`Unexpected content-type for bundle: ${contentType}`);
        }

        // Basic sanity check — verify it contains CJS patterns (exports/require)
        // rather than checking the first line (esbuild output varies)
        if (!code.includes('module.exports') &&
            !code.includes('exports.') &&
            !code.includes('__toCommonJS') &&
            !code.includes('require(')) {
          throw new Error('Bundle content does not look like valid CJS JavaScript');
        }

        if (cancelled) return;

        // Create module and exports objects
        const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
        const customRequire = createRequire(bundleUrl);

        // Execute the CJS module
        // eslint-disable-next-line no-new-func
        const moduleFunction = new Function('module', 'exports', 'require', code);
        moduleFunction(moduleObj, moduleObj.exports, customRequire);

        // Extract PlayerComposition from exports
        const exports = moduleObj.exports;
        const PlayerComp = (
          exports.PlayerComposition ||
          exports.default ||
          Object.values(exports).find((v) => typeof v === 'function')
        ) as React.ComponentType<any> | undefined;

        if (!PlayerComp) {
          throw new Error(
            `PlayerComposition not found. Exports: ${Object.keys(exports).join(', ')}`,
          );
        }

        // Load any Google Fonts referenced in the composition code
        for (const entry of FONT_REGISTRY) {
          if (code.includes(entry.family)) {
            loadFont(entry);
          }
        }

        if (cancelled) return;

        // Cache and set
        compositionCache.set(cacheKey, PlayerComp);
        setComponent(() => PlayerComp);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load workspace composition:', err);
        setError(err instanceof Error ? err.message : 'Failed to load composition');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [bundleUrl, bundleVersion, reloadCounter]);

  return { Component, loading, error, reload };
}
