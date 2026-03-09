import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { CreditsRollProps } from './schema';

/* ------------------------------------------------------------------ */
/*  SVG sub-components                                                 */
/* ------------------------------------------------------------------ */

const DotGrid: React.FC<{ color: string; opacity: number; size: number }> = ({ color, opacity, size }) => {
  const s = useScale();
  const dots: React.ReactNode[] = [];
  const spacing = s(40);
  const cols = Math.ceil(size / spacing);
  const rows = Math.ceil(size / spacing);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing + spacing / 2}
          cy={r * spacing + spacing / 2}
          r={s(1.5)}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', top: 0, left: 0, opacity, pointerEvents: 'none' }}
    >
      {dots}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

const TITLE_FONT_SIZE = 52;
const ROLE_FONT_SIZE = 28;
const NAME_FONT_SIZE = 36;
const TITLE_MARGIN_BOTTOM = 80;
const ROLE_MARGIN_TOP = 60;
const NAME_LINE_HEIGHT = 52;
const SECTION_GAP = 20;
const TOP_PADDING = 120;

/* ------------------------------------------------------------------ */
/*  Height calculation                                                 */
/* ------------------------------------------------------------------ */

function calculateContentHeight(credits: CreditsRollProps['credits'], s: (px: number) => number): number {
  let height = s(TOP_PADDING) + s(TITLE_FONT_SIZE) + s(TITLE_MARGIN_BOTTOM);

  for (let i = 0; i < credits.length; i++) {
    const entry = credits[i];
    // Role label height
    height += s(ROLE_MARGIN_TOP) + s(ROLE_FONT_SIZE) + s(SECTION_GAP);
    // Names height
    height += entry.names.length * s(NAME_LINE_HEIGHT);
  }

  // Bottom padding so last item scrolls fully off
  height += s(120);

  return height;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const CreditsRoll: React.FC<CreditsRollProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const contentHeight = calculateContentHeight(props.credits, s);
  const viewportHeight = height;

  /* ---- Animation values ---- */

  // Background fade in (0-15)
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Credits scroll (15-340): translateY from viewport bottom to -contentHeight
  const scrollY = interpolate(frame, [15, 340], [viewportHeight, -contentHeight], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out (330-360)
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: bgOpacity * fadeOut }}>
      {/* Dot grid background */}
      <DotGrid
        color={props.background === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
        opacity={1}
        size={width}
      />

      {/* Scrolling credits container */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            transform: `translateY(${scrollY}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: s(TOP_PADDING),
          }}
        >
          {/* Title */}
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: s(TITLE_FONT_SIZE),
              fontWeight: 700,
              color: props.accentColor,
              letterSpacing: s(8),
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: s(TITLE_MARGIN_BOTTOM),
            }}
          >
            {props.title}
          </div>

          {/* Credit sections */}
          {props.credits.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: s(ROLE_MARGIN_TOP),
              }}
            >
              {/* Role label */}
              <div
                style={{
                  fontFamily: FONTS.headline,
                  fontSize: s(ROLE_FONT_SIZE),
                  fontWeight: 700,
                  color: props.accentColor,
                  letterSpacing: s(4),
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  marginBottom: s(SECTION_GAP),
                }}
              >
                {entry.role}
              </div>

              {/* Names */}
              {entry.names.map((name, nameIdx) => (
                <div
                  key={nameIdx}
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: s(NAME_FONT_SIZE),
                    fontWeight: 400,
                    color: theme.text,
                    lineHeight: `${s(NAME_LINE_HEIGHT)}px`,
                    textAlign: 'center',
                    letterSpacing: s(1),
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default CreditsRoll;
