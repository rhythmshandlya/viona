"use client";

import Link from "next/link";
import { Thumbnail } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";
import { cn } from "@/lib/cn";
import { Clock, Play } from "lucide-react";

interface TemplateCardProps {
  template: TemplateRegistryEntry;
  index?: number;
}

const categoryColors: Record<string, string> = {
  marketing: "bg-purple-50 text-purple-600 border-purple-100",
  education: "bg-blue-50 text-blue-600 border-blue-100",
  social: "bg-pink-50 text-pink-600 border-pink-100",
  corporate: "bg-slate-50 text-slate-600 border-slate-100",
  entertainment: "bg-amber-50 text-amber-600 border-amber-100",
};

export function TemplateCard({ template, index = 0 }: TemplateCardProps) {
  const { meta, compositionMeta, defaultProps } = template;
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverFrame, setHoverFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    template.getComponent().then((mod) => {
      setComponent(() => mod.default);
    });
  }, [template]);

  const { width, height, fps, durationInFrames } = compositionMeta;
  const previewFrame = Math.min(Math.round(fps), durationInFrames - 1);

  // Cycle through frames on hover for animated preview
  const previewFrames = useMemo(() => [
    previewFrame,
    Math.min(Math.round(fps * 3), durationInFrames - 1),
    Math.min(Math.round(fps * 6), durationInFrames - 1),
  ], [previewFrame, fps, durationInFrames]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % previewFrames.length;
      setHoverFrame(previewFrames[idx]);
    }, 800);
  }, [previewFrames]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setHoverFrame(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Stagger class for animation (wrap around after 8)
  const staggerClass = `stagger-${(index % 8) + 1}`;

  return (
    <Link
      href={`/templates/${meta.slug}`}
      className={cn(
        "group block rounded-xl border border-border bg-card overflow-hidden",
        "transition-all duration-300 ease-out",
        "hover:shadow-xl hover:border-primary/30 hover:scale-[1.02]",
        "animate-fade-in-up",
        staggerClass
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden bg-muted/30">
        {Component ? (
          <Thumbnail
            component={Component}
            inputProps={defaultProps}
            compositionWidth={width}
            compositionHeight={height}
            durationInFrames={durationInFrames}
            fps={fps}
            frameToDisplay={isHovering ? hoverFrame : previewFrame}
            style={{ width: "100%" }}
          />
        ) : (
          <div
            className="bg-gradient-to-br from-primary/5 to-accent/10 animate-pulse flex items-center justify-center"
            style={{ aspectRatio: `${width}/${height}` }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}

        {/* Duration overlay */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
          <Clock className="h-3 w-3" />
          {meta.estimatedDuration}
        </div>

        {/* Play hint on hover */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300",
          "group-hover:bg-black/10"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg",
            "opacity-0 scale-75 transition-all duration-300",
            "group-hover:opacity-100 group-hover:scale-100"
          )}>
            <Play className="h-4 w-4 text-primary ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
          {meta.name}
        </h3>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {meta.description}
        </p>

        <div className="flex items-center gap-1.5 pt-0.5">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              categoryColors[meta.category] || "bg-muted text-muted-foreground border-border"
            )}
          >
            {meta.category}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {meta.aspectRatio}
          </span>
        </div>
      </div>
    </Link>
  );
}
