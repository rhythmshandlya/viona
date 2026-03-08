import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { ProductCardProps } from './schema';

/* ── SVG DotGrid Background ─────────────────────────────────────────── */

const DotGrid: React.FC<{ color: string; spacing?: number; radius?: number; gridWidth: number; gridHeight: number }> = ({
  color,
  spacing = 32,
  radius = 2,
  gridWidth,
  gridHeight,
}) => {
  const cols = Math.ceil(gridWidth / spacing) + 1;
  const rows = Math.ceil(gridHeight / spacing) + 1;
  const dots: React.ReactElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing}
          cy={r * spacing}
          r={radius}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={gridWidth}
      height={gridHeight}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {dots}
    </svg>
  );
};

/* ── SVG Star ────────────────────────────────────────────────────────── */

const Star: React.FC<{
  filled: number; // 0 = empty, 1 = full, 0-1 = partial
  size: number;
  filledColor: string;
  emptyColor: string;
}> = ({ filled, size, filledColor, emptyColor }) => {
  const id = React.useId();
  const clampedFill = Math.max(0, Math.min(1, filled));

  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={`star-grad-${id}`}>
          <stop offset={`${clampedFill * 100}%`} stopColor={filledColor} />
          <stop offset={`${clampedFill * 100}%`} stopColor={emptyColor} />
        </linearGradient>
      </defs>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
        fill={`url(#star-grad-${id})`}
      />
    </svg>
  );
};

/* ── Star Rating Row ─────────────────────────────────────────────────── */

const StarRating: React.FC<{
  rating: number;
  frame: number;
  enterFrame: number;
  fps: number;
  filledColor: string;
  emptyColor: string;
  s: (px: number) => number;
}> = ({ rating, frame, enterFrame, fps, filledColor, emptyColor, s }) => {
  const stars: React.ReactElement[] = [];
  const starSize = s(36);

  for (let i = 0; i < 5; i++) {
    // Each star lights up sequentially starting from enterFrame
    const starDelay = enterFrame + i * 4; // 4 frames apart
    const starProgress = interpolate(frame, [starDelay, starDelay + 6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // How filled is this star based on rating
    const starFill = Math.max(0, Math.min(1, rating - i));
    const animatedFill = starFill * starProgress;

    const starScale = spring({
      frame: Math.max(0, frame - starDelay),
      fps,
      config: { damping: 12, stiffness: 200, mass: 0.5 },
    });

    stars.push(
      <div
        key={i}
        style={{
          transform: `scale(${starScale})`,
          display: 'inline-flex',
          marginRight: i < 4 ? s(6) : 0,
        }}
      >
        <Star
          filled={animatedFill}
          size={starSize}
          filledColor={filledColor}
          emptyColor={emptyColor}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>{stars}</div>
  );
};

/* ── Main Component ──────────────────────────────────────────────────── */

const ProductCard: React.FC<ProductCardProps> = (props) => {
  const { COLORS, FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const CARD_WIDTH = s(680);
  const CARD_PADDING = s(60);
  const CARD_RADIUS = s(32);

  // ── Timeline ──────────────────────────────────────────────────────

  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 20-45: Card slides up from bottom with spring
  const cardSpring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: SPRING_CONFIG,
  });
  const cardTranslateY = interpolate(cardSpring, [0, 1], [600, 0]);

  // 40-55: Product name fades in
  const nameOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nameTranslateY = interpolate(frame, [40, 55], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 50-65: Price appears
  const priceOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const priceTranslateY = interpolate(frame, [50, 65], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 60-75: Tagline fades in
  const taglineOpacity = interpolate(frame, [60, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineTranslateY = interpolate(frame, [60, 75], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 70-90: Star rating animates in (individual stars handled in component)
  const ratingOpacity = interpolate(frame, [70, 78], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 300-330: Card slides down
  const exitSpring = spring({
    frame: Math.max(0, frame - 300),
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const cardExitY = interpolate(exitSpring, [0, 1], [0, 700]);

  // 330-360: Fade out
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combined card Y position
  const finalCardY = cardTranslateY + cardExitY;

  // Accent gradient for glow
  const glowColor1 = props.accentColor;
  const glowColor2 = adjustHue(props.accentColor, 40);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* DotGrid background */}
      <div style={{ opacity: bgOpacity, position: 'absolute', inset: 0 }}>
        <DotGrid color={COLORS.dotColor} spacing={32} radius={2} gridWidth={width} gridHeight={height} />
      </div>

      {/* Card container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `translateY(${finalCardY}px)`,
            width: CARD_WIDTH,
            position: 'relative',
          }}
        >
          {/* Accent gradient glow behind card */}
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: CARD_RADIUS + 4,
              background: `linear-gradient(135deg, ${glowColor1}, ${glowColor2})`,
              opacity: 0.6,
              filter: `blur(${s(20)}px)`,
            }}
          />

          {/* Accent gradient border */}
          <div
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius: CARD_RADIUS + 2,
              background: `linear-gradient(135deg, ${glowColor1}, ${glowColor2})`,
              opacity: 0.8,
            }}
          />

          {/* Card body */}
          <div
            style={{
              position: 'relative',
              backgroundColor: COLORS.cardBg,
              borderRadius: CARD_RADIUS,
              padding: CARD_PADDING,
              backdropFilter: `blur(${s(40)}px)`,
              display: 'flex',
              flexDirection: 'column',
              gap: s(28),
            }}
          >
            {/* Product name */}
            <div
              style={{
                opacity: nameOpacity,
                transform: `translateY(${nameTranslateY}px)`,
              }}
            >
              <h1
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: s(56),
                  fontWeight: 700,
                  color: COLORS.text,
                  margin: 0,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                }}
              >
                {props.productName}
              </h1>
            </div>

            {/* Price */}
            <div
              style={{
                opacity: priceOpacity,
                transform: `translateY(${priceTranslateY}px)`,
                display: 'flex',
                alignItems: 'baseline',
                gap: s(16),
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: s(48),
                  fontWeight: 700,
                  color: COLORS.accent,
                  letterSpacing: '-0.01em',
                }}
              >
                {props.price}
              </span>

              {props.originalPrice && (
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: s(30),
                    fontWeight: 400,
                    color: COLORS.strikethrough,
                    textDecoration: 'line-through',
                    textDecorationThickness: 2,
                  }}
                >
                  {props.originalPrice}
                </span>
              )}
            </div>

            {/* Tagline */}
            <div
              style={{
                opacity: taglineOpacity,
                transform: `translateY(${taglineTranslateY}px)`,
              }}
            >
              <p
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(26),
                  fontWeight: 400,
                  color: COLORS.subtextColor,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {props.tagline}
              </p>
            </div>

            {/* Star rating */}
            {props.showRating && (
              <div
                style={{
                  opacity: ratingOpacity,
                  display: 'flex',
                  alignItems: 'center',
                  gap: s(16),
                }}
              >
                <StarRating
                  rating={props.rating}
                  frame={frame}
                  enterFrame={70}
                  fps={fps}
                  filledColor={COLORS.starFilled}
                  emptyColor={COLORS.starEmpty}
                  s={s}
                />
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: s(24),
                    fontWeight: 600,
                    color: COLORS.text,
                    opacity: interpolate(frame, [86, 92], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                >
                  {props.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ── Utility: shift hue for gradient ─────────────────────────────────── */

function adjustHue(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  h = (h + degrees) % 360;
  if (h < 0) h += 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1: number, g1: number, b1: number;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

export default ProductCard;
