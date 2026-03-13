import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants } from './constants';
import type { ChoroplethRaceProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import GrowingBubble from './components/GrowingBubble';
import RankingList from './components/RankingList';
import TimeStepCounter from './components/TimeStepCounter';

const MAP_WIDTH_RATIO = 0.7;
const RANKING_WIDTH_RATIO = 0.3;

const ChoroplethRace: React.FC<ChoroplethRaceProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // Dimensions for left (map) and right (ranking) panels
  const mapWidth = Math.round(width * MAP_WIDTH_RATIO);
  const rankingWidth = Math.round(width * RANKING_WIDTH_RATIO);

  // Need at least 2 coords for computeMultiPointViewport
  const coords = props.regions.length >= 2
    ? props.regions
    : [
        ...props.regions,
        { lat: (props.regions[0]?.lat ?? 0) + 10, lng: (props.regions[0]?.lng ?? 0) + 10, label: '', values: [] },
      ];

  // Compute viewport using the LEFT panel dimensions (70% width, full height)
  const multiViewport = computeMultiPointViewport(coords, mapWidth, height, props.mapPadding);

  // Build compatible Viewport for MapTileGrid
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // Static camera
  const camera = getStaticCamera();

  // ── Time progression ──────────────────────────────────────────────
  // Interpolate frame [40, 300] -> [0, values.length - 1]
  const maxTimeIndex = Math.max(0, props.timeLabels.length - 1);
  const timeIndex = interpolate(frame, [40, 300], [0, maxTimeIndex], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // For each region, interpolate between time steps
  const regionCurrentValues = props.regions.map((region) => {
    const values = region.values;
    if (!values || values.length === 0) return 0;

    const clampedIndex = Math.min(timeIndex, values.length - 1);
    const floorIdx = Math.floor(clampedIndex);
    const ceilIdx = Math.min(Math.ceil(clampedIndex), values.length - 1);

    if (floorIdx === ceilIdx) return values[floorIdx] ?? 0;

    const floorVal = values[floorIdx] ?? 0;
    const ceilVal = values[ceilIdx] ?? 0;

    return interpolate(clampedIndex, [floorIdx, ceilIdx], [floorVal, ceilVal], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  });

  // Max value across all regions and all time steps for normalization
  const globalMaxValue = props.regions.reduce((max, region) => {
    const regionMax = (region.values ?? []).reduce((m, v) => Math.max(m, v), 0);
    return Math.max(max, regionMax);
  }, 1);

  // ── Timing ────────────────────────────────────────────────────────
  const bubbleEnterFrame = 40;
  const rankingEnterFrame = 40;

  // ── Map fade in ────────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ────────────────────────────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Regions for ranking ───────────────────────────────────────────
  const rankedRegions = props.regions.map((region, i) => ({
    label: region.label,
    currentValue: regionCurrentValues[i] ?? 0,
    originalIndex: i,
  }));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {/* Left 70%: Map panel */}
      <div
        style={{
          width: mapWidth,
          height,
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Camera-transformed world */}
        <div
          style={{
            transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
            width: mapWidth,
            height,
            position: 'absolute',
          }}
        >
          {/* Map tiles */}
          <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
            <MapTileGrid
              viewport={viewport}
              width={mapWidth}
              height={height}
              mapStyle={props.mapStyle}
              margin={0}
            />
          </div>

          {/* Growing bubbles */}
          {props.regions.map((region, i) => {
            const pt = multiViewport.points[i];
            if (!pt) return null;
            const currentValue = regionCurrentValues[i] ?? 0;
            return (
              <GrowingBubble
                key={`bubble-${i}`}
                x={pt.x}
                y={pt.y}
                label={region.label}
                currentValue={currentValue}
                maxValue={globalMaxValue}
                color={props.bubbleColor}
                frame={frame}
                enterFrame={bubbleEnterFrame}
                fps={fps}
                font={FONTS.headline}
                darkMap={styleConfig.darkMap}
              />
            );
          })}
        </div>

        {/* TimeStepCounter (top center of map area, outside camera transform) */}
        <TimeStepCounter
          timeLabels={props.timeLabels}
          frame={frame}
          enterFrame={bubbleEnterFrame}
          fps={fps}
          font={FONTS.headline}
          colors={COLORS}
        />
      </div>

      {/* Right 30%: Ranking sidebar */}
      {props.showRanking && (
        <div
          style={{
            width: rankingWidth,
            height,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {frame >= rankingEnterFrame && (
            <RankingList
              regions={rankedRegions}
              maxValue={globalMaxValue}
              frame={frame - rankingEnterFrame}
              fps={fps}
              font={FONTS.headline}
              colors={COLORS}
              metricLabel={props.metricLabel}
            />
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default ChoroplethRace;
