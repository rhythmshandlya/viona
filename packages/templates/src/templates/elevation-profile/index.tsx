import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { getConstants } from './constants';
import type { ElevationProfileProps, Coord } from './schema';
import {
  computeViewport,
  MAP_STYLES,
  computeBezierControl,
  getPointOnQuadBezier,
  getFollowDrawCamera,
  MapTileGrid,
  AnimatedPath,
  LocationMarker,
  LocationLabel,
} from '../../lib/map';
import ElevationChart from './components/ElevationChart';
import AltitudeLabel from './components/AltitudeLabel';
import StatsBadge from './components/StatsBadge';

/**
 * Elevation Profile — split-view map (top 60%) with animated elevation chart (bottom 40%).
 * 360 frames / 12s @ 30fps.
 */
const ElevationProfile: React.FC<ElevationProfileProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Layout ──────────────────────────────────────────────────────
  const mapHeight = Math.round(height * 0.6);
  const chartHeight = height - mapHeight;
  const borderHeight = 2;

  // ── Build the full list of points ──────────────────────────────
  const allCoords: Coord[] = [props.startCoord, ...props.waypoints, props.endCoord];

  // ── Viewport (sized to map section, not full frame) ────────────
  const viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    width,
    mapHeight,
    props.mapPadding
  );

  // ── Bezier control for the route curve ─────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity
  );

  // ── Draw progress: frames 50–280 ──────────────────────────────
  const drawStartFrame = 50;
  const drawEndFrame = 280;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position for camera follow ────────────────────────────
  const tip = getPointOnQuadBezier(
    viewport.point1.x, viewport.point1.y,
    ctrlX, ctrlY,
    viewport.point2.x, viewport.point2.y,
    drawProgress
  );

  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera: follow draw then zoom out ─────────────────────────
  const zoomOutT = interpolate(frame, [260, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const camera = getFollowDrawCamera(
    frame,
    tip,
    { x: routeCenterX, y: routeCenterY },
    zoomOutT,
    width,
    mapHeight
  );

  // ── Fade in / out ─────────────────────────────────────────────
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [320, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Start marker: frame 30 ───────────────────────────────────
  const startMarkerFrame = 30;
  // ── End marker: frame 280 ────────────────────────────────────
  const endMarkerFrame = 280;
  // ── Labels: frame 280 ────────────────────────────────────────
  const labelEnterFrame = 280;

  // ── Peak altitude label position on chart ─────────────────────
  const peakIndex = props.elevationData.reduce(
    (maxIdx, pt, idx, arr) => (pt.altitude > arr[maxIdx].altitude ? idx : maxIdx),
    0
  );
  const peakPoint = props.elevationData[peakIndex];

  // Compute the peak's X position as fraction of distance range
  const minDist = props.elevationData[0]?.distance ?? 0;
  const maxDist = props.elevationData[props.elevationData.length - 1]?.distance ?? 1;
  const distRange = maxDist - minDist || 1;
  const peakFraction = (peakPoint.distance - minDist) / distRange;

  // Chart internal padding matches ElevationChart PADDING
  const chartPadLeft = 80;
  const chartPadRight = 40;
  const chartPadTop = 20;
  const chartPadBottom = 50;
  const plotW = width - chartPadLeft - chartPadRight;
  const plotH = chartHeight - chartPadTop - chartPadBottom;

  const allAlts = props.elevationData.map((p) => p.altitude);
  const rawMinAlt = Math.min(...allAlts);
  const rawMaxAlt = Math.max(...allAlts);
  const altPad = (rawMaxAlt - rawMinAlt) * 0.1;
  const minAlt = Math.max(0, rawMinAlt - altPad);
  const maxAlt = rawMaxAlt + altPad;
  const altRange = maxAlt - minAlt || 1;

  const peakChartX = chartPadLeft + peakFraction * plotW;
  const peakChartY = chartPadTop + (1 - (peakPoint.altitude - minAlt) / altRange) * plotH;

  // Peak label appears when draw progress reaches the peak
  const peakProgressThreshold = peakFraction;
  const peakVisible = props.showPeakLabels && drawProgress >= peakProgressThreshold;
  const peakEnterFrame = Math.round(
    drawStartFrame + peakProgressThreshold * (drawEndFrame - drawStartFrame)
  );

  const labelColor = styleConfig.darkMap ? '#FFFFFF' : COLORS.text;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, opacity: fadeOut, overflow: 'hidden' }}>
      {/* ── Map section (top 60%) ─────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: mapHeight,
          overflow: 'hidden',
        }}
      >
        {/* Camera-transformed world */}
        <div
          style={{
            transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
            width,
            height: mapHeight,
            position: 'absolute',
          }}
        >
          <div style={{ opacity: fadeIn, position: 'absolute', inset: 0 }}>
            <MapTileGrid
              viewport={viewport}
              width={width}
              height={mapHeight}
              mapStyle={props.mapStyle}
              margin={width / 2}
            />
          </div>

          {/* Route path */}
          <AnimatedPath
            x1={viewport.point1.x}
            y1={viewport.point1.y}
            x2={viewport.point2.x}
            y2={viewport.point2.y}
            frame={frame}
            startFrame={drawStartFrame}
            endFrame={drawEndFrame}
            lineColor={props.lineColor}
            lineWidth={props.lineWidth}
            lineStyle="solid"
            curveIntensity={props.curveIntensity}
            width={width}
            height={mapHeight}
          />

          {/* Start marker */}
          <LocationMarker
            x={viewport.point1.x}
            y={viewport.point1.y}
            frame={frame}
            enterFrame={startMarkerFrame}
            color={props.lineColor}
            size={16}
            markerStyle="pulse"
          />

          {/* End marker */}
          <LocationMarker
            x={viewport.point2.x}
            y={viewport.point2.y}
            frame={frame}
            enterFrame={endMarkerFrame}
            color={props.lineColor}
            size={16}
            markerStyle="pinDrop"
          />

          {/* Labels */}
          {props.startCoord.label && (
            <LocationLabel
              x={viewport.point1.x}
              y={viewport.point1.y}
              label={props.startCoord.label}
              frame={frame}
              enterFrame={labelEnterFrame}
              font={FONTS.headline}
              color={labelColor}
              viewportWidth={width}
              darkMap={styleConfig.darkMap}
            />
          )}
          {props.endCoord.label && (
            <LocationLabel
              x={viewport.point2.x}
              y={viewport.point2.y}
              label={props.endCoord.label}
              frame={frame}
              enterFrame={labelEnterFrame}
              font={FONTS.headline}
              color={labelColor}
              viewportWidth={width}
              darkMap={styleConfig.darkMap}
            />
          )}
        </div>
      </div>

      {/* ── Border line ───────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: mapHeight,
          left: 0,
          width,
          height: borderHeight,
          backgroundColor: COLORS.secondary,
          opacity: fadeIn * 0.3,
        }}
      />

      {/* ── Chart section (bottom 40%) ────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: mapHeight + borderHeight,
          left: 0,
          width,
          height: chartHeight - borderHeight,
          opacity: fadeIn,
          overflow: 'hidden',
        }}
      >
        <ElevationChart
          data={props.elevationData}
          unit={props.unit}
          lineColor={props.lineColor}
          drawProgress={drawProgress}
          chartWidth={width}
          chartHeight={chartHeight - borderHeight}
          bodyFont={FONTS.body}
          textColor={COLORS.text}
        />

        {/* Peak altitude label */}
        {peakVisible && (
          <AltitudeLabel
            x={peakChartX}
            y={peakChartY}
            altitude={peakPoint.altitude}
            unit={props.unit}
            frame={frame}
            enterFrame={peakEnterFrame}
            font={FONTS.body}
            accentColor={COLORS.accent}
          />
        )}
      </div>

      {/* ── Stats badge (fixed overlay, bottom-right) ──── */}
      {props.showStats && (
        <StatsBadge
          data={props.elevationData}
          unit={props.unit}
          frame={frame}
          enterFrame={300}
          font={FONTS.body}
          bgColor={COLORS.background}
          textColor={COLORS.text}
          accentColor={COLORS.accent}
        />
      )}
    </AbsoluteFill>
  );
};

export default ElevationProfile;
