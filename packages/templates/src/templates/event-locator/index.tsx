import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
} from 'remotion';
import { getConstants } from './constants';
import type { EventLocatorProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport, MultiPointViewport } from '../../lib/map';
import VenuePin from './components/VenuePin';
import EventCard from './components/EventCard';
import DirectionLine from './components/DirectionLine';

/**
 * Event Locator template.
 *
 * Timeline (300 frames / 10s @ 30fps):
 *   0-90:    Animated zoom in to venue (scale 0.6 → 2.0)
 *   90-120:  Venue pin drops onto map
 *   120-180: Event card slides out from pin position
 *   150-230: Direction lines draw from landmarks to venue (staggered)
 *   260-280: Hold
 *   280-300: Fade out
 */
const EventLocator: React.FC<EventLocatorProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const allCoords = [
    props.venueCoord,
    ...props.nearbyLandmarks,
  ];

  // ── Viewport: fits venue + all landmarks ─────────────────────────
  const multiViewport: MultiPointViewport = computeMultiPointViewport(
    allCoords.map((c) => ({ lat: c.lat, lng: c.lng })),
    width,
    height,
    props.mapPadding
  );

  // Build a compatible Viewport for MapTileGrid (uses point1/point2)
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // ── Animated zoom camera ─────────────────────────────────────────
  // Scale 0.6 → 2.0 over frames 0-90, eased cubic out
  const zoomScale = interpolate(frame, [0, 90], [0.6, 2.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Venue is multiViewport.points[0]
  const venueScreenPt = multiViewport.points[0];
  const cameraX = width / 2 - venueScreenPt.x * zoomScale;
  const cameraY = height / 2 - venueScreenPt.y * zoomScale;

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Where the venue pin appears on screen after zoom ────────────
  // At full zoom (frame >= 90), pin is at center. Pre-compute screen pos.
  const venueFinalScreenX = width / 2;
  const venueFinalScreenY = height / 2;

  // ── Direction line timing (staggered 20 frames apart) ────────────
  const LINE_START_BASE = 150;
  const LINE_STAGGER = 20;
  const LINE_DRAW_DURATION = 40;

  // ── Landmark dots opacity (fade in with line) ────────────────────
  // Handled inside DirectionLine component.

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* ── Camera-transformed world ─────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          transform: `translate(${cameraX}px, ${cameraY}px) scale(${zoomScale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Map tiles — extra margin for zoom-in reveal */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={500}
          />
        </div>

        {/* Direction lines from each landmark to venue */}
        {props.showDirections &&
          props.nearbyLandmarks.map((landmark, i) => {
            const landmarkPt = multiViewport.points[i + 1]; // +1 since venue is [0]
            const venuePt = multiViewport.points[0];
            const lineStartFrame = LINE_START_BASE + i * LINE_STAGGER;
            const lineEndFrame = lineStartFrame + LINE_DRAW_DURATION;

            return (
              <DirectionLine
                key={`direction-${i}`}
                x1={landmarkPt.x}
                y1={landmarkPt.y}
                x2={venuePt.x}
                y2={venuePt.y}
                label={landmark.label}
                frame={frame}
                startFrame={lineStartFrame}
                endFrame={lineEndFrame}
                lineColor={COLORS.primary}
                viewportWidth={width}
                viewportHeight={height}
                maskId={`el-dir-${i}`}
                font={FONTS}
                darkMap={styleConfig.darkMap}
              />
            );
          })}

        {/* Venue pin — drops at frame 90 */}
        <VenuePin
          x={venueScreenPt.x}
          y={venueScreenPt.y}
          frame={frame}
          enterFrame={90}
          fps={fps}
          accentColor={COLORS.accent}
        />
      </div>

      {/* ── Fixed overlay (not affected by camera zoom) ───────────── */}
      {/* Event card slides out from venue center position at frame 120 */}
      {frame >= 120 && (
        <EventCard
          x={venueFinalScreenX + 20}
          y={venueFinalScreenY - 80}
          eventName={props.eventName}
          eventDate={props.eventDate}
          eventTime={props.eventTime}
          address={props.address}
          frame={frame}
          enterFrame={120}
          fps={fps}
          font={FONTS}
          colors={COLORS}
        />
      )}
    </AbsoluteFill>
  );
};

export default EventLocator;
