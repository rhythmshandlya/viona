import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { RoadTripProps, Coord } from './schema';
import {
  computeViewport,
  computeMultiPointViewport,
  MAP_STYLES,
  computeBezierControl,
  getPointOnQuadBezier,
  getFollowDrawCamera,
  haversineDistance,
  MapTileGrid,
  AnimatedPath,
  LocationMarker,
} from '../../lib/map';
import type { Viewport, MultiPointViewport } from '../../lib/map';
import VehicleIcon from './components/VehicleIcon';
import OdometerCounter from './components/OdometerCounter';
import RoadSignLabel from './components/RoadSignLabel';


/**
 * Road Trip — Retro Americana road trip animation (360 frames / 12s @ 30fps).
 *
 * Timeline:
 *   0-30   : Map fades in, start label appears
 *  30-50   : Vehicle appears at start with spring
 *  50-280  : Vehicle follows route, line draws, odometer ticks
 * 280-330  : End marker and label appear
 * 330-360  : Fade out
 */
const RoadTrip: React.FC<RoadTripProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Build full list of points ──────────────────────────────────
  const allCoords: Coord[] = [props.startCoord, ...props.waypoints, props.endCoord];
  const isMultiPoint = allCoords.length > 2;

  // ── Viewport ───────────────────────────────────────────────────
  let viewport: Viewport;
  let multiViewport: MultiPointViewport | null = null;

  if (isMultiPoint) {
    multiViewport = computeMultiPointViewport(allCoords, width, height, props.mapPadding);
    viewport = {
      zoom: multiViewport.zoom,
      offsetX: multiViewport.offsetX,
      offsetY: multiViewport.offsetY,
      point1: multiViewport.points[0],
      point2: multiViewport.points[multiViewport.points.length - 1],
    };
  } else {
    viewport = computeViewport(
      props.startCoord.lat,
      props.startCoord.lng,
      props.endCoord.lat,
      props.endCoord.lng,
      width,
      height,
      props.mapPadding
    );
  }

  // ── Bezier control for 2-point path ────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity
  );

  // ── Draw progress ──────────────────────────────────────────────
  const DRAW_START = 50;
  const DRAW_END = 280;

  const drawProgress = interpolate(frame, [DRAW_START, DRAW_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position ───────────────────────────────────────────────
  function getMultiStopTip(): { x: number; y: number } {
    if (!multiViewport || multiViewport.points.length < 2) {
      return getPointOnQuadBezier(
        viewport.point1.x, viewport.point1.y,
        ctrlX, ctrlY,
        viewport.point2.x, viewport.point2.y,
        drawProgress
      );
    }
    const pts = multiViewport.points;
    const segCount = pts.length - 1;
    const rawSeg = drawProgress * segCount;
    const segIdx = Math.min(Math.floor(rawSeg), segCount - 1);
    const segT = rawSeg - segIdx;

    const p1 = pts[segIdx];
    const p2 = pts[segIdx + 1];
    const ctrl = computeBezierControl(p1.x, p1.y, p2.x, p2.y, props.curveIntensity);
    return getPointOnQuadBezier(p1.x, p1.y, ctrl.cx, ctrl.cy, p2.x, p2.y, segT);
  }

  const tip = isMultiPoint
    ? getMultiStopTip()
    : getPointOnQuadBezier(
        viewport.point1.x, viewport.point1.y,
        ctrlX, ctrlY,
        viewport.point2.x, viewport.point2.y,
        drawProgress
      );

  // ── Tangent angle for vehicle rotation ─────────────────────────
  function getTangentAngle(): number {
    const epsilon = 0.005;
    const tAhead = Math.min(drawProgress + epsilon, 1);

    let tipAhead: { x: number; y: number };
    if (isMultiPoint && multiViewport && multiViewport.points.length >= 2) {
      const pts = multiViewport.points;
      const segCount = pts.length - 1;
      const rawSeg = tAhead * segCount;
      const segIdx = Math.min(Math.floor(rawSeg), segCount - 1);
      const segT = rawSeg - segIdx;
      const p1 = pts[segIdx];
      const p2 = pts[segIdx + 1];
      const ctrl = computeBezierControl(p1.x, p1.y, p2.x, p2.y, props.curveIntensity);
      tipAhead = getPointOnQuadBezier(p1.x, p1.y, ctrl.cx, ctrl.cy, p2.x, p2.y, segT);
    } else {
      tipAhead = getPointOnQuadBezier(
        viewport.point1.x, viewport.point1.y,
        ctrlX, ctrlY,
        viewport.point2.x, viewport.point2.y,
        tAhead
      );
    }

    const dx = tipAhead.x - tip.x;
    const dy = tipAhead.y - tip.y;
    return Math.atan2(dy, dx);
  }

  // ── Route center ───────────────────────────────────────────────
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera: follow-draw at higher zoom ─────────────────────────
  const zoomOutT = interpolate(frame, [260, 310], [0, 1], {
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

  // ── Map fade in ────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ────────────────────────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Vehicle entrance spring ────────────────────────────────────
  const vehicleVisible = frame >= 30;
  const vehicleScale = vehicleVisible
    ? spring({
        frame: frame - 30,
        fps,
        config: { damping: 22, stiffness: 180, mass: 0.8 },
      })
    : 0;

  // ── Total distance ─────────────────────────────────────────────
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

  // ── Title animation ───────────────────────────────────────────
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Compass entrance ──────────────────────────────────────────
  const compassEnterProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // ── Render paths ───────────────────────────────────────────────
  function renderPaths() {
    if (isMultiPoint && multiViewport) {
      const pts = multiViewport.points;
      const segCount = pts.length - 1;
      const totalDrawFrames = DRAW_END - DRAW_START;
      const framesPerSeg = totalDrawFrames / segCount;

      return pts.slice(0, -1).map((pt, i) => (
        <AnimatedPath
          key={`seg-${i}`}
          x1={pt.x}
          y1={pt.y}
          x2={pts[i + 1].x}
          y2={pts[i + 1].y}
          frame={frame}
          startFrame={DRAW_START + Math.round(i * framesPerSeg)}
          endFrame={DRAW_START + Math.round((i + 1) * framesPerSeg)}
          lineColor={props.lineColor}
          lineWidth={props.lineWidth}
          lineStyle={props.lineStyle}
          curveIntensity={props.curveIntensity}
          width={width}
          height={height}
        />
      ));
    }

    return (
      <AnimatedPath
        x1={viewport.point1.x}
        y1={viewport.point1.y}
        x2={viewport.point2.x}
        y2={viewport.point2.y}
        frame={frame}
        startFrame={DRAW_START}
        endFrame={DRAW_END}
        lineColor={props.lineColor}
        lineWidth={props.lineWidth}
        lineStyle={props.lineStyle}
        curveIntensity={props.curveIntensity}
        width={width}
        height={height}
      />
    );
  }

  // ── Render markers ─────────────────────────────────────────────
  function renderMarkers() {
    const startEnter = 20;
    const endEnter = 280;

    if (isMultiPoint && multiViewport) {
      return multiViewport.points.map((pt, i) => {
        const total = multiViewport!.points.length;
        let enter: number;
        if (i === 0) enter = startEnter;
        else if (i === total - 1) enter = endEnter;
        else {
          const segCount = total - 1;
          const framesPerSeg = (DRAW_END - DRAW_START) / segCount;
          enter = DRAW_START + Math.round(i * framesPerSeg);
        }
        return (
          <LocationMarker
            key={`marker-${i}`}
            x={pt.x}
            y={pt.y}
            frame={frame}
            enterFrame={enter}
            color={props.lineColor}
            size={s(14)}
            markerStyle="pulse"
          />
        );
      });
    }

    return (
      <>
        <LocationMarker
          x={viewport.point1.x}
          y={viewport.point1.y}
          frame={frame}
          enterFrame={startEnter}
          color={props.lineColor}
          size={s(14)}
          markerStyle="pulse"
        />
        <LocationMarker
          x={viewport.point2.x}
          y={viewport.point2.y}
          frame={frame}
          enterFrame={endEnter}
          color={props.lineColor}
          size={s(14)}
          markerStyle="pulse"
        />
      </>
    );
  }

  // ── Render labels (start / end) ────────────────────────────────
  function renderStartLabel() {
    if (!props.showLabels || !props.startCoord.label) return null;

    return (
      <RoadSignLabel
        x={viewport.point1.x}
        y={viewport.point1.y}
        label={props.startCoord.label}
        frame={frame}
        enterFrame={15}
        font={FONTS.headline}
      />
    );
  }

  function renderEndLabel() {
    if (!props.showLabels || !props.endCoord.label) return null;

    return (
      <RoadSignLabel
        x={viewport.point2.x}
        y={viewport.point2.y}
        label={props.endCoord.label}
        frame={frame}
        enterFrame={285}
        font={FONTS.headline}
      />
    );
  }

  // ── Render waypoint labels ─────────────────────────────────────
  function renderWaypointLabels() {
    if (!props.showLabels || !isMultiPoint || !multiViewport) return null;

    return multiViewport.points.slice(1, -1).map((pt, i) => {
      const coord = props.waypoints[i];
      if (!coord?.label) return null;

      const total = multiViewport!.points.length;
      const segCount = total - 1;
      const framesPerSeg = (DRAW_END - DRAW_START) / segCount;
      const enter = DRAW_START + Math.round((i + 1) * framesPerSeg);

      return (
        <RoadSignLabel
          key={`wp-label-${i}`}
          x={pt.x}
          y={pt.y}
          label={coord.label}
          frame={frame}
          enterFrame={enter}
          font={FONTS.headline}
        />
      );
    });
  }

  // ── Tile margin for camera panning ─────────────────────────────
  const tileMargin = width / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: styleConfig.background, opacity: fadeOut, overflow: 'hidden' }}>
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

        {/* Animated route path */}
        {renderPaths()}

        {/* Location markers */}
        {renderMarkers()}

        {/* Start label */}
        {renderStartLabel()}

        {/* End label */}
        {renderEndLabel()}

        {/* Waypoint labels */}
        {renderWaypointLabels()}

        {/* Vehicle icon at path tip */}
        {vehicleVisible && frame >= DRAW_START && (
          <div style={{ transform: `scale(${vehicleScale})`, transformOrigin: 'center center' }}>
            <VehicleIcon
              x={tip.x}
              y={tip.y}
              angle={getTangentAngle()}
              vehicleType={props.vehicleType}
              size={s(48)}
              color={props.lineColor}
            />
          </div>
        )}
      </div>

      {/* Fixed-position overlays (outside camera transform) */}

      {/* Title header */}
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

      {/* Odometer counter */}
      {props.showDistance && (
        <OdometerCounter
          totalKm={totalKm}
          progress={drawProgress}
          frame={frame}
          enterFrame={DRAW_START}
          unit={props.unit}
          font={FONTS.body}
        />
      )}
    </AbsoluteFill>
  );
};

/**
 * Inline compass rose SVG.
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
      {/* North pointer (orange) */}
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

export default RoadTrip;
