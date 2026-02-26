/**
 * AnimatedIcon — drop-in wrapper for Freepik / Iconify SVG icons.
 *
 * Usage (from a scene file):
 *   import { AnimatedIcon } from '../../AnimatedIcon';
 *
 *   <AnimatedIcon preset="icon-pop" delay={10} size={80}>
 *     <svg viewBox="0 0 24 24">...</svg>
 *   </AnimatedIcon>
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { SpringConfig } from "remotion";
import type { IconAnimationPreset, ActiveAnimation } from "./asset-animations";
import {
  ICON_DEFAULTS,
  DEFAULT_SPRING,
  computeExit,
} from "./asset-animations";

export interface AnimatedIconProps {
  children: React.ReactNode;
  /** Animation preset for entrance. Default: "icon-pop" */
  preset?: IconAnimationPreset;
  /** Delay in frames before the entrance begins. Default: 0 */
  delay?: number;
  /** Icon container size in px. Default: 64 */
  size?: number;
  /** Icon color (applied via CSS `color` for currentColor SVGs). */
  color?: string;
  /** Looping animation while on screen. Default: "none" */
  activeAnimation?: ActiveAnimation;
  /** Frame at which the icon exits (fades out). Omit to stay visible. */
  exitAt?: number;
  /** Override spring config for the entrance. */
  springConfig?: SpringConfig;
  /** Additional inline styles on the outer wrapper. */
  style?: React.CSSProperties;
}

export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  children,
  preset = ICON_DEFAULTS.preset,
  delay = 0,
  size = 64,
  color,
  activeAnimation = ICON_DEFAULTS.activeAnimation,
  exitAt,
  springConfig = DEFAULT_SPRING,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- Entrance ----
  const f = frame - delay; // local frame relative to delay
  const entered = f >= 0;

  const entranceProgress = entered
    ? spring({ frame: f, fps, config: springConfig })
    : 0;

  const entranceOpacity = entered
    ? interpolate(f, [0, 12], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : 0;

  let entranceScale = entranceProgress;
  let entranceTranslateY = 0;
  let entranceRotate = 0;

  switch (preset) {
    case "icon-pop":
      // Overshoot then settle: spring naturally overshoots ~1.15 with damping 22
      entranceScale = entranceProgress;
      break;

    case "icon-bounce":
      entranceScale = 1;
      entranceTranslateY = entered
        ? interpolate(entranceProgress, [0, 1], [30, 0], {
            extrapolateRight: "clamp",
          })
        : 30;
      break;

    case "icon-fade-rise":
      entranceScale = 1;
      entranceTranslateY = entered
        ? interpolate(entranceProgress, [0, 1], [20, 0], {
            extrapolateRight: "clamp",
          })
        : 20;
      break;

    case "icon-spin-in":
      entranceRotate = entered
        ? interpolate(entranceProgress, [0, 1], [360, 0], {
            extrapolateRight: "clamp",
          })
        : 360;
      break;

    case "none":
      entranceScale = 1;
      break;
  }

  // ---- Active (looping) animation ----
  let activeTranslateY = 0;
  let activeScale = 1;

  if (entered && activeAnimation === "float") {
    activeTranslateY = Math.sin(frame * 0.04) * 3;
  } else if (entered && activeAnimation === "pulse") {
    activeScale = 1 + Math.sin(frame * 0.06) * 0.04;
  }

  // ---- Exit ----
  const exit = computeExit(frame, exitAt, fps);

  // ---- Compose ----
  const opacity = entranceOpacity * exit.opacity;
  const scale = entranceScale * activeScale * exit.scale;
  const translateY = entranceTranslateY + activeTranslateY;

  const transform = [
    `translateY(${translateY}px)`,
    `scale(${scale})`,
    entranceRotate !== 0 ? `rotate(${entranceRotate}deg)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        color,
        opacity,
        transform,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
