import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { IndianaJonesProps, Coord } from './schema';
import {
  computeViewport,
  MAP_STYLES,
  computeBezierControl,
  getPointOnQuadBezier,
  getFollowDrawCamera,
  haversineDistance,
  formatDistance,
  MapTileGrid,
  AnimatedPath,
  LocationMarker,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import VintageOverlay from './components/VintageOverlay';
import SerifLabel from './components/SerifLabel';
import AirplaneTrail from './components/AirplaneTrail';

/**
 * Indiana Jones Trail — vintage red dashed line map animation.
 *
 * Timeline (300 frames / 10s @ 30fps):
 * - 0–30: Title fade in + map fade in
 * - 40–220: Line draws along route, airplane follows tip, camera follows
 * - 220–280: Camera zooms out to show full route
 * - 240+: City labels appear
 * - 270–300: Fade out
 */
const IndianaJones: React.FC<IndianaJonesProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Build the full list of points ────────────────────────────────
  const allCoords: Coord[] = [props.startCoord, ...props.waypoints, props.endCoord];

  // ── Viewport ─────────────────────────────────────────────────────
  const viewport: Viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    width,
    height,
    props.mapPadding
  );

  // ── Bezier control for the curve ─────────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity
  );

  // ── Draw progress ────────────────────────────────────────────────
  const drawStartFrame = 40;
  const drawEndFrame = 220;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position (for camera follow + airplane) ──────────────────
  const tip = getPointOnQuadBezier(
    viewport.point1.x, viewport.point1.y,
    ctrlX, ctrlY,
    viewport.point2.x, viewport.point2.y,
    drawProgress
  );

  // ── Route center ────────────────────────────────────────────────
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera: follow draw then zoom out ────────────────────────────
  const zoomOutT = interpolate(frame, [220, 280], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const camera = getFollowDrawCamera(
    frame, tip, { x: routeCenterX, y: routeCenterY }, zoomOutT, width, height
  );

  // ── Map fade in ─────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ─────────────────────────────────────────────
  const fadeOut = interpolate(frame, [270, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Title animation ─────────────────────────────────────────────
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Airplane tangent angle ──────────────────────────────────────
  function getTangentAngle(): number {
    const t = drawProgress;
    const p0 = viewport.point1;
    const p1 = viewport.point2;
    const dx = 2 * (1 - t) * (ctrlX - p0.x) + 2 * t * (p1.x - ctrlX);
    const dy = 2 * (1 - t) * (ctrlY - p0.y) + 2 * t * (p1.y - ctrlY);
    return Math.atan2(dy, dx);
  }

  // ── Total distance ──────────────────────────────────────────────
  const totalKm = (() => {
    let km = 0;
    for (let i = 0; i < allCoords.length - 1; i++) {
      km += haversineDistance(
        allCoords[i].lat, allCoords[i].lng,
        allCoords[i + 1].lat, allCoords[i + 1].lng
      );
    }
    return km;
  })();

  // ── Distance counter animation ──────────────────────────────────
  const distanceEnterProgress = spring({
    frame: frame - drawStartFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // ── Compass rotation ────────────────────────────────────────────
  const compassEnterProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // ── Label enter frame ───────────────────────────────────────────
  const labelEnterFrame = 240;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, opacity: fadeOut, overflow: 'hidden' }}>
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
        {/* Map tiles with sepia vintage filter */}
        <div
          style={{
            opacity: mapOpacity,
            position: 'absolute',
            inset: 0,
            filter: 'sepia(0.7) contrast(1.1) brightness(1.05)',
          }}
        >
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={width / 2}
          />
        </div>

        {/* Red dashed animated path */}
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
          lineStyle="dashed"
          curveIntensity={props.curveIntensity}
          width={width}
          height={height}
        />

        {/* Start marker */}
        <LocationMarker
          x={viewport.point1.x}
          y={viewport.point1.y}
          frame={frame}
          enterFrame={30}
          color={props.lineColor}
          size={18}
          markerStyle="pinDrop"
        />

        {/* End marker */}
        <LocationMarker
          x={viewport.point2.x}
          y={viewport.point2.y}
          frame={frame}
          enterFrame={labelEnterFrame}
          color={props.lineColor}
          size={18}
          markerStyle="pinDrop"
        />

        {/* Airplane following the path tip */}
        {frame >= drawStartFrame && frame <= drawEndFrame && (
          <AirplaneTrail
            x={tip.x}
            y={tip.y}
            angle={getTangentAngle()}
            size={s(28)}
            color={props.lineColor}
          />
        )}

        {/* City labels */}
        {props.startCoord.label && (
          <SerifLabel
            x={viewport.point1.x}
            y={viewport.point1.y}
            label={props.startCoord.label}
            frame={frame}
            enterFrame={labelEnterFrame}
            font={FONTS.headline}
            color={COLORS.text}
          />
        )}
        {props.endCoord.label && (
          <SerifLabel
            x={viewport.point2.x}
            y={viewport.point2.y}
            label={props.endCoord.label}
            frame={frame}
            enterFrame={labelEnterFrame + 8}
            font={FONTS.headline}
            color={COLORS.text}
          />
        )}
      </div>

      {/* Fixed-position overlays (outside camera transform) */}

      {/* Vintage parchment overlay */}
      <VintageOverlay width={width} height={height} />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: s(40),
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleProgress) * 20}px)`,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(42),
            fontWeight: 700,
            color: COLORS.text,
            textShadow: '2px 2px 6px rgba(0, 0, 0, 0.3)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {props.title}
        </div>
      </div>

      {/* Distance counter */}
      {props.showDistance && frame >= drawStartFrame && (
        <div
          style={{
            position: 'absolute',
            bottom: s(30),
            left: s(30),
            opacity: distanceEnterProgress,
            transform: `translateY(${(1 - distanceEnterProgress) * 15}px)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: s(18),
              fontWeight: 600,
              color: COLORS.text,
              textShadow: '1px 1px 3px rgba(0, 0, 0, 0.3)',
              backgroundColor: 'rgba(245, 230, 200, 0.7)',
              padding: `${s(6)}px ${s(14)}px`,
              borderRadius: s(4),
              border: `1px solid ${COLORS.accent}`,
            }}
          >
            {formatDistance(Math.round(totalKm * drawProgress))}
          </div>
        </div>
      )}

      {/* Compass rose */}
      {props.showCompass && (
        <div
          style={{
            position: 'absolute',
            top: s(20),
            right: s(20),
            opacity: compassEnterProgress * 0.7,
            transform: `scale(${0.5 + compassEnterProgress * 0.5})`,
            pointerEvents: 'none',
          }}
        >
          <CompassRoseInline
            size={s(70)}
            color={COLORS.secondary}
            accentColor={COLORS.primary}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Inline compass rose SVG to avoid cross-template import issues.
 */
const CompassRoseInline: React.FC<{
  size: number;
  color: string;
  accentColor: string;
}> = ({ size, color, accentColor }) => {
  const half = size / 2;
  const armLen = half - 6;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer circle */}
      <circle
        cx={half}
        cy={half}
        r={half - 2}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Inner circle */}
      <circle
        cx={half}
        cy={half}
        r={half * 0.35}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.4}
      />
      {/* North pointer (red) */}
      <polygon
        points={`${half},${half - armLen} ${half - 5},${half} ${half + 5},${half}`}
        fill={accentColor}
        opacity={0.8}
      />
      {/* South pointer */}
      <polygon
        points={`${half},${half + armLen} ${half - 5},${half} ${half + 5},${half}`}
        fill={color}
        opacity={0.4}
      />
      {/* East pointer */}
      <polygon
        points={`${half + armLen},${half} ${half},${half - 4} ${half},${half + 4}`}
        fill={color}
        opacity={0.4}
      />
      {/* West pointer */}
      <polygon
        points={`${half - armLen},${half} ${half},${half - 4} ${half},${half + 4}`}
        fill={color}
        opacity={0.4}
      />
      {/* Cardinal labels */}
      <text
        x={half}
        y={half - armLen + 14}
        textAnchor="middle"
        fill={accentColor}
        fontSize={10}
        fontWeight="bold"
      >
        N
      </text>
      <text
        x={half}
        y={half + armLen - 6}
        textAnchor="middle"
        fill={color}
        fontSize={8}
        opacity={0.6}
      >
        S
      </text>
      <text
        x={half + armLen - 8}
        y={half + 3}
        textAnchor="middle"
        fill={color}
        fontSize={8}
        opacity={0.6}
      >
        E
      </text>
      <text
        x={half - armLen + 8}
        y={half + 3}
        textAnchor="middle"
        fill={color}
        fontSize={8}
        opacity={0.6}
      >
        W
      </text>
    </svg>
  );
};

export default IndianaJones;
