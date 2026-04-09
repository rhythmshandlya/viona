import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxNewscardProps } from './schema';
import { VOX_COLORS, VOX_FONTS, voxEaseOut } from '../../vox/constants';
import { voxEntrance, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper, NewsprintOverlay } from '../../vox/textures';
import { useScale } from '../../use-scale';

const VoxNewscard: React.FC<VoxNewscardProps> = ({ source, date, headline, highlightLine, excerpt }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const s = useScale();

  // Source line fades in first
  const sourceOpacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  // Headline entrance
  const headlineEntrance = voxEntrance(frame, 10, undefined, 'up', s(28));

  // Highlight sweeps across the highlighted line
  const sweep = highlighterSweep(frame, 18);

  // Excerpt fades in last
  const excerptOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  const GRID_SPACING = s(30);
  const PAD = s(72);
  const HEADLINE_SIZE = s(76);
  const SOURCE_SIZE = s(24);
  const DATE_SIZE = s(20);
  const EXCERPT_SIZE = s(18);

  // Split headline to identify which portion matches highlightLine
  // We render the headline word-by-word, grouping into "before highlight", "highlight", "after highlight"
  const headlineUpper = headline.toUpperCase();
  const highlightUpper = (highlightLine || '').toUpperCase();
  const hlStart = headlineUpper.indexOf(highlightUpper);
  const hlEnd = hlStart >= 0 ? hlStart + highlightUpper.length : -1;

  const beforeHighlight = hlStart > 0 ? headline.slice(0, hlStart) : '';
  const highlightedText = hlStart >= 0 ? headline.slice(hlStart, hlEnd) : '';
  const afterHighlight = hlEnd >= 0 && hlEnd < headline.length ? headline.slice(hlEnd) : '';

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      {/* Paper texture */}
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.4} seed={23} />

      {/* Grid overlay */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <pattern
            id="newscard-grid"
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_SPACING} 0 L 0 0 0 ${GRID_SPACING}`}
              fill="none"
              stroke="#C8C8C0"
              strokeWidth={0.5}
              opacity={0.4}
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#newscard-grid)" />
      </svg>

      {/* Faded document newsprint */}
      <NewsprintOverlay opacity={0.05} dotSize={1.5} seed={11} />

      {/* Content: left-aligned, vertically centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: PAD,
          paddingRight: PAD,
          gap: s(32),
        }}
      >
        {/* Source + date line */}
        <div
          style={{
            opacity: sourceOpacity,
            display: 'flex',
            alignItems: 'baseline',
            gap: s(24),
          }}
        >
          <span
            style={{
              fontFamily: VOX_FONTS.body,
              fontSize: SOURCE_SIZE,
              fontWeight: 700,
              color: '#1A1A1A',
              letterSpacing: s(1),
              textTransform: 'uppercase',
            }}
          >
            {source}
          </span>
          <span
            style={{
              fontFamily: VOX_FONTS.body,
              fontSize: DATE_SIZE,
              fontWeight: 400,
              color: VOX_COLORS.medGray,
            }}
          >
            {date}
          </span>
        </div>

        {/* Thin divider line */}
        <div
          style={{
            opacity: sourceOpacity,
            height: 1,
            backgroundColor: VOX_COLORS.lightGray,
            width: '100%',
            marginTop: s(-16),
          }}
        />

        {/* Headline */}
        <div
          style={{
            opacity: headlineEntrance.opacity,
            transform: `translateY(${headlineEntrance.translateY}px)`,
          }}
        >
          {/* Before highlight portion */}
          {beforeHighlight.length > 0 && (
            <div
              style={{
                fontFamily: VOX_FONTS.body,
                fontSize: HEADLINE_SIZE,
                fontWeight: 800,
                color: '#1A1A1A',
                lineHeight: 1.05,
                textTransform: 'uppercase',
              }}
            >
              {beforeHighlight}
            </div>
          )}

          {/* Highlighted portion */}
          {highlightedText.length > 0 && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <HighlighterMark
                widthPercent={sweep.widthPercent}
                height={HEADLINE_SIZE * 1.12}
                rotation={0.5}
                yOffset={0}
                color={VOX_COLORS.highlight}
                opacity={0.88}
              />
              <span
                style={{
                  fontFamily: VOX_FONTS.body,
                  fontSize: HEADLINE_SIZE,
                  fontWeight: 800,
                  color: '#1A1A1A',
                  lineHeight: 1.05,
                  textTransform: 'uppercase',
                  position: 'relative',
                  zIndex: 1,
                  display: 'block',
                }}
              >
                {highlightedText}
              </span>
            </div>
          )}

          {/* After highlight portion */}
          {afterHighlight.length > 0 && (
            <div
              style={{
                fontFamily: VOX_FONTS.body,
                fontSize: HEADLINE_SIZE,
                fontWeight: 800,
                color: '#1A1A1A',
                lineHeight: 1.05,
                textTransform: 'uppercase',
              }}
            >
              {afterHighlight}
            </div>
          )}

          {/* Fallback: no highlight match — render full headline */}
          {hlStart < 0 && (
            <div
              style={{
                fontFamily: VOX_FONTS.body,
                fontSize: HEADLINE_SIZE,
                fontWeight: 800,
                color: '#1A1A1A',
                lineHeight: 1.05,
                textTransform: 'uppercase',
              }}
            >
              {headline}
            </div>
          )}
        </div>

        {/* Excerpt */}
        {excerpt && (
          <div
            style={{
              opacity: excerptOpacity,
              fontFamily: VOX_FONTS.body,
              fontSize: EXCERPT_SIZE,
              fontWeight: 400,
              color: VOX_COLORS.lightGray,
              lineHeight: 1.6,
              textTransform: 'uppercase',
              letterSpacing: s(1.5),
              maxWidth: '85%',
            }}
          >
            {excerpt}
          </div>
        )}
      </div>

      {/* Film grain */}
      <FilmGrain opacity={0.15} />
    </AbsoluteFill>
  );
};

export default VoxNewscard;
