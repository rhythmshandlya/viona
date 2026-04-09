import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxDocumentProps } from './schema';
import { VOX_COLORS, VOX_FONTS, VOX_SIZES, voxEaseOut, voxEaseIn } from '../../vox/constants';
import { highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxSourceBadge } from '../../vox/typography';
import { useScale } from '../../use-scale';

// ── Background grid (Vox signature) ──────────────────────────────────
const VoxGrid: React.FC<{ width: number; height: number; spacing: number; color: string; opacity: number }> = ({
  width,
  height,
  spacing,
  color,
  opacity,
}) => {
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity }}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * spacing} y1={0} x2={i * spacing} y2={height} stroke={color} strokeWidth={1} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * spacing} x2={width} y2={i * spacing} stroke={color} strokeWidth={1} />
      ))}
    </svg>
  );
};

// ── Section row with optional highlight ──────────────────────────────
const DocumentSection: React.FC<{
  label?: string;
  text: string;
  highlight: boolean;
  highlightWidthPercent: number;
  s: (px: number) => number;
}> = ({ label, text, highlight, highlightWidthPercent, s }) => (
  <div
    style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      gap: s(12),
      padding: `${s(6)}px 0`,
    }}
  >
    {/* Highlight bar behind the whole row */}
    {highlight && (
      <HighlighterMark
        widthPercent={highlightWidthPercent}
        height={s(48)}
        rotation={0.4}
        yOffset={s(2)}
        color={VOX_COLORS.highlight}
        opacity={0.7}
      />
    )}
    {label && (
      <span
        style={{
          fontFamily: VOX_FONTS.headline,
          fontSize: s(VOX_SIZES.body),
          fontWeight: 700,
          color: VOX_COLORS.charcoal,
          lineHeight: 1.6,
          flexShrink: 0,
          minWidth: s(40),
        }}
      >
        {label}
      </span>
    )}
    <span
      style={{
        fontFamily: VOX_FONTS.headline,
        fontSize: s(VOX_SIZES.body - 2),
        fontWeight: 400,
        color: VOX_COLORS.charcoal,
        lineHeight: 1.6,
      }}
    >
      {text}
    </span>
  </div>
);

