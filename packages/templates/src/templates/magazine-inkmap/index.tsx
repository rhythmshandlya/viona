import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineInkmapProps } from './schema';
import { editorialReveal } from '../../magazine/animations';
import { BurnEdge } from '../../magazine/effects';
import { PaperMapBase } from './components/PaperMapBase';
import { InkMapTiles } from './components/InkMapTiles';
import { InkBorders } from './components/InkBorders';
import { InkRoute } from './components/InkRoute';
import { MapLabel } from './components/MapLabel';

const MagazineInkmap: React.FC<MagazineInkmapProps> = (props) => {
  const frame = useCurrentFrame();

  // ── Phase 1: Paper base + grid appear (0-20) ────────────────────────────
  const paperReveal = editorialReveal(frame, 0, 20);

  const gridOpacity = interpolate(frame, [5, 20], [0, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 2: Tiles fade in + border draws (20-60) ───────────────────────
  const tileOpacity = interpolate(frame, [20, 40], [0, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 4: BurnEdge vignette + fade out (90-120) ──────────────────────
  const burnOpacity = interpolate(frame, [90, 105], [0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [105, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          opacity: paperReveal.opacity * fadeOut,
          transform: `translateY(${paperReveal.translateY}px)`,
        }}
      >
        {/* Layer 1: Aged paper with grid */}
        <PaperMapBase opacity={1} gridOpacity={gridOpacity} />

        {/* Layer 2: Sepia map tiles */}
        <InkMapTiles
          lat={props.regionLat}
          lng={props.regionLng}
          zoom={props.zoomLevel}
          opacity={tileOpacity}
          seed="inkmap-tiles"
        />

        {/* Layer 3: Animated border */}
        <InkBorders
          frame={frame}
          startFrame={20}
          duration={40}
          seed="inkmap-border"
        />

        {/* Layer 4: Animated route (60-90) */}
        <InkRoute
          frame={frame}
          startFrame={60}
          duration={30}
          routePoints={props.routePoints}
          centerLat={props.regionLat}
          centerLng={props.regionLng}
          zoom={props.zoomLevel}
          seed="inkmap-route"
        />

        {/* Layer 5: Map label (60-90) */}
        <MapLabel
          label={props.label}
          frame={frame}
          startFrame={60}
          duration={20}
        />

        {/* Layer 6: Burn edge vignette */}
        <BurnEdge
          intensity={0.5}
          opacity={burnOpacity}
          seed="inkmap-burn"
        />
      </div>
    </AbsoluteFill>
  );
};

export default MagazineInkmap;
