import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxDocumentProps } from './schema';
import { VOX_COLORS, voxEaseOut, voxEaseIn } from '../../vox/constants';
import { highlighterSweep } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxSourceBadge } from '../../vox/typography';
import { useScale } from '../../use-scale';
import { PdfPage } from './components/PdfPage';

// ── Background grid ──────────────────────────────────────────────────
const VoxGrid: React.FC<{ width: number; height: number; spacing: number; opacity: number }> = ({
  width, height, spacing, opacity,
}) => {
  const cols = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity }}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * spacing} y1={0} x2={i * spacing} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * spacing} x2={width} y2={i * spacing} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
    </svg>
  );
};

// ── Highlight overlay ────────────────────────────────────────────────
const HighlightOverlay: React.FC<{
  x: number; y: number; w: number; h: number;
  sweepPercent: number;
  color?: string;
  pageWidth: number;
  pageHeight: number;
}> = ({ x, y, w, h, sweepPercent, color = VOX_COLORS.highlight, pageWidth, pageHeight }) => {
  if (sweepPercent <= 0) return null;

  const left = (x / 100) * pageWidth;
  const top = (y / 100) * pageHeight;
  const width = (w / 100) * pageWidth;
  const height = (h / 100) * pageHeight;

  return (
    <div style={{
      position: 'absolute',
      left,
      top,
      width: width * (sweepPercent / 100),
      height,
      backgroundColor: color,
      opacity: 0.35,
      borderRadius: 2,
      pointerEvents: 'none',
    }} />
  );
};

// ── Main component ───────────────────────────────────────────────────
const VoxDocument: React.FC<VoxDocumentProps> = ({
  pdfFile,
  page,
  highlights,
  zoomRegion,
  zoomLevel,
  tilt,
  renderScale,
  source,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const s = useScale();

  // Paper dimensions (larger than canvas for camera room)
  const paperW = W * 1.3;
  const paperH = paperW * 1.414; // A4 aspect ratio
  const paperX = (W - paperW) / 2;
  const paperY = (H - paperH) / 2;

  // ── Phase timing ──
  const exitStart = durationInFrames - 25;

  // Fade in
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });

  // Fade out
  const fadeOut = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseIn,
  });

  // ── Camera: zoom into the target region ──
  // Compute the center of the zoom region on the paper
  const regionCenterX = paperX + (zoomRegion.x / 100 + zoomRegion.w / 200) * paperW;
  const regionCenterY = paperY + (zoomRegion.y / 100 + zoomRegion.h / 200) * paperH;

  // Zoom interpolation
  const zoom = interpolate(frame, [25, 80], [1, zoomLevel], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });

  // Pan: translate so the zoom region center moves to viewport center
  const panX = interpolate(frame, [25, 80], [0, W / 2 - regionCenterX], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });
  const panY = interpolate(frame, [25, 80], [0, H / 2 - regionCenterY], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
  });

  // Ken Burns drift during hold
  const driftY = interpolate(frame, [80, durationInFrames - 30], [0, -s(15)], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Highlight sweep animations (staggered during zoom) ──
  const highlightSweeps = highlights.map((_, i) => {
    const stagger = i * 12;
    return highlighterSweep(frame, 45 + stagger);
  });

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.warmBlack, overflow: 'hidden' }}>
      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: fadeIn }}>
        <VoxGrid width={W} height={H} spacing={s(40)} opacity={1} />
      </div>

      {/* Camera container */}
      <div style={{
        position: 'absolute',
        width: W,
        height: H,
        transform: `scale(${zoom})`,
        transformOrigin: `${regionCenterX}px ${regionCenterY}px`,
        opacity: fadeIn * fadeOut,
      }}>
        <div style={{
          position: 'absolute',
          width: W,
          height: H,
          transform: `translate(${panX}px, ${panY + driftY}px)`,
        }}>
          {/* Paper with aged texture */}
          <div style={{
            position: 'absolute',
            left: paperX,
            top: paperY,
            width: paperW,
            height: paperH,
            transform: `rotate(${tilt}deg)`,
            transformOrigin: 'center center',
            borderRadius: s(4),
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}>
            {/* Aged paper base */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#F5F0E8' }}>
              <ConstructionPaper color="#EDE8DC" opacity={0.5} seed={3} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(160,130,90,0.15) 100%)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* PDF page canvas */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <PdfPage
                src={pdfFile}
                pageNumber={page}
                width={paperW}
                renderScale={renderScale}
              />
            </div>

            {/* Highlight overlays on top of the PDF */}
            {highlights.map((hl, i) => (
              <HighlightOverlay
                key={i}
                x={hl.x}
                y={hl.y}
                w={hl.w}
                h={hl.h}
                sweepPercent={highlightSweeps[i].widthPercent}
                color={hl.color || VOX_COLORS.highlight}
                pageWidth={paperW}
                pageHeight={paperH}
              />
            ))}
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
