import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants } from './constants';
import type { PinDropScatterProps } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  MapTileGrid,
  LocationMarker,
  LocationLabel,
} from '../../lib/map';
import type { Viewport, MultiPointViewport } from '../../lib/map';
import PinCounter from './components/PinCounter';
import ConnectionLine from './components/ConnectionLine';

/**
 * Pin Drop Scatter template.
 *
 * Timeline (360 frames / 12s @ 30fps):
 *   0-30:    Map fade in
 *   10:      Title spring entrance
 *   30:      PinCounter enters
 *   40+i*staggerDelay: Pin i drops
 *   40+i*staggerDelay+8: Label i fades in
 *   330-360: Global fade out
 */
const PinDropScatter: React.FC<PinDropScatterProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const locations = props.locations;
  const locationCount = locations.length;

  // ── Timing ─────────────────────────────────────────────────────────
  const FADEOUT_START = 330;
  const FADEOUT_END = 360;
  const COUNTER_ENTER = 30;
  const TITLE_ENTER = 10;

  function getPinEnterFrame(i: number): number {
    return 40 + i * props.staggerDelay;
  }

  function getLabelEnterFrame(i: number): number {
    return getPinEnterFrame(i) + 8;
  }

  // ── Viewport ────────────────────────────────────────────────────────
  // computeMultiPointViewport requires at least 2 coords
  const rawCoords = locations.map((loc) => ({ lat: loc.lat, lng: loc.lng }));
  const coords = rawCoords.length >= 2
    ? rawCoords
    : [...rawCoords, { lat: (rawCoords[0]?.lat ?? 0) + 10, lng: (rawCoords[0]?.lng ?? 0) + 10 }];
  const multiViewport: MultiPointViewport = computeMultiPointViewport(
    coords,
    width,
    height,
    props.mapPadding
  );

  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // ── Camera ──────────────────────────────────────────────────────────
  const camera = getStaticCamera();

  // ── Map fade in ─────────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ─────────────────────────────────────────────────
  const fadeOut = interpolate(frame, [FADEOUT_START, FADEOUT_END], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Count landed pins ───────────────────────────────────────────────
  const landedCount = locations.reduce((count, _, i) => {
    return frame >= getPinEnterFrame(i) ? count + 1 : count;
  }, 0);

  // ── Title spring ────────────────────────────────────────────────────
  const titleLocalFrame = Math.max(0, frame - TITLE_ENTER);
  const titleScale = spring({
    frame: titleLocalFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // ── Render connection lines ─────────────────────────────────────────
  function renderConnections() {
    if (!props.showConnections) return null;
    const pts = multiViewport.points;
    return pts.slice(0, -1).map((pt, i) => {
      // Both pin i and pin i+1 must have landed before drawing
      const startFrame = getPinEnterFrame(i + 1) + 5;
      return (
        <ConnectionLine
          key={`conn-${i}`}
          x1={pt.x}
          y1={pt.y}
          x2={pts[i + 1].x}
          y2={pts[i + 1].y}
          frame={frame}
          startFrame={startFrame}
          color={props.markerColor}
          width={2}
          viewportWidth={width}
          viewportHeight={height}
        />
      );
    });
  }

  // ── Render markers ──────────────────────────────────────────────────
  function renderMarkers() {
    return multiViewport.points.map((pt, i) => (
      <LocationMarker
        key={`marker-${i}`}
        x={pt.x}
        y={pt.y}
        frame={frame}
        enterFrame={getPinEnterFrame(i)}
        color={props.markerColor}
        size={props.markerSize}
        markerStyle="pinDrop"
      />
    ));
  }

  // ── Render labels ───────────────────────────────────────────────────
  function renderLabels() {
    return multiViewport.points.map((pt, i) => (
      <LocationLabel
        key={`label-${i}`}
        x={pt.x}
        y={pt.y}
        label={locations[i].label}
        frame={frame}
        enterFrame={getLabelEnterFrame(i)}
        font={FONTS.body}
        color={styleConfig.darkMap ? '#FFFFFF' : COLORS.text}
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

        {/* Connection lines (behind pins) */}
        {renderConnections()}

        {/* Pin markers */}
        {renderMarkers()}

        {/* Location labels */}
        {renderLabels()}
      </div>

      {/* Fixed overlays */}

      {/* Title */}
      {frame >= TITLE_ENTER && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: '50%',
            transform: `translateX(-50%) scale(${titleScale})`,
            transformOrigin: 'center top',
            fontFamily: FONTS.headline,
            fontSize: 46,
            fontWeight: 800,
            color: styleConfig.darkMap ? '#FFFFFF' : COLORS.text,
            textShadow: styleConfig.darkMap
              ? '0 2px 8px rgba(0,0,0,0.8)'
              : '0 2px 8px rgba(255,255,255,0.85)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {props.title}
        </div>
      )}

      {/* Pin counter pill */}
      {props.showCounter && (
        <PinCounter
          current={landedCount}
          total={locationCount}
          frame={frame}
          enterFrame={COUNTER_ENTER}
          font={FONTS.body}
          colors={{
            primary: COLORS.primary,
            text: COLORS.text,
            background: COLORS.background,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export default PinDropScatter;
