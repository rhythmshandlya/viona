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

// Note: All media loads through Next.js rewrite (same-origin) so that:
//   1. @remotion/preload hints match the <video> element src (same URL)
//   2. No CORS complexity — cookies, cache partitions, and preloading all work natively
//   3. The browser's native <video> range request buffering works correctly
// The rewrite /api/* → backend streams responses properly for range requests.

/**
 * Resolve a sandbox-local media filename to a direct API endpoint URL.
 * Some files (source video, matte) live in MinIO and can be served directly
 * through dedicated API endpoints — bypassing the sandbox container proxy.
 * Returns null if no direct endpoint is available for the given filename.
 */
export function resolveDirectMediaUrl(bundleBaseUrl: string, filename: string): string | null {
  const match = bundleBaseUrl.match(/\/projects\/([^/]+)\//);
  if (!match) return null;
  const projectId = match[1];

  if (filename === 'source.mp4') {
    return `/api/projects/${projectId}/video`;
  }
  // audio.aac is extracted inside the sandbox — no direct MinIO endpoint
  return null;
}

// ---------------------------------------------------------------------------
// Custom require() — provides module shims for CJS evaluation
// ---------------------------------------------------------------------------

function createRequire(bundleBaseUrl: string) {
  const publicBase = resolvePublicBase(bundleBaseUrl);

  // staticFile returns a same-origin URL for media files.
  // MUST stay same-origin so that:
  //   1. Remotion's prefetch() can download into blob URLs (CORS)
  //   2. Remotion's blob URL mapping matches the src used by <Video>/<Audio>
  //   3. Video seeking works correctly (video.currentTime on same-origin)
  // Presigned URLs are cross-origin and break all three — only used in prefetch.
  const customStaticFile = (relativePath: string) => {
    // Guard: if the path is already a fully-resolved URL, return as-is.
    // Prevents double-prefixing (e.g. /api/.../public/ + /api/.../public/audio.aac)
    if (/^https?:\/\//.test(relativePath)) {
      return relativePath;
    }
    if (relativePath.startsWith('/api/')) {
      return relativePath;
    }
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    // Use direct API endpoint for source video — bypasses sandbox proxy for large files
    const directUrl = resolveDirectMediaUrl(bundleBaseUrl, cleanPath);
    if (directUrl) return directUrl;
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
      // Cap premountFor to 90 frames (~3s at 30fps).
      // Matte items need both fgr + matte videos loaded (2 HTTP requests
      // + 2 video decodes) so they request 3s of premount. Other items
      // request ≤2s. Chrome's power-saver only triggers after sustained
      // (5s+) offscreen playback — 3s is safely under the threshold.
      const PREMOUNT_CAP = 90;
      const CappedPremountSequence = (props: any) => {
        const { premountFor, ...rest } = props;
        return React.createElement(Remotion.Sequence, {
          ...rest,
          premountFor: premountFor != null ? Math.min(premountFor, PREMOUNT_CAP) : undefined,
        });
      };

      // Wrap Video/Audio to inject default onError handlers.
      // Without onError, Remotion throws an uncatchable error from a DOM
      // event listener when the element fails to load (e.g., media not yet
      // available during sandbox init).
      const SafeVideo = (props: any) => {
        return React.createElement(Remotion.Video, {
          ...props,
          onError: props.onError || ((err: Error) => {
            console.warn('[WorkspacePlayer] Video load error (will retry on next seek):', err.message);
          }),
        });
      };

      const SafeAudio = (props: any) => {
        return React.createElement(Remotion.Audio, {
          ...props,
          onError: props.onError || ((err: Error) => {
            console.warn('[WorkspacePlayer] Audio load error (will retry on next seek):', err.message);
          }),
        });
      };

      return {
        ...Remotion,
        Video: SafeVideo,
        Audio: SafeAudio,
        Sequence: CappedPremountSequence,
        Composition: () => null,
        staticFile: customStaticFile,
        // OffthreadVideo is for rendering; in the Player context, use Video
        // which renders a native <video> element with proper frame sync
        OffthreadVideo: SafeVideo,
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
        let response = await fetch(fullUrl, { credentials: 'include' });

        // On 401, the Stytch JWT may have expired — wait for SDK refresh and retry once
        if (response.status === 401) {
          await new Promise(r => setTimeout(r, 2000));
          response = await fetch(fullUrl, { credentials: 'include' });
        }

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
