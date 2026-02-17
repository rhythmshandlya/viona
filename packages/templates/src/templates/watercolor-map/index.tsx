import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { getConstants } from './constants';
import type { WatercolorMapProps } from './schema';
import { computeViewport, MAP_STYLES, computeBezierControl, getPointOnQuadBezier } from './lib/tile-math';
import MapTileGrid from './components/MapTileGrid';
import AnimatedPath from './components/AnimatedPath';
import LocationMarker from './components/LocationMarker';
import LocationLabel from './components/LocationLabel';

const WIDTH = 1080;
const HEIGHT = 1080;

/** How much the camera zooms in during the line-draw phase. */
const CAMERA_ZOOM = 2;

/**
 * Animation timeline (360 frames / 12s @ 30fps):
 *   0–30    Map tiles fade in, camera on start point
 *  30–50    Start marker spring entrance
 *  50–60    Brief hold on start
 *  60–240   Line draw — camera follows the tip of the line
 * 240–260   End marker entrance, camera at end point
 * 260–300   Camera zooms out to show full route, labels fade in
 * 300–330   Static hold (full route visible)
 * 330–360   Everything fades out
 */
const WatercolorMap: React.FC<WatercolorMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // Static viewport fitting both points (world-space coordinate system)
  const viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    WIDTH,
    HEIGHT,
    props.mapPadding
  );

  // Bezier control point for the curved path
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity
  );

  // Line draw progress (eased)
  const drawProgress = interpolate(frame, [60, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Current tip of the drawing line
  const tip = getPointOnQuadBezier(
    viewport.point1.x, viewport.point1.y,
    ctrlX, ctrlY,
    viewport.point2.x, viewport.point2.y,
    drawProgress
  );

  // Route center (for zoom-out target)
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // Zoom-out transition (frames 260–300)
  const zoomOutT = interpolate(frame, [260, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Camera follows tip during draw, then eases to route center
  const cameraX = interpolate(zoomOutT, [0, 1], [tip.x, routeCenterX]);
  const cameraY = interpolate(zoomOutT, [0, 1], [tip.y, routeCenterY]);
  const cameraScale = interpolate(zoomOutT, [0, 1], [CAMERA_ZOOM, 1]);

  // Camera transform: scale world around origin, then translate to center target on screen
  const translateX = WIDTH / 2 - cameraX * cameraScale;
  const translateY = HEIGHT / 2 - cameraY * cameraScale;

  // Map fade in (frames 0–30)
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Global fade out (frames 330–360)
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: styleConfig.background, opacity: fadeOut, overflow: 'hidden' }}>
      <div
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${cameraScale})`,
          transformOrigin: '0 0',
          width: WIDTH,
          height: HEIGHT,
          position: 'absolute',
        }}
      >
        {/* Map tiles — extra margin so tiles are loaded beyond viewport for camera panning */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={WIDTH}
            height={HEIGHT}
            mapStyle={props.mapStyle}
            margin={WIDTH / 2}
          />
        </div>

        {/* Animated connecting line */}
        <AnimatedPath
          x1={viewport.point1.x}
          y1={viewport.point1.y}
          x2={viewport.point2.x}
          y2={viewport.point2.y}
          frame={frame}
          startFrame={60}
          endFrame={240}
          lineColor={props.lineColor}
          lineWidth={props.lineWidth}
          lineStyle={props.lineStyle}
          curveIntensity={props.curveIntensity}
          width={WIDTH}
          height={HEIGHT}
        />

        {/* Start marker (enters at frame 30) */}
        <LocationMarker
          x={viewport.point1.x}
          y={viewport.point1.y}
          frame={frame}
          enterFrame={30}
          color={props.markerColor}
          size={props.markerSize}
        />

        {/* End marker (enters at frame 240) */}
        <LocationMarker
          x={viewport.point2.x}
          y={viewport.point2.y}
          frame={frame}
          enterFrame={240}
          color={props.markerColor}
          size={props.markerSize}
        />

        {/* Labels (appear during zoom-out) */}
        {props.showLabels && props.startCoord.label && (
          <LocationLabel
            x={viewport.point1.x}
            y={viewport.point1.y}
            label={props.startCoord.label}
            frame={frame}
            enterFrame={270}
            font={FONTS.headline}
            color={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
            viewportWidth={WIDTH}
            darkMap={styleConfig.darkMap}
          />
        )}
        {props.showLabels && props.endCoord.label && (
          <LocationLabel
            x={viewport.point2.x}
            y={viewport.point2.y}
            label={props.endCoord.label}
            frame={frame}
            enterFrame={270}
            font={FONTS.headline}
            color={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
            viewportWidth={WIDTH}
            darkMap={styleConfig.darkMap}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

export default WatercolorMap;
