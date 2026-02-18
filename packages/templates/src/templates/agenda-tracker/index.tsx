import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { AgendaTrackerProps } from './schema';

/* ------------------------------------------------------------------ */
/*  Dot-grid SVG background pattern                                    */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', top: 0, left: 0 }}
  >
    <defs>
      <pattern
        id="agenda-dot-grid"
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="2" cy="2" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#agenda-dot-grid)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  SVG Checkmark icon                                                 */
/* ------------------------------------------------------------------ */
const Checkmark: React.FC<{ color: string; size: number; opacity: number }> = ({
  color,
  size,
  opacity,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ opacity, flexShrink: 0 }}
  >
    <path
      d="M5 13l4 4L19 7"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Progress dots                                                      */
/* ------------------------------------------------------------------ */
interface ProgressDotsProps {
  total: number;
  completed: number;
  activeIndex: number;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

const ProgressDots: React.FC<ProgressDotsProps> = ({
  total,
  completed,
  activeIndex,
  accentColor,
  mutedColor,
  textColor,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {Array.from({ length: total }).map((_, i) => {
      let bg: string;
      if (i < completed) {
        bg = accentColor;
      } else if (i === activeIndex) {
        bg = accentColor;
      } else {
        bg = mutedColor;
      }
      return (
        <div
          key={i}
          style={{
            width: i === activeIndex ? 14 : 10,
            height: i === activeIndex ? 14 : 10,
            borderRadius: '50%',
            backgroundColor: bg,
            transition: 'all 0.2s',
            boxShadow:
              i === activeIndex ? `0 0 12px ${accentColor}80` : 'none',
          }}
        />
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Single agenda item row                                             */
/* ------------------------------------------------------------------ */
interface AgendaItemProps {
  label: string;
  index: number;
  state: 'upcoming' | 'active' | 'completed';
  accentColor: string;
  textColor: string;
  mutedColor: string;
  headlineFont: string;
  bodyFont: string;
  /** 0-1 entrance animation progress */
  enterProgress: number;
  /** 0-1 activation progress (spring) */
  activeProgress: number;
  /** 0-1 completion checkmark progress */
  checkProgress: number;
}

const AgendaItem: React.FC<AgendaItemProps> = ({
  label,
  index,
  state,
  accentColor,
  textColor,
  mutedColor,
  headlineFont,
  enterProgress,
  activeProgress,
  checkProgress,
}) => {
  const translateX = interpolate(enterProgress, [0, 1], [80, 0]);
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);

  // Active state: scale up, accent border glow
  const scale = interpolate(activeProgress, [0, 1], [1, 1.05]);
  const borderOpacity = interpolate(activeProgress, [0, 1], [0, 1]);

  // Color based on state
  const labelColor =
    state === 'active'
      ? textColor
      : state === 'completed'
        ? mutedColor
        : `${mutedColor}99`;

  const fontSize = state === 'active' ? 38 : 32;
  const fontWeight = state === 'active' ? 700 : 500;

  const numberColor =
    state === 'active'
      ? accentColor
      : state === 'completed'
        ? mutedColor
        : `${mutedColor}66`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
        opacity,
        transform: `translateX(${translateX}px) scale(${scale})`,
        transformOrigin: 'left center',
        paddingLeft: 16,
        paddingRight: 24,
        paddingTop: 14,
        paddingBottom: 14,
        position: 'relative',
      }}
    >
      {/* Accent left border (active glow) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          borderRadius: 3,
          backgroundColor: accentColor,
          opacity: borderOpacity,
          boxShadow: `0 0 16px ${accentColor}80, 0 0 32px ${accentColor}40`,
        }}
      />

      {/* Number / Checkmark */}
      <div
        style={{
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {state === 'completed' && checkProgress > 0 ? (
          <Checkmark color={accentColor} size={28} opacity={checkProgress} />
        ) : (
          <div
            style={{
              fontFamily: headlineFont,
              fontWeight: 700,
              fontSize: 22,
              color: numberColor,
              lineHeight: 1,
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: headlineFont,
          fontWeight,
          fontSize,
          color: labelColor,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main composition                                                   */
/* ------------------------------------------------------------------ */
const AgendaTracker: React.FC<AgendaTrackerProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { FONTS } = getConstants(props);
  const theme = BACKGROUNDS[props.background] ?? BACKGROUNDS.dark;

  const itemCount = props.items.length;

  /* ---------------------------------------------------------------- */
  /*  Timeline constants                                               */
  /* ---------------------------------------------------------------- */
  const BG_FADE_END = 15;
  const TITLE_START = 15;
  const ITEMS_STAGGER_START = 25;
  const ITEMS_STAGGER_DELAY = 5; // frames between each item fade-in
  const ITEMS_ALL_IN = ITEMS_STAGGER_START + itemCount * ITEMS_STAGGER_DELAY;

  // Active highlight zone: frames 50-290
  const HIGHLIGHT_START = 50;
  const HIGHLIGHT_END = 290;
  const HIGHLIGHT_DURATION = HIGHLIGHT_END - HIGHLIGHT_START;
  const PER_ITEM_FRAMES = HIGHLIGHT_DURATION / itemCount;

  // All-complete zone: 290-330
  const ALL_COMPLETE_START = 290;
  // Fade out: 330-360
  const FADEOUT_START = 330;

  /* ---------------------------------------------------------------- */
  /*  Global intro / outro opacity                                     */
  /* ---------------------------------------------------------------- */
  const introOpacity = interpolate(frame, [0, BG_FADE_END], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [FADEOUT_START, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const globalOpacity = introOpacity * outroOpacity;

  /* ---------------------------------------------------------------- */
  /*  Title entrance                                                   */
  /* ---------------------------------------------------------------- */
  const titleProgress = spring({
    frame: frame - TITLE_START,
    fps,
    config: { damping: 18, stiffness: 80, mass: 0.8 },
  });
  const titleY = interpolate(titleProgress, [0, 1], [30, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  /* ---------------------------------------------------------------- */
  /*  Determine active/completed state per item                        */
  /* ---------------------------------------------------------------- */
  const getItemState = (
    index: number,
  ): 'upcoming' | 'active' | 'completed' => {
    if (frame < HIGHLIGHT_START) return 'upcoming';
    if (frame >= ALL_COMPLETE_START) return 'completed';

    const elapsed = frame - HIGHLIGHT_START;
    const activeIndex = Math.min(
      Math.floor(elapsed / PER_ITEM_FRAMES),
      itemCount - 1,
    );

    if (index < activeIndex) return 'completed';
    if (index === activeIndex) return 'active';
    return 'upcoming';
  };

  /* ---------------------------------------------------------------- */
  /*  Count completed for progress dots                                */
  /* ---------------------------------------------------------------- */
  const getCompletedCount = (): number => {
    if (frame < HIGHLIGHT_START) return 0;
    if (frame >= ALL_COMPLETE_START) return itemCount;
    const elapsed = frame - HIGHLIGHT_START;
    return Math.min(Math.floor(elapsed / PER_ITEM_FRAMES), itemCount);
  };

  const getActiveIndex = (): number => {
    if (frame < HIGHLIGHT_START) return -1;
    if (frame >= ALL_COMPLETE_START) return -1;
    const elapsed = frame - HIGHLIGHT_START;
    return Math.min(
      Math.floor(elapsed / PER_ITEM_FRAMES),
      itemCount - 1,
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Progress bar width                                               */
  /* ---------------------------------------------------------------- */
  const progressRatio = interpolate(
    frame,
    [HIGHLIGHT_START, ALL_COMPLETE_START],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const progressBarEntrance = spring({
    frame: frame - (ITEMS_ALL_IN + 5),
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: globalOpacity,
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
          padding: '72px 80px',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 800,
            fontSize: 44,
            color: props.accentColor,
            letterSpacing: 6,
            textTransform: 'uppercase',
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 16,
          }}
        >
          {props.title}
        </div>

        {/* Thin accent line under title */}
        <div
          style={{
            width: 80,
            height: 3,
            backgroundColor: props.accentColor,
            borderRadius: 2,
            opacity: titleOpacity,
            marginBottom: 48,
          }}
        />

        {/* Agenda items */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {props.items.map((item, index) => {
            const itemStart = ITEMS_STAGGER_START + index * ITEMS_STAGGER_DELAY;
            const state = getItemState(index);

            // Entrance slide-in
            const enterProgress = spring({
              frame: frame - itemStart,
              fps,
              config: { damping: 16, stiffness: 100, mass: 0.7 },
            });

            // Active state spring — triggers when this item becomes active
            const itemActiveStart =
              HIGHLIGHT_START + index * PER_ITEM_FRAMES;
            const activeProgress =
              state === 'active'
                ? spring({
                    frame: frame - itemActiveStart,
                    fps,
                    config: { damping: 14, stiffness: 120, mass: 0.5 },
                  })
                : state === 'completed'
                  ? interpolate(
                      frame,
                      [
                        itemActiveStart + PER_ITEM_FRAMES,
                        itemActiveStart + PER_ITEM_FRAMES + 8,
                      ],
                      [1, 0],
                      {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      },
                    )
                  : 0;

            // Checkmark fade-in when transitioning to completed
            const checkStart = itemActiveStart + PER_ITEM_FRAMES;
            const checkProgress =
              state === 'completed'
                ? spring({
                    frame: frame - checkStart,
                    fps,
                    config: { damping: 18, stiffness: 140, mass: 0.4 },
                  })
                : 0;

            return (
              <AgendaItem
                key={index}
                label={item}
                index={index}
                state={state}
                accentColor={props.accentColor}
                textColor={theme.text}
                mutedColor={theme.textMuted}
                headlineFont={FONTS.headline}
                bodyFont={FONTS.body}
                enterProgress={enterProgress}
                activeProgress={activeProgress}
                checkProgress={checkProgress}
              />
            );
          })}
        </div>

        {/* Bottom section: progress bar + dots */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            opacity: progressBarEntrance,
            transform: `translateY(${interpolate(progressBarEntrance, [0, 1], [20, 0])}px)`,
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 6,
              backgroundColor: `${theme.textMuted}33`,
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressRatio * 100}%`,
                height: '100%',
                backgroundColor: props.accentColor,
                borderRadius: 3,
                boxShadow: `0 0 12px ${props.accentColor}60`,
              }}
            />
          </div>

          {/* Progress dots */}
          <ProgressDots
            total={itemCount}
            completed={getCompletedCount()}
            activeIndex={getActiveIndex()}
            accentColor={props.accentColor}
            mutedColor={`${theme.textMuted}44`}
            textColor={theme.text}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default AgendaTracker;
