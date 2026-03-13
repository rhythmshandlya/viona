import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants } from './constants';
import type { HubSpokeRadialProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  haversineDistance,
  MapTileGrid,
  LocationLabel,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import HubMarker from './components/HubMarker';
import SpokeAnimation from './components/SpokeAnimation';
import DestinationCounter from './components/DestinationCounter';

const SPOKE_DRAW_DURATION = 90;

const HubSpokeRadial: React.FC<HubSpokeRadialProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Build the full list of coords (hub first) ───────────────────
  const allCoords = [props.hubCoord, ...props.destinations];

  // ── Viewport ────────────────────────────────────────────────────
  const multiViewport = computeMultiPointViewport(allCoords, width, height, props.mapPadding);

  // Build a compatible Viewport for MapTileGrid
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // ── Camera (static for hub-and-spoke) ──────────────────────────
  const camera = getStaticCamera();

  // ── Hub pixel position ─────────────────────────────────────────
  const hubPt = multiViewport.points[0];
  const destPts = multiViewport.points.slice(1);

  // ── Timing ─────────────────────────────────────────────────────
  const hubEnterFrame = 30;
  const spokesStartFrame = 60;

  // Each spoke's start frame
  function getSpokeStartFrame(index: number): number {
    return spokesStartFrame + index * props.staggerDelay;
  }

  // Frame when a spoke completes drawing
  function getSpokeEndFrame(index: number): number {
    return getSpokeStartFrame(index) + SPOKE_DRAW_DURATION;
  }

  // Count of completed spokes at current frame
  const completedCount = props.destinations.reduce((count, _, i) => {
    return frame >= getSpokeEndFrame(i) ? count + 1 : count;
  }, 0);

  // Frame when the last spoke completes
  const lastSpokeEndFrame = getSpokeEndFrame(props.destinations.length - 1);

  // Total distance from hub to each destination
  const totalDistanceKm = props.destinations.reduce((sum, dest) => {
    return sum + haversineDistance(
      props.hubCoord.lat, props.hubCoord.lng,
      dest.lat, dest.lng
    );
  }, 0);

  // Whether total distance should be visible (after last spoke completes)
  const distanceVisible = frame >= lastSpokeEndFrame + 10;

  // ── Map fade in ────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out (last 30 frames) ──────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Label colors ──────────────────────────────────────────────
  const labelColor = styleConfig.darkMap ? '#FFFFFF' : COLORS.text;

  // ── Label enter frame (after all spokes done) ──────────────────
  const labelsEnterFrame = Math.min(lastSpokeEndFrame + 5, 300);

  // ── Render spokes ─────────────────────────────────────────────
  function renderSpokes() {
    return destPts.map((pt, i) => (
      <SpokeAnimation
        key={`spoke-${i}`}
        hubX={hubPt.x}
        hubY={hubPt.y}
        destX={pt.x}
        destY={pt.y}
        frame={frame}
        startFrame={getSpokeStartFrame(i)}
        drawDuration={SPOKE_DRAW_DURATION}
        lineColor={props.lineColor}
        lineWidth={props.lineWidth}
        spokeStyle={props.spokeStyle}
        viewportWidth={width}
        viewportHeight={height}
        spokeIndex={i}
      />
    ));
  }

  // ── Render destination markers ────────────────────────────────
  function renderDestinationMarkers() {
    return destPts.map((pt, i) => {
      const markerEnterFrame = getSpokeEndFrame(i);
      if (frame < markerEnterFrame) return null;

      const localFrame = frame - markerEnterFrame;
      const scale = spring({
        frame: localFrame,
        fps,
        config: { damping: 26, stiffness: 120, mass: 1.0 },
      });

      const markerSize = 18;

      return (
        <div
          key={`dest-marker-${i}`}
          style={{
            position: 'absolute',
            left: pt.x,
            top: pt.y,
            transform: `translate(-50%, -50%) scale(${scale})`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: markerSize,
              height: markerSize,
              borderRadius: '50%',
              backgroundColor: props.lineColor,
              border: `${Math.max(2, markerSize * 0.15)}px solid white`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      );
    });
  }

  // ── Render labels ─────────────────────────────────────────────
  function renderLabels() {
    return (
      <>
        {/* Hub label */}
        {props.hubCoord.label && (
          <LocationLabel
            x={hubPt.x}
            y={hubPt.y}
            label={props.hubCoord.label}
            frame={frame}
            enterFrame={hubEnterFrame + 5}
            font={FONTS.headline}
            color={labelColor}
            viewportWidth={width}
            darkMap={styleConfig.darkMap}
          />
        )}

        {/* Destination labels */}
        {destPts.map((pt, i) => {
          const coord = props.destinations[i];
          if (!coord?.label) return null;
          return (
            <LocationLabel
              key={`label-${i}`}
              x={pt.x}
              y={pt.y}
              label={coord.label}
              frame={frame}
              enterFrame={labelsEnterFrame}
              font={FONTS.headline}
              color={labelColor}
              viewportWidth={width}
              darkMap={styleConfig.darkMap}
            />
          );
        })}
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

        {/* Spokes */}
        {renderSpokes()}

        {/* Hub marker */}
        <HubMarker
          x={hubPt.x}
          y={hubPt.y}
          frame={frame}
          enterFrame={hubEnterFrame}
          accentColor={COLORS.accent}
          size={18}
        />

        {/* Destination markers */}
        {renderDestinationMarkers()}

        {/* Labels */}
        {renderLabels()}
      </div>

      {/* Fixed-position overlay: title & counter */}
      <DestinationCounter
        title={props.title}
        totalDestinations={props.destinations.length}
        completedCount={completedCount}
        totalDistanceKm={totalDistanceKm}
        showTotalCount={props.showTotalCount}
        showDistances={props.showDistances}
        distanceVisible={distanceVisible}
        frame={frame}
        titleEnterFrame={0}
        headlineFont={FONTS.headline}
        bodyFont={FONTS.body}
        textColor={COLORS.text}
        primaryColor={COLORS.primary}
        darkMap={styleConfig.darkMap}
      />
    </AbsoluteFill>
  );
};

export default HubSpokeRadial;
