'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Remotion from 'remotion';
import * as RemotionNoise from '@remotion/noise';
import * as RemotionShapes from '@remotion/shapes';
import * as RemotionPaths from '@remotion/paths';
import { FONT_REGISTRY, loadFont } from '@/lib/font-registry';

// ---------------------------------------------------------------------------
// Module-level mutable ref for assets map — staticFile() reads this
// ---------------------------------------------------------------------------
let _currentAssetsMap: Record<string, string> = {};

export function setAssetsMap(map: Record<string, string>) {
  _currentAssetsMap = map;
}

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
// Proxy key derivation — matches proxy naming from sandbox workspace-init
// ---------------------------------------------------------------------------
const PROXY_EXTENSIONS: Record<string, string> = {
  '.mp4': '-proxy.mp4',
  '.webm': '-proxy.mp4',
  '.png': '-proxy.webp',
  '.jpg': '-proxy.webp',
  '.jpeg': '-proxy.webp',
  '.webp': '-proxy.webp',
  '.aac': '-proxy.aac',
  '.mp3': '-proxy.aac',
  '.wav': '-proxy.aac',
  '.m4a': '-proxy.aac',
};

function deriveProxyKey(src: string): string | null {
  if (src.includes('-proxy.')) return null; // Already a proxy
  const ext = src.match(/\.\w+$/)?.[0]?.toLowerCase();
  if (ext && PROXY_EXTENSIONS[ext]) {
    return src.replace(/\.\w+$/, PROXY_EXTENSIONS[ext]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Custom require() — provides module shims for CJS evaluation
// ---------------------------------------------------------------------------

function createRequire(bundleBaseUrl: string) {
  const customStaticFile = (relativePath: string) => {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;

    // 1. Check assets map for presigned S3 URLs (direct, no proxy hops)
    //    Also check proxy variant in assets map
    const proxyKey = deriveProxyKey(cleanPath);
    if (proxyKey && _currentAssetsMap[proxyKey]) {
      return _currentAssetsMap[proxyKey];
    }
    if (_currentAssetsMap[cleanPath]) {
      return _currentAssetsMap[cleanPath];
    }

    // 2. Fallback to same-origin API proxy
    const projectIdMatch = bundleBaseUrl.match(/\/projects\/([^/]+)\/(workspace|sandbox)\//);
    const publicBase = projectIdMatch
      ? `/api/projects/${projectIdMatch[1]}/${projectIdMatch[2]}/public`
      : `${bundleBaseUrl}/public`;

    // Use proxy variant for preview performance if available.
    // Only try proxy URL if we have a non-empty assets map (meaning proxies were generated).
    // When assets map is empty, go straight to the original to avoid 404 round-trips.
    if (proxyKey && Object.keys(_currentAssetsMap).length > 0) {
      return `${publicBase}/${proxyKey}`;
    }

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
      // Wrap Sequence to enable premounting — the composition template uses
      // layout="none" on all Sequences, which prevents premounting.
      // By overriding layout to undefined for visual items and adding premountFor,
      // Remotion pre-mounts <Video> elements ~1s before they become visible,
      // eliminating the black flash at cut boundaries.
      const PremountSequence = (props: any) => {
        const { layout, premountFor, children, ...rest } = props;
        // 60 frames ≈ 2s at 30fps — enough for video to load & seek from cache
        return React.createElement(Remotion.Sequence, {
          ...rest,
          premountFor: premountFor ?? 60,
          children,
        });
      };

      return {
        ...Remotion,
        Sequence: PremountSequence,
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
