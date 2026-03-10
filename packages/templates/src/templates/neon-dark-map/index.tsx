import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants } from './constants';
import type { NeonDarkMapProps } from './schema';
import {
  computeViewport,
  computeBezierControl,
  getPointOnQuadBezier,
  getFollowDrawCamera,
  haversineDistance,
  formatDistance,
  MapTileGrid,
  MAP_STYLES,
} from '../../lib/map';
import NeonPath from './components/NeonPath';
import GlowMarker from './components/GlowMarker';
import NeonLabel from './components/NeonLabel';

/**
 * Neon Dark Map — futuristic dark map with neon glow route.
 * Timeline (300 frames / 10s @ 30fps):
 *   0-30:   Map fades in
 *   30-40:  Start marker appears
 *   40-220: NeonPath draws, camera follows
 *   220-260: End marker + labels fade in (staggered)
 *   260-300: Distance counter, fade out
 */
const NeonDarkMap: React.FC<NeonDarkMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Viewport ─────────────────────────────────────────────────────
  const viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    width,
    height,
    props.mapPadding
  );

  // ── Bezier control ──────────────────────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity
  );

  // ── Draw progress ───────────────────────────────────────────────
  const drawStartFrame = 40;
  const drawEndFrame = 220;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position for camera follow ─────────────────────────────
  const tip = getPointOnQuadBezier(
    viewport.point1.x,
    viewport.point1.y,
    ctrlX,
    ctrlY,
    viewport.point2.x,
    viewport.point2.y,
    drawProgress
  );

  // ── Route center ───────────────────────────────────────────────
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera ─────────────────────────────────────────────────────
  const zoomOutT = interpolate(frame, [220, 260], [0, 1], {
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
    height
  );

  const tileMargin = width / 2;

  // ── Map fade in ────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ────────────────────────────────────────────
  const fadeOut = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Distance ──────────────────────────────────────────────────
  const allCoords = [props.startCoord, ...props.waypoints, props.endCoord];
  const totalKm = (() => {
    let km = 0;
    for (let i = 0; i < allCoords.length - 1; i++) {
      km += haversineDistance(
        allCoords[i].lat,
        allCoords[i].lng,
        allCoords[i + 1].lat,
        allCoords[i + 1].lng
      );
    }
    return km;
  })();

  // ── Distance counter animation ─────────────────────────────────
  const distanceOpacity = interpolate(frame, [260, 275], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const distanceFadeOut = interpolate(frame, [290, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const displayedKm = Math.round(drawProgress * totalKm);

  return (
    <AbsoluteFill
      style={{ backgroundColor: styleConfig.background, opacity: fadeOut, overflow: 'hidden' }}
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
            margin={tileMargin}
          />
        </div>

        {/* Neon path */}
        <NeonPath
          x1={viewport.point1.x}
          y1={viewport.point1.y}
          x2={viewport.point2.x}
          y2={viewport.point2.y}
          frame={frame}
          startFrame={drawStartFrame}
          endFrame={drawEndFrame}
          neonColor={props.neonColor}
          lineWidth={props.lineWidth}
          glowIntensity={props.glowIntensity}
          curveIntensity={props.curveIntensity}
          width={width}
          height={height}
        />

        {/* Start marker */}
        <GlowMarker
          x={viewport.point1.x}
          y={viewport.point1.y}
          frame={frame}
          enterFrame={30}
          neonColor={props.neonColor}
          glowIntensity={props.glowIntensity}
        />

        {/* End marker */}
        <GlowMarker
          x={viewport.point2.x}
          y={viewport.point2.y}
          frame={frame}
          enterFrame={220}
          neonColor={props.neonColor}
          glowIntensity={props.glowIntensity}
        />

        {/* Labels */}
        {props.showLabels && props.startCoord.label && (
          <NeonLabel
            x={viewport.point1.x}
            y={viewport.point1.y}
            label={props.startCoord.label}
            frame={frame}
            enterFrame={228}
            neonColor={props.neonColor}
            glowIntensity={props.glowIntensity}
            font={FONTS.headline}
          />
        )}
        {props.showLabels && props.endCoord.label && (
          <NeonLabel
            x={viewport.point2.x}
            y={viewport.point2.y}
            label={props.endCoord.label}
            frame={frame}
            enterFrame={236}
            neonColor={props.neonColor}
            glowIntensity={props.glowIntensity}
            font={FONTS.headline}
          />
        )}
      </div>

      {/* Fixed-position distance overlay (outside camera transform) */}
      {props.showDistance && frame >= 260 && (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: distanceOpacity * distanceFadeOut,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 28,
              fontWeight: 700,
              color: '#FFFFFF',
              textShadow: `0 0 10px ${props.neonColor}, 0 0 20px ${props.neonColor}, 0 0 40px ${props.neonColor}`,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {formatDistance(displayedKm)}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default NeonDarkMap;
