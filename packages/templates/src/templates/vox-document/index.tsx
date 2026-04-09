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

// ── Mode-specific timing constants ───────────────────────────────────
const MODE_DEFAULTS = {
  overview:  { zoom: 1.0, zoomStart: 0,  zoomEnd: 0,   hlStart: 20, groupStagger: 10, lineStagger: 3 },
  zoom:      { zoom: 2.2, zoomStart: 25, zoomEnd: 80,  hlStart: 85, groupStagger: 10, lineStagger: 3 },
  figure:    { zoom: 2.8, zoomStart: 20, zoomEnd: 70,  hlStart: 999, groupStagger: 0, lineStagger: 0 },
  paragraph: { zoom: 2.0, zoomStart: 20, zoomEnd: 65,  hlStart: 70, groupStagger: 10, lineStagger: 8 },
} as const;

// ── Main component ───────────────────────────────────────────────────
const VoxDocument: React.FC<VoxDocumentProps> = ({
  pdfFile,
  page,
  mode,
  focusText,
  highlights,
  zoomLevel: zoomOverride,
  tilt,
  renderScale,
  source,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const s = useScale();
  const textMap = usePdfTextMap(pdfFile, page);

  // ── Resolve mode timing ──
  const timing = MODE_DEFAULTS[mode];
  const targetZoom = zoomOverride ?? timing.zoom;

  // ── Paper dimensions (85% canvas width, PDF aspect ratio) ──
  const paperW = W * 0.85;
  const paperH = paperW * textMap.pageRatio;
  const paperX = (W - paperW) / 2;
  const paperY = (H - paperH) / 2;

  // ── Find focus region from text ──
  const focusBounds = focusText ? textMap.findBounds(focusText) : null;
  const focusCenterX = focusBounds
    ? paperX + ((focusBounds.x + focusBounds.w / 2) / 100) * paperW
    : W / 2;
  const focusCenterY = focusBounds
    ? paperY + ((focusBounds.y + focusBounds.h / 2) / 100) * paperH
    : H / 2;

  // ── Find highlight regions from text ──
  const highlightGroups = textMap.ready
    ? (highlights || []).map((q) => textMap.findText(q))
    : [];

  // ── Animation phases ──
  const exitStart = durationInFrames - 25;

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });
  const fadeOut = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseIn,
  });

  // Camera zoom
  const zoom = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [1, targetZoom], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : targetZoom;

  // Camera pan to focus region
  const panX = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [0, W / 2 - focusCenterX], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : 0;
  const panY = timing.zoomEnd > timing.zoomStart
    ? interpolate(frame, [timing.zoomStart, timing.zoomEnd], [0, H / 2 - focusCenterY], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
      })
    : 0;

  // Ken Burns drift
  const driftStart = timing.zoomEnd > 0 ? timing.zoomEnd : 40;
  const driftY = interpolate(frame, [driftStart, durationInFrames - 30], [0, -s(12)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.warmBlack, overflow: 'hidden' }}>
      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: fadeIn }}>
        <VoxGrid width={W} height={H} s={s} />
      </div>

      {/* Camera container */}
      <div style={{
        position: 'absolute', width: W, height: H,
        transform: `scale(${zoom})`,
        transformOrigin: `${focusCenterX}px ${focusCenterY}px`,
        opacity: fadeIn * fadeOut,
      }}>
        <div style={{
          position: 'absolute', width: W, height: H,
          transform: `translate(${panX}px, ${panY + driftY}px)`,
        }}>
          {/* Paper */}
          <div style={{
            position: 'absolute',
            left: paperX, top: paperY,
            width: paperW, height: paperH,
            transform: `rotate(${tilt}deg)`,
            transformOrigin: 'center center',
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

            {/* PDF canvas */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <PdfPage
                src={pdfFile}
                pageNumber={page}
                width={paperW}
                renderScale={renderScale}
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
      </div>

      {/* Source badge */}
      {source && <VoxSourceBadge source={source} position="bottom-left" />}

      {/* Film grain */}
      <FilmGrain opacity={0.18} />
    </AbsoluteFill>
  );
};

export default VoxDocument;
