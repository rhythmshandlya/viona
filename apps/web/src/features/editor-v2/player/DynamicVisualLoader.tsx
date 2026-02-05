/**
 * DynamicVisualLoader Component
 * Loads and executes dynamically generated Remotion compositions
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Remotion from 'remotion';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface DynamicVisualLoaderProps {
  bundleUrl: string;
  compositionId: string;
  className?: string;
}

// ============================================================================
// FALLBACK ANIMATION COMPONENTS
// These are injected as globals for dynamically loaded compositions that
// might reference animations without proper imports.
// ============================================================================

const SPRING_CONFIGS = {
  minimal: { damping: 20, stiffness: 60, mass: 1 },
  modern: { damping: 12, stiffness: 80, mass: 1 },
  playful: { damping: 8, stiffness: 200, mass: 1 },
  bold: { damping: 15, stiffness: 150, mass: 1 },
  classic: { damping: 25, stiffness: 50, mass: 1 },
} as const;

type StylePreset = keyof typeof SPRING_CONFIGS;

interface AnimationProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StylePreset;
  speed?: 'fast' | 'normal' | 'slow';
  distance?: number;
}

const PREMIUM_DURATIONS: Record<StylePreset, Record<'fast' | 'normal' | 'slow', number>> = {
  minimal: { fast: 20, normal: 30, slow: 45 },
  modern: { fast: 18, normal: 25, slow: 40 },
  playful: { fast: 15, normal: 22, slow: 35 },
  bold: { fast: 12, normal: 20, slow: 30 },
  classic: { fast: 25, normal: 35, slow: 50 },
};

// FadeIn - Simple opacity fade
const FadeIn: React.FC<AnimationProps> = ({ children, delay = 0, duration = 20 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity }}>{children}</div>;
};

// FadeInUp - Elegant upward reveal
const FadeInUp: React.FC<AnimationProps> = ({ children, delay = 0, duration, style = 'modern', speed = 'normal', distance = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;
  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = interpolate(progress, [0, 1], [distance, 0]);
  const opacity = interpolate(progress, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ transform: `translateY(${translateY}px)`, opacity }}>{children}</div>;
};

// FadeInDown - Downward fade entrance
const FadeInDown: React.FC<AnimationProps> = ({ children, delay = 0, duration, style = 'modern', speed = 'normal', distance = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;
  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: dur });
  const translateY = interpolate(progress, [0, 1], [-distance, 0]);
  const opacity = interpolate(progress, [0, 0.6], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ transform: `translateY(${translateY}px)`, opacity }}>{children}</div>;
};

// SlideUp - Slide from bottom
const SlideUp: React.FC<AnimationProps> = ({ children, delay = 0, duration = 25, style = 'modern', distance = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return <div style={{ opacity: 0 }}>{children}</div>;
  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: duration });
  const translateY = interpolate(progress, [0, 1], [distance, 0]);
  const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ transform: `translateY(${translateY}px)`, opacity }}>{children}</div>;
};

// ScaleIn - Scale entrance
const ScaleIn: React.FC<AnimationProps> = ({ children, delay = 0, duration = 20, style = 'modern' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return <div style={{ opacity: 0, transform: 'scale(0.8)' }}>{children}</div>;
  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: duration });
  const scale = interpolate(progress, [0, 1], [0.8, 1]);
  const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>;
};

// BounceIn - Dramatic bouncy entrance
const BounceIn: React.FC<AnimationProps> = ({ children, delay = 0, duration, style = 'playful', speed = 'normal' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  if (frame < delay) return <div style={{ opacity: 0, transform: 'scale(0.3)' }}>{children}</div>;
  const progress = spring({ frame: frame - delay, fps, config: { damping: 8, stiffness: 200, mass: 1 }, durationInFrames: dur });
  const scale = interpolate(progress, [0, 0.5, 0.75, 1], [0.3, 1.1, 0.95, 1]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>;
};

// ZoomIn - Dramatic zoom from small
const ZoomIn: React.FC<AnimationProps> = ({ children, delay = 0, duration, style = 'bold', speed = 'normal' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = duration || PREMIUM_DURATIONS[style][speed];
  const config = SPRING_CONFIGS[style];
  if (frame < delay) return <div style={{ opacity: 0, transform: 'scale(0.3)' }}>{children}</div>;
  const progress = spring({ frame: frame - delay, fps, config, durationInFrames: dur });
  const scale = interpolate(progress, [0, 1], [0.3, 1]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>;
};

// Pulse - Breathing scale effect
const Pulse: React.FC<AnimationProps & { intensity?: number }> = ({ children, delay = 0, duration = 30, intensity = 1.08 }) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;
  const loopFrame = (frame - delay) % duration;
  const scale = interpolate(loopFrame, [0, duration / 2, duration], [1, intensity, 1]);
  return <div style={{ transform: `scale(${scale})` }}>{children}</div>;
};

// GlowPulse - Pulsing glow effect
const GlowPulse: React.FC<AnimationProps & { color?: string; intensity?: number }> = ({ children, delay = 0, duration = 40, color = '#3b82f6', intensity = 20 }) => {
  const frame = useCurrentFrame();
  if (frame < delay) return <div>{children}</div>;
  const loopFrame = (frame - delay) % duration;
  const glowSize = interpolate(loopFrame, [0, duration / 2, duration], [0, intensity, 0]);
  return <div style={{ filter: `drop-shadow(0 0 ${glowSize}px ${color})` }}>{children}</div>;
};

// Collect all animation components for injection
const AnimationComponents = {
  FadeIn,
  FadeInUp,
  FadeInDown,
  SlideUp,
  ScaleIn,
  BounceIn,
  ZoomIn,
  Pulse,
  GlowPulse,
  SPRING_CONFIGS,
  PREMIUM_DURATIONS,
};

// Module cache to avoid re-fetching
const moduleCache = new Map<string, React.ComponentType>();

// Lazy-loaded Three.js module caches
let remotionThreeModule: Record<string, unknown> | null = null;
let threeModule: Record<string, unknown> | null = null;
let fiberModule: Record<string, unknown> | null = null;

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

      // Detect Three.js usage and lazy-import if needed
      const usesThreeJs = code.includes('@remotion/three') ||
                          code.includes("'three'") ||
                          code.includes('@react-three/fiber');

      if (usesThreeJs && !remotionThreeModule) {
        const [rThree, three, fiber] = await Promise.all([
          import('@remotion/three'),
          import('three'),
          import('@react-three/fiber'),
        ]);
        remotionThreeModule = rThree as unknown as Record<string, unknown>;
        threeModule = three as unknown as Record<string, unknown>;
        fiberModule = fiber as unknown as Record<string, unknown>;
      }

      // Create a custom require function that provides React and Remotion
      const customRequire = (moduleName: string) => {
        if (moduleName === 'react') return React;
        if (moduleName === 'react/jsx-runtime') {
          // JSX runtime: jsx(type, props, key) – key is the 3rd arg.
          // React.createElement(type, props, ...children) – 3rd+ args are children.
          // We must merge the key into props before forwarding.
          const jsxShim = (type: any, props: any, key?: any) => {
            if (key !== undefined) {
              return React.createElement(type, { ...props, key });
            }
            return React.createElement(type, props);
          };
          return {
            jsx: jsxShim,
            jsxs: jsxShim,
            Fragment: React.Fragment,
          };
        }
        if (moduleName === 'react/jsx-dev-runtime') {
          const jsxDEVShim = (type: any, props: any, key?: any) => {
            if (key !== undefined) {
              return React.createElement(type, { ...props, key });
            }
            return React.createElement(type, props);
          };
          return {
            jsxDEV: jsxDEVShim,
            Fragment: React.Fragment,
          };
        }
        if (moduleName === 'remotion') return Remotion;
        if (moduleName === '@remotion/three') return remotionThreeModule;
        if (moduleName === 'three') return threeModule;
        if (moduleName === '@react-three/fiber') return fiberModule;
        throw new Error(`Unknown module: ${moduleName}`);
      };

      // Create module and exports objects
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };

      // Inject all Remotion exports as scope variables so generated code
      // works even if it references them as bare globals (e.g. `Sequence`)
      // instead of using `require('remotion')`.
      const remotionKeys = Object.keys(Remotion);
      const remotionValues = remotionKeys.map(
        (key) => (Remotion as Record<string, unknown>)[key]
      );

      // Inject @remotion/three exports as scope globals for 3D compositions
      let threeKeys: string[] = [];
      let threeVals: unknown[] = [];
      if (usesThreeJs && remotionThreeModule) {
        threeKeys = Object.keys(remotionThreeModule);
        threeVals = threeKeys.map(k => remotionThreeModule![k]);
      }

      // Inject animation components as scope globals for compositions that
      // reference them without proper imports (fallback for buggy generated code)
      const animationKeys = Object.keys(AnimationComponents);
      const animationValues = animationKeys.map(
        (key) => (AnimationComponents as Record<string, unknown>)[key]
      );

      // Execute the CommonJS module
      // eslint-disable-next-line no-new-func
      const moduleFunction = new Function(
        'module',
        'exports',
        'require',
        'React',
        ...remotionKeys,
        ...threeKeys,
        ...animationKeys,
        code
      );
      moduleFunction(
        moduleObj,
        moduleObj.exports,
        customRequire,
        React,
        ...remotionValues,
        ...threeVals,
        ...animationValues
      );

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