// ── Main component ───────────────────────────────────────────────────
const VoxDocument: React.FC<VoxDocumentProps> = ({
  heading,
  headingSubtext,
  sections,
  source,
  zoomTarget,
  focusSection,
  tilt,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const s = useScale();

  // ── Resolve focus section ──
  const resolvedFocus =
    focusSection >= 0 && focusSection < sections.length
      ? focusSection
      : sections.findIndex((sec) => sec.highlight);
  const focusIdx = resolvedFocus >= 0 ? resolvedFocus : 0;

  // ── Paper dimensions (larger than canvas for camera room) ──
  const paperW = W * 1.4;
  const paperH = H * 1.4;
  const paperPadX = s(80);
  const paperPadTop = s(120);

  // ── Estimate Y position of focused section on the paper ──
  // Heading block height approx
  const headingBlockH = s(60) + s(VOX_SIZES.body) * 1.6 * 3; // heading + subtext ~3 lines
  const sectionRowH = s(48) + s(12); // approximate row height per section
  const focusSectionY = paperPadTop + headingBlockH + focusIdx * sectionRowH + sectionRowH / 2;

  // ── Camera: translate to center the focus section in viewport ──
  // Paper origin is centered, so translate offsets from center
  const paperCenterY = paperH / 2;
  const viewportCenterY = H / 2;
  const targetTranslateY = viewportCenterY - focusSectionY;
  // Keep horizontal centering, slight leftward shift for realism
  const targetTranslateX = 0;

  // ── Phase timing ──
  // 0-30: fade in at scale 1
  // 30-90: zoom + pan to focus
  // 90-150: hold with Ken Burns drift
  // 150-180: fade out
  const exitStart = durationInFrames - 30;

  // Fade in
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  // Fade out
  const fadeOut = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseIn,
  });

  // Zoom
  const zoom = interpolate(frame, [30, 90], [1, zoomTarget], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  // Pan Y (move document so focused section is centered)
  const panY = interpolate(frame, [30, 90], [0, targetTranslateY], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  const panX = interpolate(frame, [30, 90], [0, targetTranslateX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  // Ken Burns drift during hold (90-150)
  const kenBurnsDrift = interpolate(frame, [90, 150], [0, s(20)], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const totalTranslateY = panY - kenBurnsDrift;

  // ── Highlight animations (staggered during zoom) ──
  let highlightIdx = 0;
  const highlightWidths = sections.map((sec) => {
    if (!sec.highlight) return 0;
    const stagger = highlightIdx * 10;
    highlightIdx++;
    const sweep = highlighterSweep(frame, 40 + stagger);
    return sweep.widthPercent;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.warmBlack, overflow: 'hidden' }}>
      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: fadeIn }}>
        <VoxGrid width={W} height={H} spacing={s(40)} color="rgba(255,255,255,0.06)" opacity={1} />
      </div>

      {/* Camera container — applies zoom and pan */}
      <div
        style={{
          position: 'absolute',
          width: paperW,
          height: paperH,
          left: (W - paperW) / 2 + panX,
          top: (H - paperH) / 2 + totalTranslateY,
          transform: `scale(${zoom}) rotate(${tilt}deg)`,
          transformOrigin: `${paperW / 2}px ${focusSectionY}px`,
          opacity: fadeIn * fadeOut,
        }}
      >
        {/* Aged paper base */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#F5F0E8',
            borderRadius: s(4),
            overflow: 'hidden',
          }}
        >
          {/* Construction paper texture for aged feel */}
          <ConstructionPaper color="#EDE8DC" opacity={0.5} seed={3} />

          {/* Edge aging — darker at edges */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at center, transparent 50%, rgba(160,130,90,0.15) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Coffee stain accent (subtle) */}
          <div
            style={{
              position: 'absolute',
              top: '15%',
              right: '5%',
              width: s(120),
              height: s(120),
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(180,150,100,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Document text content */}
        <div
          style={{
            position: 'relative',
            padding: `${paperPadTop}px ${paperPadX}px`,
          }}
        >
          {/* Heading */}
          <div
            style={{
              fontFamily: VOX_FONTS.headline,
              fontSize: s(VOX_SIZES.h2),
              fontWeight: 700,
              color: VOX_COLORS.charcoal,
              lineHeight: 1.3,
              marginBottom: s(16),
            }}
          >
            {heading}
          </div>

          {/* Heading subtext */}
          <div
            style={{
              fontFamily: VOX_FONTS.headline,
              fontSize: s(VOX_SIZES.body),
              fontWeight: 400,
              color: VOX_COLORS.charcoal,
              lineHeight: 1.6,
              marginBottom: s(32),
              fontStyle: 'italic',
            }}
          >
            {headingSubtext}
          </div>

          {/* Thin rule */}
          <div
            style={{
              width: '100%',
              height: 1,
              backgroundColor: 'rgba(100,80,60,0.2)',
              marginBottom: s(24),
            }}
          />

          {/* Sections */}
          {sections.map((sec, i) => (
            <DocumentSection
              key={i}
              label={sec.label}
              text={sec.text}
              highlight={sec.highlight}
              highlightWidthPercent={highlightWidths[i]}
              s={s}
            />
          ))}

          {/* Bottom rule */}
          <div
            style={{
              width: '60%',
              height: 1,
              backgroundColor: 'rgba(100,80,60,0.15)',
              marginTop: s(32),
            }}
          />
        </div>
      </div>

      {/* Source badge */}
      {source && <VoxSourceBadge source={source} position="bottom-left" />}

      {/* Film grain on top */}
      <FilmGrain opacity={0.18} />
    </AbsoluteFill>
  );
};

export default VoxDocument;
