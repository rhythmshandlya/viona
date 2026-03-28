import React, { useEffect, useState } from 'react';
import { Player } from '@remotion/player';
import type { TemplateEntry } from '../lib/types';

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
        <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', maxWidth: 400, lineHeight: 1.6, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Template render error</div>
          <code style={{ color: '#f87171', fontSize: 12, wordBreak: 'break-word' }}>{this.state.error}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PlayerWrapperProps {
  template: TemplateEntry;
  props: Record<string, any>;
  aspect: AspectKey;
  duration: number;
  maxWidth?: number;
  controls?: boolean;
  autoPlay?: boolean;
}

export function PlayerWrapper({ template, props, aspect, duration, maxWidth, controls = true, autoPlay = true }: PlayerWrapperProps) {
  const [Component, setComponent] = useState<React.FC<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    template.loader()
      .then((mod) => setComponent(() => mod.default))
      .catch((err) => setLoadError(`Failed to load "${template.name}": ${err.message}`));
  }, [template.id]);

  const dims = ASPECTS[aspect];
  const fps = 30;
  const autoMaxWidth = aspect === '16:9' ? 900 : aspect === '1:1' ? 600 : 400;

  if (loadError) {
    return <div style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>{loadError}</div>;
  }
  if (!Component) {
    return <div style={{ color: '#888', fontSize: 14 }}>Loading template...</div>;
  }

  return (
    <TemplateBoundary templateId={template.id}>
      <Player
        key={`${template.id}-${aspect}`}
        component={Component}
        inputProps={props}
        durationInFrames={duration * fps}
        compositionWidth={dims.width}
        compositionHeight={dims.height}
        fps={fps}
        style={{
          width: '100%',
          maxWidth: maxWidth ?? autoMaxWidth,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 4px 40px rgba(0,0,0,0.6)',
        }}
        controls={controls}
        autoPlay={autoPlay}
        loop
      />
    </TemplateBoundary>
  );
}
