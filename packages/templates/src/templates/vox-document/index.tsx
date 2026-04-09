import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxDocumentProps } from './schema';
import { VOX_COLORS, voxEaseOut, voxEaseIn } from '../../vox/constants';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxSourceBadge } from '../../vox/typography';
import { useScale } from '../../use-scale';
import { PdfPage } from './components/PdfPage';
import { usePdfTextMap } from './components/usePdfTextMap';
import { HighlightLayer } from './components/HighlightLayer';

// ── Background grid ──────────────────────────────────────────────────
const VoxGrid: React.FC<{ width: number; height: number; s: (px: number) => number }> = ({
  width, height, s,
}) => {
  const spacing = s(40);
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * spacing} y1={0} x2={i * spacing} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * spacing} x2={width} y2={i * spacing} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
    </svg>
  );
};

// fillAmount: 0 = paper at 75% width, 1 = paper at 98% width
const MODE_DEFAULTS = {
  overview:  { fillAmount: 0,   zoomStart: 0,  zoomEnd: 0,   hlStart: 20, groupStagger: 10, lineStagger: 3 },
  zoom:      { fillAmount: 0.6, zoomStart: 25, zoomEnd: 80,  hlStart: 85, groupStagger: 10, lineStagger: 3 },
  figure:    { fillAmount: 0.8, zoomStart: 20, zoomEnd: 70,  hlStart: 999, groupStagger: 0, lineStagger: 0 },
  paragraph: { fillAmount: 0.5, zoomStart: 20, zoomEnd: 65,  hlStart: 70, groupStagger: 10, lineStagger: 8 },
} as const;

const MIN_FILL = 0.75;
const MAX_FILL = 0.98;

const VoxDocument: React.FC<VoxDocumentProps> = ({
  pdfFile,
  page,
  mode,
  focusText,
  highlights,
  zoomLevel: zoomOverride,
  source,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const s = useScale();
  const textMap = usePdfTextMap(pdfFile, page);

  const timing = MODE_DEFAULTS[mode];
  const fillAmount = zoomOverride != null
    ? Math.min(Math.max((zoomOverride - 1) / 0.5, 0), 1)
    : timing.fillAmount;

  // ── Paper: render at FIXED size (target fill), never changes per-frame ──
  const pageRatio = textMap.pageRatio;
  const targetFraction = MIN_FILL + fillAmount * (MAX_FILL - MIN_FILL);
  let paperW = W * targetFraction;
  let paperH = paperW * pageRatio;
  if (paperH > H * 0.95) {
    paperH = H * 0.95;
    paperW = paperH / pageRatio;
  }
  const paperX = (W - paperW) / 2;
  const paperY = (H - paperH) / 2;

  // ── CSS scale animation: start small (overview), grow to 1.0 (target) ──
  const startScale = (() => {
    if (timing.zoomEnd <= timing.zoomStart) return 1; // overview: no animation
    const overviewW = W * MIN_FILL;
    let ow = overviewW;
    let oh = ow * pageRatio;
    if (oh > H * 0.95) { oh = H * 0.95; ow = oh / pageRatio; }
    return ow / paperW; // ratio of overview size to target size (< 1)
  })();

  const cssScale = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [startScale, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : 1;

  // ── Focus region for vertical pan ──
  const focusBounds = focusText ? textMap.findBounds(focusText) : null;
  const focusCenterY = focusBounds
    ? paperY + ((focusBounds.y + focusBounds.h / 2) / 100) * paperH
    : H / 2;

  // Vertical pan to focus region
  const panY = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [0, H / 2 - focusCenterY], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : 0;

  // Ken Burns drift (disabled for overview)
  const driftY = mode === 'overview' ? 0 : interpolate(
    frame,
    [timing.zoomEnd > 0 ? timing.zoomEnd : 40, durationInFrames - 30],
    [0, -s(8)],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Highlight groups ──
  const highlightGroups = textMap.ready
    ? (highlights || []).map((q) => textMap.findText(q))
    : [];

  // ── Fade ──
  const exitStart = durationInFrames - 25;
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });
  const fadeOut = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseIn,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.warmBlack, overflow: 'hidden' }}>
      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: fadeIn }}>
        <VoxGrid width={W} height={H} s={s} />
      </div>

      {/* Paper + camera */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: `translate(0px, ${panY + driftY}px) scale(${cssScale})`,
        transformOrigin: `${W / 2}px ${H / 2}px`,
        opacity: fadeIn * fadeOut,
      }}>
        {/* Paper container — fixed size, never re-renders */}
        <div style={{
          position: 'absolute',
          left: paperX, top: paperY,
          width: paperW, height: paperH,
          borderRadius: s(4),
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Aged paper texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#F5F0E8' }}>
            <ConstructionPaper color="#EDE8DC" opacity={0.5} seed={3} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(160,130,90,0.15) 100%)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* PDF canvas — fixed width, rendered once */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <PdfPage
              src={pdfFile}
              pageNumber={page}
              width={paperW}
              renderScale={1}
            />
          </div>

          {/* Highlights */}
          <HighlightLayer
            highlightGroups={highlightGroups}
            startFrame={timing.hlStart}
            groupStagger={timing.groupStagger}
            lineStagger={timing.lineStagger}
            paperWidth={paperW}
            paperHeight={paperH}
          />
        </div>
      </div>

      {/* Source badge */}
      {source && <VoxSourceBadge source={source} position="bottom-left" />}

      {/* Film grain */}
      <FilmGrain opacity={0.18} />
    </AbsoluteFill>
  );
};

export default VoxDocument;
