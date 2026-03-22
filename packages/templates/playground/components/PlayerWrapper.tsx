import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Player } from '@remotion/player';
import type { TemplateEntry } from '../lib/types';
import { t } from '../theme';

const ASPECTS = {
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
} as const;

export type AspectKey = keyof typeof ASPECTS;
export { ASPECTS };

class TemplateBoundary extends React.Component<
  { templateId: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  componentDidUpdate(prev: { templateId: string }) {
    if (prev.templateId !== this.props.templateId) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: t.error, fontSize: 13, textAlign: 'center', maxWidth: 400, lineHeight: 1.6, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Template render error</div>
          <code style={{ color: '#f87171', fontSize: 12, wordBreak: 'break-word' }}>{this.state.error}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Skeleton shown while the template component is loading */
function ThumbnailSkeleton({ aspect }: { aspect: AspectKey }) {
  const dims = ASPECTS[aspect];
  const ratio = dims.height / dims.width;
  return (
    <div
      style={{
        width: '100%',
        paddingBottom: `${ratio * 100}%`,
        background: `linear-gradient(135deg, ${t.bgRaised} 0%, ${t.bgPanel} 100%)`,
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          border: `2px solid ${t.border}`, borderTopColor: t.accent,
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface PlayerWrapperProps {
  template: TemplateEntry;
  props: Record<string, any>;
  aspect: AspectKey;
  duration?: number;
  maxWidth?: number;
  controls?: boolean;
  autoPlay?: boolean;
  lazy?: boolean;
}

export function PlayerWrapper({ template, props, aspect, duration: durationOverride, maxWidth, controls = true, autoPlay = true, lazy = false }: PlayerWrapperProps) {
  const [Component, setComponent] = useState<React.FC<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the nearest scrollable ancestor to use as IntersectionObserver root
  const getScrollParent = useCallback((el: HTMLElement | null): Element | null => {
    if (!el) return null;
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return parent;
      parent = parent.parentElement;
    }
    return null;
  }, []);

  // IntersectionObserver for lazy loading — uses scroll parent as root
  useEffect(() => {
    if (!lazy || visible) return;
    const el = containerRef.current;
    if (!el) return;
    const scrollRoot = getScrollParent(el);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot, rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, visible, getScrollParent]);

  // Load the template component once visible
  useEffect(() => {
    if (!visible) return;
    setLoadError(null);
    template.loader()
      .then((mod) => setComponent(() => mod.default))
      .catch((err) => setLoadError(`Failed to load "${template.name}": ${err.message}`));
  }, [template.id, visible]);

  const dims = ASPECTS[aspect];
  const fps = template.fps;
  const durationInFrames = durationOverride ? durationOverride * fps : template.durationInFrames;
  const autoMaxWidth = aspect === '16:9' ? 900 : aspect === '1:1' ? 600 : 400;
  const effectiveMaxWidth = maxWidth ?? autoMaxWidth;

  // Skeleton while not visible or still loading
  if (!visible || (!Component && !loadError)) {
    return (
      <div ref={containerRef} style={{ maxWidth: effectiveMaxWidth, width: '100%' }}>
        <ThumbnailSkeleton aspect={aspect} />
      </div>
    );
  }

  // Error state — preserves aspect ratio
  if (loadError) {
    const ratio = dims.height / dims.width;
    return (
      <div style={{
        maxWidth: effectiveMaxWidth, width: '100%', paddingBottom: `${ratio * 100}%`,
        position: 'relative', background: t.bgRaised, borderRadius: 8,
      }}>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.error, fontSize: 12, textAlign: 'center', padding: 16,
        }}>
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <TemplateBoundary templateId={template.id}>
      <Player
        key={`${template.id}-${aspect}`}
        component={Component!}
        inputProps={props}
        durationInFrames={durationInFrames}
        compositionWidth={dims.width}
        compositionHeight={dims.height}
        fps={fps}
        style={{
          width: '100%',
          maxWidth: effectiveMaxWidth,
          borderRadius: 8,
          overflow: 'hidden',
        }}
        controls={controls}
        autoPlay={autoPlay}
        loop
        initiallyMuted
      />
    </TemplateBoundary>
  );
}
