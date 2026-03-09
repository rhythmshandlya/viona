/**
 * AnimatedImage — wrapper for Pexels photos & Freepik illustrations.
 *
 * Usage (from a scene file):
 *   import { AnimatedImage } from '../../AnimatedImage';
 *
 *   <AnimatedImage src={staticFile('assets/images/hero.jpg')} preset="photo-ken-burns" />
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  Img,
  spring,
  interpolate,
} from "remotion";
import type { SpringConfig } from "remotion";
import type { PhotoAnimationPreset, KenBurnsConfig } from "./asset-animations";
import { PHOTO_DEFAULTS, DEFAULT_SPRING, computeExit } from "./asset-animations";

export interface AnimatedImageProps {
  /** Image source — typically `staticFile('assets/images/...')`. */
  src: string;
  /** Animation preset. Default: "photo-ken-burns" */
  preset?: PhotoAnimationPreset;
  /** Delay in frames before the entrance begins. Default: 0 */
  delay?: number;
  /** Ken Burns config (only used with photo-ken-burns preset). */
  kenBurns?: Partial<KenBurnsConfig>;
  /** Border radius on the outer container. Default: 0 */
  borderRadius?: number;
  /** Frame at which the image exits (fades out). Omit to stay visible. */
  exitAt?: number;
  /** Override spring config for entrances that use spring. */
  springConfig?: SpringConfig;
  /** Additional inline styles on the outer container. */
  style?: React.CSSProperties;
  /** Additional inline styles on the <Img> element itself. */
  imageStyle?: React.CSSProperties;
}

export const AnimatedImage: React.FC<AnimatedImageProps> = ({
  src,
  preset = PHOTO_DEFAULTS.preset,
  delay = 0,
  kenBurns: kenBurnsOverride,
  borderRadius = 0,
  exitAt,
  springConfig = DEFAULT_SPRING,
  style,
  imageStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const f = frame - delay;
  const entered = f >= 0;

  // ---- Exit ----
  const exit = computeExit(frame, exitAt, fps);

  // ---- Preset-specific transforms ----
  let containerOpacity = entered ? 1 : 0;
  let imgTransform = "";
  let imgFilter = "";

  switch (preset) {
    case "photo-ken-burns": {
      const kb: KenBurnsConfig = {
        ...PHOTO_DEFAULTS.kenBurns,
        ...kenBurnsOverride,
      };

      // Entrance fade
      containerOpacity = entered
        ? interpolate(f, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          })
        : 0;

      // Slow zoom over the entire duration
      const totalFrames = exitAt ?? durationInFrames;
      const scale = interpolate(frame, [delay, totalFrames], [kb.startScale, kb.endScale], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      });

      // Pan
      let panX = 0;
      let panY = 0;
      const pan = interpolate(frame, [delay, totalFrames], [0, kb.panAmount], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      });

      switch (kb.panDirection) {
        case "left":
          panX = -pan;
          break;
        case "right":
          panX = pan;
          break;
        case "up":
          panY = -pan;
          break;
        case "down":
          panY = pan;
          break;
      }

      imgTransform = `scale(${scale}) translate(${panX}%, ${panY}%)`;
      break;
    }

    case "photo-zoom": {
      const progress = entered
        ? spring({ frame: f, fps, config: springConfig })
        : 0;
      containerOpacity = entered
        ? interpolate(f, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          })
        : 0;
      const scale = interpolate(progress, [0, 1], [0.85, 1], {
        extrapolateRight: "clamp",
      });
      imgTransform = `scale(${scale})`;
      break;
    }

    case "photo-blur-reveal": {
      containerOpacity = entered
        ? interpolate(f, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          })
        : 0;
      const blur = entered
        ? interpolate(f, [0, 30], [8, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          })
        : 8;
      imgFilter = `blur(${blur}px)`;
      break;
    }

    case "photo-fade-scale": {
      const progress = entered
        ? spring({ frame: f, fps, config: springConfig })
        : 0;
      containerOpacity = entered
        ? interpolate(f, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          })
        : 0;
      const scale = interpolate(progress, [0, 1], [0.9, 1], {
        extrapolateRight: "clamp",
      });
      imgTransform = `scale(${scale})`;
      break;
    }

    case "none":
      containerOpacity = entered ? 1 : 0;
      break;
  }

  const finalOpacity = containerOpacity * exit.opacity;

  return (
    <div
      style={{
        overflow: "hidden",
        borderRadius,
        opacity: finalOpacity,
        transform: exit.scale !== 1 ? `scale(${exit.scale})` : undefined,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: imgTransform || undefined,
          filter: imgFilter || undefined,
          willChange: "transform, filter",
          ...imageStyle,
        }}
      />
    </div>
  );
};
