import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants } from './constants';
import type { SatelliteFlyoverProps } from './schema';
import {
  computeViewport,
  computeBezierControl,
  getPointOnQuadBezier,
  getFollowDrawCamera,
  haversineDistance,
  MapTileGrid,
  AnimatedPath,
} from '../../lib/map';
import CloudLayer from './components/CloudLayer';
import LowerThirdLabel from './components/LowerThirdLabel';

/**
 * Satellite Flyover — cinematic satellite pan with cloud overlays
 * and documentary-style lower-third labels.
 *
 * Timeline (360 frames / 12s @ 30fps):
 *   0-30   : Map fades in
 *   30-60  : Start location label slides in
 *   40-280 : Route draws slowly, camera pans following the route
 *   130-150: Start label slides out
 *   240-270: End label slides in
 *   280-340: Camera settles, end label visible
 *   320-360: Everything fades out
 */
const SatelliteFlyover: React.FC<SatelliteFlyoverProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ── Viewport ─────────────────────────────────────────────────────
  const viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    width,
    height,
    props.mapPadding,
  );

  // ── Bezier control point ─────────────────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity,
  );

  // ── Draw progress (slow cinematic draw) ──────────────────────────
  const drawStartFrame = 40;
  const drawEndFrame = 280;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position for camera follow ───────────────────────────────
  const tip = getPointOnQuadBezier(
    viewport.point1.x, viewport.point1.y,
    ctrlX, ctrlY,
    viewport.point2.x, viewport.point2.y,
    drawProgress,
  );

  // ── Route center ─────────────────────────────────────────────────
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera: slow follow-draw then settle ─────────────────────────
  const zoomOutT = interpolate(frame, [260, 320], [0, 1], {
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
    height,
  );

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [320, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Total distance (for optional overlay) ────────────────────────
  const allCoords = [props.startCoord, ...props.waypoints, props.endCoord];
  const totalKm = (() => {
    let km = 0;
    for (let i = 0; i < allCoords.length - 1; i++) {
      km += haversineDistance(
        allCoords[i].lat, allCoords[i].lng,
        allCoords[i + 1].lat, allCoords[i + 1].lng,
      );
    }
    return km;
  })();

  // ── Distance counter (optional) ──────────────────────────────────
  const distanceText = props.showDistance
    ? `${Math.round(totalKm * drawProgress).toLocaleString()} km`
    : null;

  // ── Tile margin for camera-panned rendering ──────────────────────
  const tileMargin = width / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', opacity: fadeOut, overflow: 'hidden' }}>
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
            margin={tileMargin}
          />
        </div>

        {/* Route line */}
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
          height={height}
        />
      </div>

      {/* Fixed overlays (outside camera transform) */}

      {/* Cloud layer */}
      {props.showClouds && <CloudLayer />}

      {/* Lower-third labels */}
      {props.labelStyle !== 'none' && props.startCoord.label && (
        <LowerThirdLabel
          label={props.startCoord.label}
          enterFrame={30}
          exitFrame={130}
          font={FONTS.headline}
          color={COLORS.text}
          accentColor={COLORS.accent}
          style={props.labelStyle === 'minimal' ? 'minimal' : 'lowerThird'}
        />
      )}

      {props.labelStyle !== 'none' && props.endCoord.label && (
        <LowerThirdLabel
          label={props.endCoord.label}
          enterFrame={240}
          exitFrame={320}
          font={FONTS.headline}
          color={COLORS.text}
          accentColor={COLORS.accent}
          style={props.labelStyle === 'minimal' ? 'minimal' : 'lowerThird'}
        />
      )}

      {/* Optional distance counter */}
      {distanceText && (
        <div
          style={{
            position: 'absolute',
            bottom: 70,
            right: 50,
            fontFamily: FONTS.body,
            fontSize: 20,
            fontWeight: 500,
            color: COLORS.text,
            opacity: interpolate(frame, [drawStartFrame, drawStartFrame + 20, drawEndFrame, drawEndFrame + 20], [0, 0.8, 0.8, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            letterSpacing: '0.05em',
          }}
        >
          {distanceText}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default SatelliteFlyover;
