"use client";

import Link from "next/link";
import { Thumbnail } from "@remotion/player";
import { useMemo, useState } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";
import { cn } from "@/lib/cn";

interface TemplateCardProps {
  template: TemplateRegistryEntry;
}

const categoryColors: Record<string, string> = {
  marketing: "bg-purple-100 text-purple-700",
  education: "bg-blue-100 text-blue-700",
  social: "bg-pink-100 text-pink-700",
  corporate: "bg-slate-100 text-slate-700",
  entertainment: "bg-amber-100 text-amber-700",
};

export function TemplateCard({ template }: TemplateCardProps) {
  const { meta, compositionMeta, defaultProps } = template;
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(
    null
  );

  useMemo(() => {
    template.getComponent().then((mod) => {
      setComponent(() => mod.default);
    });
  }, [template]);

  const { width, height, fps, durationInFrames } = compositionMeta;
  // Show a frame ~1 second in so the preview isn't a blank intro frame
  const previewFrame = Math.min(Math.round(fps), durationInFrames - 1);

  return (
    <Link
      href={`/templates/${meta.slug}`}
      className="group block rounded-lg border border-border bg-card overflow-hidden transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
    >
      <div className="relative overflow-hidden bg-black/5">
        {Component ? (
          <Thumbnail
            component={Component}
            inputProps={defaultProps}
            compositionWidth={width}
            compositionHeight={height}
            durationInFrames={durationInFrames}
            fps={fps}
            frameToDisplay={previewFrame}
            style={{ width: "100%" }}
          />
        ) : (
          <div
            className="bg-gradient-to-br from-primary/10 to-accent/10 animate-pulse flex items-center justify-center"
            style={{ aspectRatio: `${width}/${height}` }}
          >
            <span className="text-[10px] text-muted-foreground">
              Loading...
            </span>
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <h3 className="text-[11px] font-medium text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
            {meta.name}
          </h3>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            ~{meta.estimatedDuration}
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
          {meta.description}
        </p>

        <div className="flex flex-wrap gap-1">
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-px rounded-full",
              categoryColors[meta.category] || "bg-muted text-muted-foreground"
            )}
          >
            {meta.category}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-px rounded-full bg-muted text-muted-foreground">
            {meta.aspectRatio}
          </span>
        </div>
      </div>
    </Link>
  );
}
