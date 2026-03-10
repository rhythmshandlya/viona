import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants } from './constants';
import type { HeatmapPulseProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import HeatPoint from './components/HeatPoint';
import MetricCounter from './components/MetricCounter';
import GradientLegend from './components/GradientLegend';

const HeatmapPulse: React.FC<HeatmapPulseProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // Require at least 2 points for the viewport computation
  const points = props.points.length >= 2 ? props.points : [
    ...props.points,
    { lat: props.points[0].lat + 10, lng: props.points[0].lng + 10, value: 0, label: '' },
  ];

  // Viewport
  const multiViewport = computeMultiPointViewport(points, width, height, props.mapPadding);

  // Build a compatible Viewport for MapTileGrid
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // Static camera
  const camera = getStaticCamera();

  // Find max value for normalization
  const maxValue = props.points.reduce((max, p) => Math.max(max, p.value), 0) || 1;

  // Timing: each point enters at 40 + i * staggerDelay
  function getPointEnterFrame(index: number): number {
    return 40 + index * props.staggerDelay;
  }

  // How many points have appeared so far
  function getVisiblePoints(): typeof props.points {
    return props.points.filter((_, i) => frame >= getPointEnterFrame(i));
  }

  // Current metric value: sum of values of visible points
  const visiblePoints = getVisiblePoints();
  const currentValue = visiblePoints.reduce((sum, p) => sum + p.value, 0);
  const totalValue = props.points.reduce((sum, p) => sum + p.value, 0);

  // Map fade in
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Global fade out
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
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

        {/* Heat points */}
        {props.points.map((point, i) => {
          const ptPos = multiViewport.points[i];
          if (!ptPos) return null;
          return (
            <HeatPoint
              key={`heat-${i}`}
              x={ptPos.x}
              y={ptPos.y}
              value={point.value}
              maxValue={maxValue}
              label={point.label}
              colorScale={props.colorScale}
              showLabel={props.showLabels}
              frame={frame}
              enterFrame={getPointEnterFrame(i)}
              fps={fps}
              font={FONTS.headline}
              darkMap={styleConfig.darkMap}
            />
          );
        })}
      </div>

      {/* Fixed overlays */}
      <MetricCounter
        title={props.title}
        metricLabel={props.metricLabel}
        currentValue={currentValue}
        totalValue={totalValue}
        frame={frame}
        enterFrame={30}
        font={FONTS.headline}
        colors={COLORS}
        darkMap={styleConfig.darkMap}
      />

      {props.showLegend && (
        <GradientLegend
          colorScale={props.colorScale}
          frame={frame}
          enterFrame={280}
          font={FONTS.body}
          colors={COLORS}
          darkMap={styleConfig.darkMap}
        />
      )}
    </AbsoluteFill>
  );
};

export default HeatmapPulse;
