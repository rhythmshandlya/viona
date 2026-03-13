import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants } from './constants';
import type { MultiStopJourneyProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  haversineDistance,
  formatDistance,
  MapTileGrid,
  AnimatedPath,
} from '../../lib/map';
import type { Viewport, MultiPointViewport } from '../../lib/map';
import NumberedMarker from './components/NumberedMarker';
import StopLabel from './components/StopLabel';
import TripTitle from './components/TripTitle';

/**
 * Multi-Stop Journey template.
 *
 * Timeline (450 frames / 15s @ 30fps):
 *   0-30:    Title + map fade in
 *   30-60:   First stop marker appears
 *   60-360:  Segments draw sequentially, markers + labels pop in
 *   360-420: Total distance counter fades in
 *   420-450: Global fade out
 */
const MultiStopJourney: React.FC<MultiStopJourneyProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const stops = props.stops;
  const stopCount = stops.length;
  const segmentCount = stopCount - 1;

  // ── Timing constants ─────────────────────────────────────────────
  const DRAW_START = 60;
  const DRAW_END = 360;
  const DISTANCE_ENTER = 360;
  const FADEOUT_START = 420;
  const FADEOUT_END = 450;

  // ── Viewport (all stops) ─────────────────────────────────────────
  const coords = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const multiViewport: MultiPointViewport = computeMultiPointViewport(
    coords,
    width,
    height,
    props.mapPadding
  );

  // Build a compatible 2-point Viewport for MapTileGrid
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // ── Camera ───────────────────────────────────────────────────────
  const camera = getStaticCamera();

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [FADEOUT_START, FADEOUT_END], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Per-segment timing ───────────────────────────────────────────
  const totalDrawFrames = DRAW_END - DRAW_START;
  const framesPerSegment = segmentCount > 0 ? totalDrawFrames / segmentCount : totalDrawFrames;

  function getSegmentStartFrame(segIndex: number): number {
    return DRAW_START + Math.round(segIndex * framesPerSegment);
  }

  function getSegmentEndFrame(segIndex: number): number {
    return DRAW_START + Math.round((segIndex + 1) * framesPerSegment);
  }

  // ── Marker enter frames ──────────────────────────────────────────
  // Stop 0 enters at frame 30. Subsequent stops enter when the path segment
  // reaching them finishes drawing.
  function getMarkerEnterFrame(stopIndex: number): number {
    if (stopIndex === 0) return 30;
    return getSegmentEndFrame(stopIndex - 1);
  }

  // Labels appear 8 frames after their marker
  function getLabelEnterFrame(stopIndex: number): number {
    return getMarkerEnterFrame(stopIndex) + 8;
  }

  // ── Total distance ──────────────────────────────────────────────
  const totalKm = (() => {
    let km = 0;
    for (let i = 0; i < stopCount - 1; i++) {
      km += haversineDistance(
        stops[i].lat,
        stops[i].lng,
        stops[i + 1].lat,
        stops[i + 1].lng
      );
    }
    return km;
  })();

  // ── Distance counter fade in ────────────────────────────────────
  const distanceOpacity = interpolate(
    frame,
    [DISTANCE_ENTER, DISTANCE_ENTER + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const distanceSlideY = interpolate(
    frame,
    [DISTANCE_ENTER, DISTANCE_ENTER + 20],
    [10, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // ── Render paths ─────────────────────────────────────────────────
  function renderPaths() {
    const pts = multiViewport.points;
    return pts.slice(0, -1).map((pt, i) => (
      <AnimatedPath
        key={`seg-${i}`}
        x1={pt.x}
        y1={pt.y}
        x2={pts[i + 1].x}
        y2={pts[i + 1].y}
        frame={frame}
        startFrame={getSegmentStartFrame(i)}
        endFrame={getSegmentEndFrame(i)}
        lineColor={props.lineColor}
        lineWidth={props.lineWidth}
        lineStyle="solid"
        curveIntensity={props.curveIntensity}
        width={width}
        height={height}
        maskId={`msj-seg-${i}`}
      />
    ));
  }

  // ── Render markers ───────────────────────────────────────────────
  function renderMarkers() {
    return multiViewport.points.map((pt, i) => (
      <NumberedMarker
        key={`marker-${i}`}
        x={pt.x}
        y={pt.y}
        frame={frame}
        enterFrame={getMarkerEnterFrame(i)}
        color={props.markerColor}
        number={i + 1}
        size={28}
      />
    ));
  }

  // ── Render labels ────────────────────────────────────────────────
  function renderLabels() {
    return multiViewport.points.map((pt, i) => (
      <StopLabel
        key={`label-${i}`}
        x={pt.x}
        y={pt.y}
        label={stops[i].label}
        date={stops[i].date}
        frame={frame}
        enterFrame={getLabelEnterFrame(i)}
        showDate={props.showDates}
        headlineFont={FONTS.headline}
        bodyFont={FONTS.body}
        textColor={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
        viewportWidth={width}
        darkMap={styleConfig.darkMap}
      />
    ));
  }

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

        {/* Animated path segments */}
        {renderPaths()}

        {/* Numbered markers */}
        {renderMarkers()}

        {/* Stop labels with city name + date */}
        {renderLabels()}
      </div>

      {/* Fixed overlays (outside camera transform) */}

      {/* Title */}
      <TripTitle
        title={props.title}
        frame={frame}
        font={FONTS.headline}
        color={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
        darkMap={styleConfig.darkMap}
      />

      {/* Total distance */}
      {props.showTotalDistance && frame >= DISTANCE_ENTER && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: `translateX(-50%) translateY(${distanceSlideY}px)`,
            opacity: distanceOpacity,
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 600,
            color: styleConfig.darkMap ? '#FFFFFF' : COLORS.text,
            textShadow: styleConfig.darkMap
              ? '0 2px 6px rgba(0,0,0,0.8)'
              : '0 2px 6px rgba(255,255,255,0.8)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {formatDistance(totalKm)}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default MultiStopJourney;
