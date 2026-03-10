import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants } from './constants';
import type { TerritoryTimelineProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import TerritoryRegion from './components/TerritoryRegion';
import DateCounter from './components/DateCounter';
import ExpansionLine from './components/ExpansionLine';

const ANIMATION_START = 40;
const ANIMATION_END = 300;
const FADEOUT_START = 330;
const FADEOUT_END = 360;

const TerritoryTimeline: React.FC<TerritoryTimelineProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const territories = props.territories;
  const totalTerritories = territories.length;

  // ── Timeline calculation ─────────────────────────────────────────
  const framesPerTerritory =
    totalTerritories > 0
      ? (ANIMATION_END - ANIMATION_START) / totalTerritories
      : ANIMATION_END - ANIMATION_START;

  function getTerritoryStartFrame(i: number): number {
    return Math.round(ANIMATION_START + i * framesPerTerritory);
  }

  // Connection line draws first (starts at territory start)
  function getLineStartFrame(i: number): number {
    return getTerritoryStartFrame(i);
  }

  // Region circle pops in 15 frames after territory start
  function getRegionEnterFrame(i: number): number {
    return getTerritoryStartFrame(i) + 15;
  }

  // ── Current date: the most recently appeared territory ────────────
  let currentDate = territories[0]?.date ?? '';
  for (let i = 0; i < totalTerritories; i++) {
    if (frame >= getRegionEnterFrame(i)) {
      currentDate = territories[i]?.date ?? currentDate;
    }
  }

  // ── Viewport (all territory coords) ─────────────────────────────
  const coords =
    territories.length >= 2
      ? territories.map((t) => ({ lat: t.lat, lng: t.lng }))
      : [
          ...(territories.map((t) => ({ lat: t.lat, lng: t.lng })) || []),
          {
            lat: (territories[0]?.lat ?? 0) + 10,
            lng: (territories[0]?.lng ?? 0) + 10,
          },
        ];

  const multiViewport = computeMultiPointViewport(coords, width, height, props.mapPadding);

  // Build compatible Viewport for MapTileGrid
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // ── Camera ───────────────────────────────────────────────────────
  const camera = getStaticCamera();

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [FADEOUT_START, FADEOUT_END], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Title overlay entrance ────────────────────────────────────────
  const titleEnterScale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Camera-transformed world */}
      <div
        style={{
          transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
          transformOrigin: '0 0',
          width,
          height,
          position: 'absolute',
        }}
      >
        {/* Map tiles */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={0}
          />
        </div>

        {/* Expansion connection lines between sequential territories */}
        {props.showConnections &&
          multiViewport.points.slice(0, -1).map((pt, i) => {
            const nextPt = multiViewport.points[i + 1];
            if (!nextPt) return null;
            return (
              <ExpansionLine
                key={`line-${i}`}
                x1={pt.x}
                y1={pt.y}
                x2={nextPt.x}
                y2={nextPt.y}
                frame={frame}
                startFrame={getLineStartFrame(i + 1)}
                color={props.regionColor}
                viewportWidth={width}
                viewportHeight={height}
              />
            );
          })}

        {/* Territory region circles — staggered chronological pop-in */}
        {territories.map((territory, i) => {
          const pt = multiViewport.points[i];
          if (!pt) return null;
          return (
            <TerritoryRegion
              key={`territory-${i}`}
              x={pt.x}
              y={pt.y}
              label={territory.label}
              date={territory.date}
              radius={territory.radius}
              showDate={props.showDates}
              frame={frame}
              enterFrame={getRegionEnterFrame(i)}
              fps={fps}
              color={props.regionColor}
              font={FONTS.headline}
              darkMap={styleConfig.darkMap}
            />
          );
        })}
      </div>

      {/* Fixed overlays (outside camera transform) */}

      {/* Title — top-left */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 48,
          opacity: titleOpacity,
          transform: `scale(${titleEnterScale})`,
          transformOrigin: 'left center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div
          style={{
            backgroundColor: styleConfig.darkMap
              ? 'rgba(0,0,0,0.6)'
              : 'rgba(255,255,255,0.85)',
            borderRadius: 12,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 20,
            paddingRight: 20,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 32,
              fontWeight: 700,
              color: styleConfig.darkMap ? '#FFFFFF' : COLORS.secondary,
              letterSpacing: 1,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            {props.title}
          </div>
        </div>
      </div>

      {/* Date Counter — top-center */}
      <DateCounter
        currentDate={currentDate}
        frame={frame}
        enterFrame={20}
        fps={fps}
        font={FONTS.headline}
        colors={COLORS}
      />
    </AbsoluteFill>
  );
};

export default TerritoryTimeline;
