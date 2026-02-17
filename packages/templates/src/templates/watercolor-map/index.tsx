import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { getConstants } from './constants';
import type { WatercolorMapProps } from './schema';
import { computeViewport, MAP_STYLES } from './lib/tile-math';
import MapTileGrid from './components/MapTileGrid';
import AnimatedPath from './components/AnimatedPath';
import LocationMarker from './components/LocationMarker';
import LocationLabel from './components/LocationLabel';

const WIDTH = 1080;
const HEIGHT = 1080;

/**
 * Animation timeline (360 frames / 12s @ 30fps):
 *   0–30    Map tiles fade in
 *  30–50    Start marker spring entrance
 *  50–60    Brief hold
 *  60–240   Line draw animation
 * 240–260   End marker spring entrance
 * 260–285   Labels fade in
 * 285–330   Static hold
 * 330–360   Everything fades out
 */
const WatercolorMap: React.FC<WatercolorMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    WIDTH,
    HEIGHT,
    props.mapPadding
  );

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
    <AbsoluteFill style={{ backgroundColor: styleConfig.background, opacity: fadeOut }}>
      {/* Map tiles */}
      <AbsoluteFill style={{ opacity: mapOpacity, overflow: 'hidden' }}>
        <MapTileGrid viewport={viewport} width={WIDTH} height={HEIGHT} mapStyle={props.mapStyle} />
      </AbsoluteFill>

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

      {/* Labels */}
      {props.showLabels && props.startCoord.label && (
        <LocationLabel
          x={viewport.point1.x}
          y={viewport.point1.y}
          label={props.startCoord.label}
          frame={frame}
          enterFrame={260}
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
          enterFrame={260}
          font={FONTS.headline}
          color={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
          viewportWidth={WIDTH}
          darkMap={styleConfig.darkMap}
        />
      )}
    </AbsoluteFill>
  );
};

export default WatercolorMap;
