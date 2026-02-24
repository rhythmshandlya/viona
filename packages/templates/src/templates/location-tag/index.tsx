import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { LocationTagProps } from './schema';

/* ── DotGrid SVG background ─────────────────────────────────────────── */

const DotGrid: React.FC<{ color: string; width: number; height: number }> = ({
  color,
  width,
  height,
}) => {
  const s = useScale();
  const spacing = s(28);
  const radius = s(1.5);
  const cols = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  const dots: React.ReactNode[] = [];

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
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {dots}
    </svg>
  );
};

/* ── SVG Map Pin (teardrop with inner circle) ───────────────────────── */

const MapPin: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Teardrop body */}
    <path
      d="M32 0C14.327 0 0 14.327 0 32c0 24 32 48 32 48s32-24 32-48C64 14.327 49.673 0 32 0z"
      fill={color}
    />
    {/* Inner circle */}
    <circle cx="32" cy="30" r="13" fill="white" opacity="0.95" />
  </svg>
);

/* ── Main Component ─────────────────────────────────────────────────── */

const LocationTag: React.FC<LocationTagProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();

  const theme = BACKGROUNDS[props.background] ?? BACKGROUNDS.dark;
  const accentColor = props.accentColor;

  // ── 0-15: Background fade in ────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // ── 20-45: Pin drops from above with spring bounce ──────────────
  const pinSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const pinTranslateY = interpolate(pinSpring, [0, 1], [-400, 0]);
  const pinOpacity = interpolate(frame, [20, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── 35-50: Location name slides in from right ───────────────────
  const nameSpring = spring({
    frame: frame - 35,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.7 },
  });
  const nameTranslateX = interpolate(nameSpring, [0, 1], [80, 0]);
  const nameOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── 45-60: Subtitle fades in ────────────────────────────────────
  const subtitleOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subtitleSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });
  const subtitleTranslateY = interpolate(subtitleSpring, [0, 1], [12, 0]);

  // ── 55-70: Coordinates fade in (muted) ──────────────────────────
  const coordsOpacity = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const coordsSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });
  const coordsTranslateY = interpolate(coordsSpring, [0, 1], [10, 0]);

  // ── 70-300: Subtle periodic bounce on pin ───────────────────────
  const periodicBounce =
    frame >= 70 && frame <= 300
      ? Math.sin((frame - 70) * 0.08) * 6
      : 0;

  // ── 300-330: Elements slide out ─────────────────────────────────
  const exitProgress = interpolate(frame, [300, 330], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitEase = exitProgress * exitProgress; // ease-in for exit

  const pinExitY = interpolate(exitEase, [0, 1], [0, -500]);
  const textExitX = interpolate(exitEase, [0, 1], [0, 600]);
  const exitOpacity = interpolate(exitEase, [0, 0.8], [1, 0], {
    extrapolateRight: 'clamp',
  });

  // ── 330-360: Fade out ───────────────────────────────────────────
  const finalFade = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combined pin Y position
  const pinY = pinTranslateY + periodicBounce + pinExitY;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * finalFade,
      }}
    >
      {/* Dot Grid Background */}
      <div style={{ opacity: 0.5 }}>
        <DotGrid color={theme.gridColor} width={width} height={height} />
      </div>

      {/* Center container for pin + text card */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(40),
          }}
        >
          {/* Map Pin */}
          <div
            style={{
              opacity: pinOpacity * exitOpacity,
              transform: `translateY(${pinY}px)`,
              willChange: 'transform',
              flexShrink: 0,
            }}
          >
            <MapPin color={accentColor} size={s(120)} />
          </div>

          {/* Text content to the right of pin */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: s(8),
              transform: `translateX(${textExitX}px)`,
              opacity: exitOpacity,
            }}
          >
            {/* Location name */}
            <div
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(56),
                fontWeight: 700,
                color: theme.text,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                opacity: nameOpacity,
                transform: `translateX(${nameTranslateX}px)`,
                whiteSpace: 'nowrap',
              }}
            >
              {props.location}
            </div>

            {/* Accent divider */}
            <div
              style={{
                width: interpolate(
                  spring({
                    frame: frame - 40,
                    fps,
                    config: { damping: 22, stiffness: 90, mass: 0.7 },
                  }),
                  [0, 1],
                  [0, s(160)]
                ),
                height: s(3),
                backgroundColor: accentColor,
                borderRadius: 2,
                opacity: nameOpacity,
              }}
            />

            {/* Venue / subtitle */}
            {props.venue && (
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(32),
                  fontWeight: 400,
                  color: theme.textMuted,
                  lineHeight: 1.3,
                  letterSpacing: '0.01em',
                  opacity: subtitleOpacity,
                  transform: `translateY(${subtitleTranslateY}px)`,
                  marginTop: s(4),
                }}
              >
                {props.venue}
              </div>
            )}

            {/* Coordinates */}
            {props.coordinates && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: s(20),
                  fontWeight: 400,
                  color: theme.textMuted,
                  lineHeight: 1.4,
                  letterSpacing: '0.05em',
                  opacity: coordsOpacity * 0.6,
                  transform: `translateY(${coordsTranslateY}px)`,
                  marginTop: s(6),
                }}
              >
                {props.coordinates}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default LocationTag;
