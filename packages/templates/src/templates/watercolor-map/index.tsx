import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { WatercolorMapProps, Coord } from './schema';
import {
  computeViewport,
  computeMultiPointViewport,
  MAP_STYLES,
  computeBezierControl,
  getPointOnQuadBezier,
} from './lib/tile-math';
import type { Viewport, MultiPointViewport } from './lib/tile-math';
import {
  getFollowDrawCamera,
  getZoomRevealCamera,
  getKenBurnsCamera,
  getStaticCamera,
} from './lib/camera';
import { haversineDistance } from './lib/distance';
import MapTileGrid from './components/MapTileGrid';
import AnimatedPath from './components/AnimatedPath';
import LocationMarker from './components/LocationMarker';
import LocationLabel from './components/LocationLabel';
import AirplaneIcon from './components/AirplaneIcon';
import DistanceCounter from './components/DistanceCounter';
import ProgressBar from './components/ProgressBar';
import CompassRose from './components/CompassRose';

/**
 * Animation timeline (360 frames / 12s @ 30fps).
 * Each animation type has its own phase timing — see the camera/content
 * switch blocks below.
 */
const WatercolorMap: React.FC<WatercolorMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];
  const animationType = props.animationType;

  // ── Build the full list of points ────────────────────────────────
  const allCoords: Coord[] = [props.startCoord, ...props.waypoints, props.endCoord];
  const isMultiPoint = animationType === 'multiStop' || animationType === 'hubAndSpoke';

  // ── Viewport ─────────────────────────────────────────────────────
  let viewport: Viewport;
  let multiViewport: MultiPointViewport | null = null;

  if (isMultiPoint) {
    multiViewport = computeMultiPointViewport(allCoords, width, height, props.mapPadding);
    // Build a compatible Viewport from the multi-point result for MapTileGrid
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

  // ── Bezier control for 2-point paths ─────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity
  );

  // ── Draw progress (timing varies by animation type) ──────────────
  const drawStartFrame = animationType === 'zoomReveal' ? 110 : 60;
  const drawEndFrame = animationType === 'zoomReveal' ? 280 : 240;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position (for 2-point camera follow) ────────────────────
  const tip = getPointOnQuadBezier(
    viewport.point1.x, viewport.point1.y,
    ctrlX, ctrlY,
    viewport.point2.x, viewport.point2.y,
    drawProgress
  );

  // ── Route center ────────────────────────────────────────────────
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera ──────────────────────────────────────────────────────
  const zoomOutT = interpolate(frame, [260, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // MultiStop tip helper (needs to be defined before camera computation)
  function getMultiStopTip(): { x: number; y: number } {
    if (!multiViewport || multiViewport.points.length < 2) return tip;
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

  const camera = (() => {
    switch (animationType) {
      case 'zoomReveal':
        return getZoomRevealCamera(frame, width, height);
      case 'kenBurns':
        return getKenBurnsCamera(frame, width, height);
      case 'hubAndSpoke':
        return getStaticCamera();
      case 'multiStop':
        return getFollowDrawCamera(frame, getMultiStopTip(), { x: routeCenterX, y: routeCenterY }, zoomOutT, width, height);
      case 'airplaneArc':
      case 'followDraw':
      default:
        return getFollowDrawCamera(frame, tip, { x: routeCenterX, y: routeCenterY }, zoomOutT, width, height);
    }
  })();

  // ── Tile margin ─────────────────────────────────────────────────
  const tileMargin = (animationType === 'hubAndSpoke' || animationType === 'zoomReveal') ? 0 : width / 2;

  // ── Map fade in ─────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Global fade out ─────────────────────────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
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

  // ── Total distance for overlay ──────────────────────────────────
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

  // ── Marker timing helpers ───────────────────────────────────────
  function getMarkerEnterFrame(index: number, total: number): number {
    switch (animationType) {
      case 'zoomReveal':
        return index === 0 ? 90 : 280;
      case 'kenBurns':
        return 30 + index * 15;
      case 'hubAndSpoke': {
        if (index === 0) return 30;
        return 220 + (index - 1) * 5;
      }
      case 'multiStop': {
        if (index === 0) return 30;
        if (index === total - 1) return drawEndFrame;
        const segCount = total - 1;
        const framesPerSeg = 180 / segCount;
        return drawStartFrame + Math.round(index * framesPerSeg);
      }
      default:
        return index === 0 ? 30 : 240;
    }
  }

  function getLabelEnterFrame(): number {
    switch (animationType) {
      case 'zoomReveal': return 300;
      case 'kenBurns': return 240;
      case 'hubAndSpoke': return 260;
      case 'multiStop': return 270;
      default: return 270;
    }
  }

  // ── Render paths ────────────────────────────────────────────────
  function renderPaths() {
    if (animationType === 'hubAndSpoke' && multiViewport) {
      const center = multiViewport.points[0];
      return multiViewport.points.slice(1).map((pt, i) => (
        <AnimatedPath
          key={`spoke-${i}`}
          x1={center.x}
          y1={center.y}
          x2={pt.x}
          y2={pt.y}
          frame={frame}
          startFrame={60}
          endFrame={220}
          lineColor={props.lineColor}
          lineWidth={props.lineWidth}
          lineStyle={props.lineStyle}
          curveIntensity={props.curveIntensity}
          width={width}
          height={height}
        />
      ));
    }

    if (animationType === 'multiStop' && multiViewport) {
      const pts = multiViewport.points;
      const segCount = pts.length - 1;
      const totalDrawFrames = drawEndFrame - drawStartFrame;
      const framesPerSeg = totalDrawFrames / segCount;

      return pts.slice(0, -1).map((pt, i) => (
        <AnimatedPath
          key={`seg-${i}`}
          x1={pt.x}
          y1={pt.y}
          x2={pts[i + 1].x}
          y2={pts[i + 1].y}
          frame={frame}
          startFrame={drawStartFrame + Math.round(i * framesPerSeg)}
          endFrame={drawStartFrame + Math.round((i + 1) * framesPerSeg)}
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
        startFrame={drawStartFrame}
        endFrame={drawEndFrame}
        lineColor={props.lineColor}
        lineWidth={props.lineWidth}
        lineStyle={props.lineStyle}
        curveIntensity={props.curveIntensity}
        width={width}
        height={height}
      />
    );
  }

  // ── Render markers ──────────────────────────────────────────────
  function renderMarkers() {
    if (isMultiPoint && multiViewport) {
      return multiViewport.points.map((pt, i) => (
        <LocationMarker
          key={`marker-${i}`}
          x={pt.x}
          y={pt.y}
          frame={frame}
          enterFrame={getMarkerEnterFrame(i, multiViewport!.points.length)}
          color={props.markerColor}
          size={props.markerSize}
          markerStyle={props.markerStyle}
        />
      ));
    }

    return (
      <>
        <LocationMarker
          x={viewport.point1.x}
          y={viewport.point1.y}
          frame={frame}
          enterFrame={getMarkerEnterFrame(0, 2)}
          color={props.markerColor}
          size={props.markerSize}
          markerStyle={props.markerStyle}
        />
        <LocationMarker
          x={viewport.point2.x}
          y={viewport.point2.y}
          frame={frame}
          enterFrame={getMarkerEnterFrame(1, 2)}
          color={props.markerColor}
          size={props.markerSize}
          markerStyle={props.markerStyle}
        />
      </>
    );
  }

  // ── Render labels ───────────────────────────────────────────────
  function renderLabels() {
    if (!props.showLabels) return null;
    const labelEnter = getLabelEnterFrame();
    const labelColor = styleConfig.darkMap ? '#FFFFFF' : COLORS.text;

    if (isMultiPoint && multiViewport) {
      return multiViewport.points.map((pt, i) => {
        const coord = allCoords[i];
        if (!coord?.label) return null;
        return (
          <LocationLabel
            key={`label-${i}`}
            x={pt.x}
            y={pt.y}
            label={coord.label}
            frame={frame}
            enterFrame={labelEnter}
            font={FONTS.headline}
            color={labelColor}
            viewportWidth={width}
            darkMap={styleConfig.darkMap}
          />
        );
      });
    }

    return (
      <>
        {props.startCoord.label && (
          <LocationLabel
            x={viewport.point1.x}
            y={viewport.point1.y}
            label={props.startCoord.label}
            frame={frame}
            enterFrame={labelEnter}
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
            enterFrame={labelEnter}
            font={FONTS.headline}
            color={labelColor}
            viewportWidth={width}
            darkMap={styleConfig.darkMap}
          />
        )}
      </>
    );
  }

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
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={tileMargin}
          />
        </div>

        {renderPaths()}
        {renderMarkers()}

        {animationType === 'airplaneArc' && frame >= drawStartFrame && frame <= drawEndFrame && (
          <AirplaneIcon
            x={tip.x}
            y={tip.y}
            angle={getTangentAngle()}
            size={s(28)}
            color={props.lineColor}
          />
        )}

        {renderLabels()}
      </div>

      {/* Fixed-position overlays (outside camera transform) */}
      {props.showDistance && (
        <DistanceCounter
          totalKm={totalKm}
          progress={drawProgress}
          frame={frame}
          enterFrame={drawStartFrame}
          font={FONTS.body}
          color={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
          darkMap={styleConfig.darkMap}
        />
      )}

      {props.showProgressBar && (
        <ProgressBar
          progress={drawProgress}
          color={props.lineColor}
        />
      )}

      {props.showCompass && (
        <CompassRose
          frame={frame}
          color={styleConfig.darkMap ? '#CCCCCC' : '#555555'}
        />
      )}
    </AbsoluteFill>
  );
};

export default WatercolorMap;
