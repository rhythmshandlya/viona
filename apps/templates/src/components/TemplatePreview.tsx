"use client";

import { Player } from "@remotion/player";
import { useCallback, useMemo, useState } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";

interface TemplatePreviewProps {
  template: TemplateRegistryEntry;
  props: Record<string, unknown>;
}

export function TemplatePreview({ template, props }: TemplatePreviewProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
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
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    );
  }, []);

  if (loading || !Component) {
    return (
      <div className="rounded-xl bg-neutral-950 p-6">
        <div
          className="rounded-lg bg-neutral-800 animate-pulse flex items-center justify-center"
          style={{ ...containerStyle, aspectRatio: `${width}/${height}` }}
        >
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Dark canvas wrapper */}
      <div className="rounded-xl bg-neutral-950 p-4 sm:p-6">
        <div style={containerStyle}>
          <div className="rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10">
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
        </div>
      </div>

      {/* Specs bar */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {[
          `${width}\u00d7${height}`,
          `${fps} fps`,
          `${(durationInFrames / fps).toFixed(1)}s`,
          `${durationInFrames} frames`,
        ].map((spec) => (
          <span
            key={spec}
            className="text-xs px-2.5 py-1 rounded-md bg-secondary text-muted-foreground font-medium"
          >
            {spec}
          </span>
        ))}
      </div>
    </div>
  );
}
