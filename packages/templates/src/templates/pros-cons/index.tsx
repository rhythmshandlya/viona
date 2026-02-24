import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { ProsConsProps } from './schema';

/* ------------------------------------------------------------------ */
/*  Dot-grid SVG background pattern                                    */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <defs>
        <pattern id="pc-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(2)} cy={s(2)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pc-dot-grid)" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  SVG Checkmark icon                                                 */
/* ------------------------------------------------------------------ */
const CheckIcon: React.FC<{ color: string; scale: number }> = ({ color, scale }) => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    style={{ transform: `scale(${scale})`, flexShrink: 0 }}
  >
    <circle cx="18" cy="18" r="18" fill={color} opacity={0.15} />
    <path
      d="M12 18.5L16 22.5L24 14.5"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  SVG X-mark icon                                                    */
/* ------------------------------------------------------------------ */
const XIcon: React.FC<{ color: string; scale: number }> = ({ color, scale }) => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    style={{ transform: `scale(${scale})`, flexShrink: 0 }}
  >
    <circle cx="18" cy="18" r="18" fill={color} opacity={0.15} />
    <path
      d="M13 13L23 23M23 13L13 23"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Column header                                                      */
/* ------------------------------------------------------------------ */
interface ColumnHeaderProps {
  label: string;
  color: string;
  textColor: string;
  font: string;
  progress: number;
}

const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  label,
  color,
  textColor,
  font,
  progress,
}) => {
  const s = useScale();
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [20, 0]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: s(12),
        opacity,
        transform: `translateY(${translateY}px)`,
        marginBottom: s(32),
      }}
    >
      <div
        style={{
          width: s(6),
          height: s(36),
          backgroundColor: color,
          borderRadius: s(3),
        }}
      />
      <div
        style={{
          fontFamily: font,
          fontWeight: 800,
          fontSize: s(34),
          color: textColor,
          letterSpacing: s(3),
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Single list item (pro or con)                                      */
/* ------------------------------------------------------------------ */
interface ListItemProps {
  text: string;
  type: 'pro' | 'con';
  color: string;
  textColor: string;
  font: string;
  iconScale: number;
  textProgress: number;
}

const ListItem: React.FC<ListItemProps> = ({
  text,
  type,
  color,
  textColor,
  font,
  iconScale,
  textProgress,
}) => {
  const s = useScale();
  const translateX = interpolate(textProgress, [0, 1], [60, 0]);
  const opacity = interpolate(textProgress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: s(16),
        marginBottom: s(24),
      }}
    >
      {type === 'pro' ? (
        <CheckIcon color={color} scale={iconScale} />
      ) : (
        <XIcon color={color} scale={iconScale} />
      )}
      <div
        style={{
          fontFamily: font,
          fontWeight: 500,
          fontSize: s(26),
          color: textColor,
          lineHeight: 1.35,
          opacity,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main composition                                                   */
/* ------------------------------------------------------------------ */
const ProsCons: React.FC<ProsConsProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const { FONTS } = getConstants(props);
  const theme = BACKGROUNDS[props.background] ?? BACKGROUNDS.dark;

  const maxItems = Math.max(props.pros.length, props.cons.length);

  /* ---- global background fade in ---- */
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  /* ---- global fade out ---- */
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  /* ---- title entrance ---- */
  const titleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 80, mass: 0.8 },
  });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  /* ---- column headers entrance ---- */
  const headerProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 18, stiffness: 80, mass: 0.8 },
  });

  /* ---- item stagger (alternating: pro 1, con 1, pro 2, con 2, ...) ---- */
  const ITEM_STAGGER = 20;
  const FIRST_ITEM_START = 40;

  // Build interleaved item list for animation ordering
  const items: Array<{ type: 'pro' | 'con'; index: number; text: string }> = [];
  for (let i = 0; i < maxItems; i++) {
    if (i < props.pros.length) {
      items.push({ type: 'pro', index: i, text: props.pros[i] });
    }
    if (i < props.cons.length) {
      items.push({ type: 'con', index: i, text: props.cons[i] });
    }
  }

  // Compute animation progress for each interleaved item
  const itemAnimations = items.map((_, seqIndex) => {
    const itemStart = FIRST_ITEM_START + seqIndex * ITEM_STAGGER;

    const iconScale = spring({
      frame: frame - itemStart,
      fps,
      config: { damping: 12, stiffness: 120, mass: 0.6 },
    });

    const textSlide = spring({
      frame: frame - (itemStart + 5),
      fps,
      config: { damping: 16, stiffness: 100, mass: 0.7 },
    });

    return { iconScale, textSlide };
  });

  // Separate pro/con animation maps (keyed by their own index)
  const proAnimations: Array<{ iconScale: number; textSlide: number }> = [];
  const conAnimations: Array<{ iconScale: number; textSlide: number }> = [];

  items.forEach((item, seqIndex) => {
    if (item.type === 'pro') {
      proAnimations[item.index] = itemAnimations[seqIndex];
    } else {
      conAnimations[item.index] = itemAnimations[seqIndex];
    }
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * outroOpacity,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Content container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `${s(72)}px ${s(64)}px`,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 800,
            fontSize: s(52),
            color: theme.text,
            textAlign: 'center',
            marginBottom: s(52),
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            lineHeight: 1.15,
          }}
        >
          {props.title}
        </div>

        {/* Two columns */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: s(48),
            flex: 1,
          }}
        >
          {/* Pros column */}
          <div style={{ flex: 1 }}>
            <ColumnHeader
              label="Pros"
              color={props.prosColor}
              textColor={props.prosColor}
              font={FONTS.headline}
              progress={headerProgress}
            />
            {props.pros.map((text, index) => {
              const anim = proAnimations[index] || { iconScale: 0, textSlide: 0 };
              return (
                <ListItem
                  key={index}
                  text={text}
                  type="pro"
                  color={props.prosColor}
                  textColor={theme.text}
                  font={FONTS.body}
                  iconScale={anim.iconScale}
                  textProgress={anim.textSlide}
                />
              );
            })}
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              backgroundColor: theme.textMuted,
              opacity: 0.2,
              alignSelf: 'stretch',
            }}
          />

          {/* Cons column */}
          <div style={{ flex: 1 }}>
            <ColumnHeader
              label="Cons"
              color={props.consColor}
              textColor={props.consColor}
              font={FONTS.headline}
              progress={headerProgress}
            />
            {props.cons.map((text, index) => {
              const anim = conAnimations[index] || { iconScale: 0, textSlide: 0 };
              return (
                <ListItem
                  key={index}
                  text={text}
                  type="con"
                  color={props.consColor}
                  textColor={theme.text}
                  font={FONTS.body}
                  iconScale={anim.iconScale}
                  textProgress={anim.textSlide}
                />
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default ProsCons;
