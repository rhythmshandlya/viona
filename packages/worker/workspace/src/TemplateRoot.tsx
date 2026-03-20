import "./index.css";
import React from "react";
import { Composition, Folder } from "remotion";

// ── Template imports ────────────────────────────────────────────────────────
import CountryHighlight from "./.templates/country-highlight/index";
import {
  schema as countryHighlightSchema,
  defaultProps as countryHighlightDefaults,
} from "./.templates/country-highlight/schema";

// TODO: watercolor-map excluded — missing shared lib/map module. Re-add once fixed.
// import WatercolorMap from "./.templates/watercolor-map/index";
// import { schema as watercolorMapSchema, defaultProps as watercolorMapDefaults } from "./.templates/watercolor-map/schema";

// ── Aspect ratio presets ────────────────────────────────────────────────────
const ASPECTS = {
  square: { width: 1080, height: 1080, label: "1:1" },
  vertical: { width: 1080, height: 1920, label: "9:16" },
  landscape: { width: 1920, height: 1080, label: "16:9" },
} as const;

// ── Duration presets (seconds) ──────────────────────────────────────────────
const DURATIONS = [6, 12, 20, 30];

// ── Template registry ───────────────────────────────────────────────────────
// Add new templates here. Each entry auto-generates compositions for all aspect ratios × durations.
const TEMPLATES = [
  {
    id: "country-highlight",
    component: CountryHighlight,
    schema: countryHighlightSchema,
    defaultProps: countryHighlightDefaults,
    fps: 30,
    nativeAspect: "square" as const,
    defaultDuration: 12,
  },
];

export const TemplateRoot: React.FC = () => {
  return (
    <>
      {TEMPLATES.map((t) => {
        const native = ASPECTS[t.nativeAspect];
        return (
          <Folder key={t.id} name={t.id}>
            {/* Default: native aspect, default duration */}
            <Composition
              id={t.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              component={t.component as any}
              schema={t.schema}
              defaultProps={t.defaultProps}
              durationInFrames={t.defaultDuration * t.fps}
              fps={t.fps}
              width={native.width}
              height={native.height}
            />

            {/* Aspect ratio variants */}
            <Folder name="aspects">
              {Object.entries(ASPECTS).map(([key, aspect]) => {
                if (key === t.nativeAspect) return null;
                return (
                  <Composition
                    key={key}
                    id={`${t.id}--${aspect.label}`}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    component={t.component as any}
                    schema={t.schema}
                    defaultProps={t.defaultProps}
                    durationInFrames={t.defaultDuration * t.fps}
                    fps={t.fps}
                    width={aspect.width}
                    height={aspect.height}
                  />
                );
              })}
            </Folder>

            {/* Duration variants */}
            <Folder name="durations">
              {DURATIONS.filter((d) => d !== t.defaultDuration).map((d) => (
                <Composition
                  key={d}
                  id={`${t.id}--${d}s`}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  component={t.component as any}
                  schema={t.schema}
                  defaultProps={t.defaultProps}
                  durationInFrames={d * t.fps}
                  fps={t.fps}
                  width={native.width}
                  height={native.height}
                />
              ))}
            </Folder>
          </Folder>
        );
      })}
    </>
  );
};
