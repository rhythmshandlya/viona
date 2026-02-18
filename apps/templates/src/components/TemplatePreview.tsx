"use client";

import { Player } from "@remotion/player";
import { useCallback, useMemo, useState } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";

interface TemplatePreviewProps {
  template: TemplateRegistryEntry;
  props: Record<string, unknown>;
}

export function TemplatePreview({ template, props }: TemplatePreviewProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    setLoading(true);
    template.getComponent().then((mod) => {
      setComponent(() => mod.default);
      setLoading(false);
    });
  }, [template]);

  const { width, height, fps, durationInFrames } = template.compositionMeta;
  const isPortrait = height > width;

  const containerStyle = useMemo(
    () => ({
      maxWidth: isPortrait ? 360 : "100%",
      margin: isPortrait ? "0 auto" : undefined,
    }),
    [isPortrait]
  );

  const renderPoster = useCallback(() => {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/5">
        <div className="text-muted-foreground text-sm">Click to play</div>
      </div>
    );
  }, []);

  if (loading || !Component) {
    return (
      <div
        className="rounded-lg bg-muted animate-pulse flex items-center justify-center"
        style={{
          ...containerStyle,
          aspectRatio: `${width}/${height}`,
        }}
      >
        <span className="text-muted-foreground text-sm">Loading preview...</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div className="rounded-lg overflow-hidden border border-border shadow-sm">
        <Player
          component={Component}
          inputProps={props}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          style={{ width: "100%" }}
          controls
          autoPlay
          loop
          renderPoster={renderPoster}
          showPosterWhenUnplayed
        />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          {width}x{height}
        </span>
        <span>{fps} fps</span>
        <span>{(durationInFrames / fps).toFixed(1)}s</span>
        <span>{durationInFrames} frames</span>
      </div>
    </div>
  );
}
