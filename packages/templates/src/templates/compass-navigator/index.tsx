import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { CompassNavigatorProps } from './schema';
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
import CompassRoseEnhanced from './components/CompassRoseEnhanced';
import AnimatedNeedle from './components/AnimatedNeedle';
import BearingLabel from './components/BearingLabel';

/**
 * Compute geodetic bearing from start to end coordinates.
 * Uses the forward azimuth formula for great-circle navigation.
 */
function computeBearing(
  lat1Deg: number,
  lng1Deg: number,
  lat2Deg: number,
  lng2Deg: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(lat1Deg);
  const lat2 = toRad(lat2Deg);
  const dLng = toRad(lng2Deg - lng1Deg);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360; // Normalize to 0-360
}

/**
 * Compass Navigator
 *
 * 4-phase animation:
 * Phase 1 (0-90): Compass rose fades in, needle spins to bearing
 * Phase 2 (90-180): Map fades in, compass shrinks to corner
 * Phase 3 (180-330): Route draws on map with follow camera
 * Phase 4 (330-360): Fade out
 */
const CompassNavigator: React.FC<CompassNavigatorProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Bearing calculation ──────────────────────────────────────────
  const bearing = computeBearing(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
  );

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

  // ── Bezier control for curved path ───────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity,
  );

  // ── Phase 1: Compass rose entrance (0-90) ────────────────────────

  // Compass fade in
  const compassFadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Needle spin: spring from 0 to bearing with overshoot
  // We add an extra full rotation (360) to make the spin dramatic
  const needleSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const needleRotation = needleSpring * (360 + bearing);

  // ── Phase 2: Compass shrinks, map reveals (90-180) ───────────────

  // Compass scale: 1 -> 0.35 (40% of frame -> 15% of frame)
  const compassScale = interpolate(frame, [90, 170], [1, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Compass translate to bottom-right corner
  // Centered position = (width/2, height/2)
  // Corner position: we want compass center at roughly (width - compassRadius - margin, height - compassRadius - margin)
  const compassDiameter = s(430);
  const cornerMargin = s(30);
  const compassCornerX = width - (compassDiameter * 0.35) / 2 - cornerMargin;
  const compassCornerY = height - (compassDiameter * 0.35) / 2 - cornerMargin;

  const compassX = interpolate(frame, [90, 170], [width / 2, compassCornerX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const compassY = interpolate(frame, [90, 170], [height / 2, compassCornerY], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Map tiles fade in
  const mapOpacity = interpolate(frame, [90, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 3: Route draws (180-330) ───────────────────────────────

  const drawStartFrame = 180;
  const drawEndFrame = 310;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Tip position for camera follow
  const tip = getPointOnQuadBezier(
    viewport.point1.x,
    viewport.point1.y,
    ctrlX,
    ctrlY,
    viewport.point2.x,
    viewport.point2.y,
    drawProgress,
  );

  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // Camera: follow draw, then zoom out
  const zoomOutT = interpolate(frame, [290, 330], [0, 1], {
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

  // ── Phase 4: Fade out (330-360) ──────────────────────────────────

  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Marker timing ────────────────────────────────────────────────

  const startMarkerEnter = 180;
  const endMarkerEnter = drawEndFrame;
  const labelEnterFrame = 300;

  // ── Compass corner opacity during route draw ─────────────────────
  const compassCornerOpacity = interpolate(frame, [170, 180], [1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Bearing label position ───────────────────────────────────────
  // Phase 1: centered below compass. Phase 2+: near compass corner.
  const bearingLabelX = interpolate(frame, [90, 170], [width / 2, compassCornerX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const bearingLabelY = interpolate(
    frame,
    [90, 170],
    [height / 2 + compassDiameter * compassScale * 0.5 + s(20), compassCornerY + (compassDiameter * 0.35) / 2 + s(12)],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const labelColor = styleConfig.darkMap ? '#FFFFFF' : COLORS.text;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: frame < 90 ? COLORS.background : styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Map layer (behind compass) — only visible after phase 2 */}
      {frame >= 90 && (
        <div
          style={{
            transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
            width,
            height,
            position: 'absolute',
            opacity: mapOpacity,
          }}
        >
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={width / 2}
          />

          {/* Animated route path */}
          {frame >= drawStartFrame && (
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
          )}

          {/* Start marker */}
          <LocationMarker
            x={viewport.point1.x}
            y={viewport.point1.y}
            frame={frame}
            enterFrame={startMarkerEnter}
            color={COLORS.accent}
            size={s(18)}
            markerStyle="pulse"
          />

          {/* End marker */}
          <LocationMarker
            x={viewport.point2.x}
            y={viewport.point2.y}
            frame={frame}
            enterFrame={endMarkerEnter}
            color={COLORS.accent}
            size={s(18)}
            markerStyle="pulse"
          />

          {/* Labels */}
          {props.showLabels && props.startCoord.label && (
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
          {props.showLabels && props.endCoord.label && (
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
      )}

      {/* Compass overlay (fixed position, outside camera transform) */}
      <div
        style={{
          position: 'absolute',
          left: compassX,
          top: compassY,
          transform: `translate(-50%, -50%) scale(${compassScale})`,
          opacity: compassFadeIn * compassCornerOpacity,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <CompassRoseEnhanced
          size={compassDiameter}
          compassStyle={props.compassStyle}
          primaryColor={COLORS.primary}
          secondaryColor={COLORS.secondary}
          accentColor={COLORS.accent}
        />
        <AnimatedNeedle
          size={compassDiameter}
          rotation={needleRotation}
          accentColor={COLORS.accent}
        />
      </div>

      {/* Bearing label */}
      {props.showBearing && (
        <div
          style={{
            position: 'absolute',
            left: bearingLabelX,
            top: bearingLabelY,
            transform: 'translate(-50%, 0)',
            zIndex: 11,
            pointerEvents: 'none',
          }}
        >
          <BearingLabel
            bearingDeg={bearing}
            frame={frame}
            enterFrame={50}
            font={FONTS.body}
            color={frame < 90 ? COLORS.text : (styleConfig.darkMap ? '#FFFFFF' : COLORS.text)}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};

export default CompassNavigator;
