import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants } from './constants';
import type { TimezoneTravelerProps } from './schema';
import {
  computeViewport,
  computeBezierControl,
  getPointOnQuadBezier,
  getFollowDrawCamera,
  MAP_STYLES,
  MapTileGrid,
  AnimatedPath,
  LocationMarker,
  LocationLabel,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import TimeZoneBands from './components/TimeZoneBands';
import ZoneLabel from './components/ZoneLabel';
import ClockDisplay from './components/ClockDisplay';

/**
 * Timezone Traveler — world map with timezone bands and a clock
 * that updates as the route crosses time zones.
 *
 * Timeline (360 frames / 12s @ 30fps):
 * - Frames 0-30:   Map and timezone bands fade in
 * - Frames 30-50:  Clock display and start label appear
 * - Frames 50-280: Route draws, clock time updates, camera follows
 * - Frames 280-320: End label appears, clock shows arrival time
 * - Frames 320-360: Fade out
 */
const TimezoneTraveler: React.FC<TimezoneTravelerProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Viewport ─────────────────────────────────────────────────────
  const viewport: Viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    width,
    height,
    props.mapPadding,
  );

  // ── Bezier control for the route curve ────────────────────────────
  const { cx: ctrlX, cy: ctrlY } = computeBezierControl(
    viewport.point1.x,
    viewport.point1.y,
    viewport.point2.x,
    viewport.point2.y,
    props.curveIntensity,
  );

  // ── Draw progress (frames 50-280) ────────────────────────────────
  const drawStartFrame = 50;
  const drawEndFrame = 280;

  const drawProgress = interpolate(frame, [drawStartFrame, drawEndFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Tip position for camera follow ────────────────────────────────
  const tip = getPointOnQuadBezier(
    viewport.point1.x, viewport.point1.y,
    ctrlX, ctrlY,
    viewport.point2.x, viewport.point2.y,
    drawProgress,
  );

  // ── Route center ──────────────────────────────────────────────────
  const routeCenterX = (viewport.point1.x + viewport.point2.x) / 2;
  const routeCenterY = (viewport.point1.y + viewport.point2.y) / 2;

  // ── Camera: follow-draw, zoom out at end ──────────────────────────
  const zoomOutT = interpolate(frame, [260, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const camera = getFollowDrawCamera(
    frame, tip, { x: routeCenterX, y: routeCenterY }, zoomOutT, width, height,
  );

  // ── Map fade in ───────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ───────────────────────────────────────────────
  const fadeOut = interpolate(frame, [320, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Label color ───────────────────────────────────────────────────
  const labelColor = styleConfig.darkMap ? '#FFFFFF' : COLORS.text;

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
            margin={width / 2}
          />
        </div>

        {/* Timezone bands overlay */}
        {props.showZoneBands && (
          <TimeZoneBands
            viewport={viewport}
            width={width}
            height={height}
            frame={frame}
            enterFrame={0}
          />
        )}

        {/* UTC offset labels at top of bands */}
        {props.showZoneBands && (
          <ZoneLabel
            viewport={viewport}
            width={width}
            frame={frame}
            enterFrame={0}
            font={FONTS.body}
          />
        )}

        {/* Animated route path */}
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

        {/* Start marker */}
        <LocationMarker
          x={viewport.point1.x}
          y={viewport.point1.y}
          frame={frame}
          enterFrame={30}
          color={props.lineColor}
          size={18}
          markerStyle="pulse"
        />

        {/* End marker */}
        <LocationMarker
          x={viewport.point2.x}
          y={viewport.point2.y}
          frame={frame}
          enterFrame={280}
          color={COLORS.accent}
          size={18}
          markerStyle="pulse"
        />

        {/* Start label */}
        {props.startCoord.label && (
          <LocationLabel
            x={viewport.point1.x}
            y={viewport.point1.y}
            label={props.startCoord.label}
            frame={frame}
            enterFrame={30}
            font={FONTS.headline}
            color={labelColor}
            viewportWidth={width}
            darkMap={styleConfig.darkMap}
          />
        )}

        {/* End label */}
        {props.endCoord.label && (
          <LocationLabel
            x={viewport.point2.x}
            y={viewport.point2.y}
            label={props.endCoord.label}
            frame={frame}
            enterFrame={280}
            font={FONTS.headline}
            color={labelColor}
            viewportWidth={width}
            darkMap={styleConfig.darkMap}
          />
        )}
      </div>

      {/* Fixed-position overlays (outside camera transform) */}

      {/* Clock display */}
      <ClockDisplay
        frame={frame}
        enterFrame={30}
        drawProgress={drawProgress}
        startTimezone={props.startTimezone}
        endTimezone={props.endTimezone}
        clockStyle={props.clockStyle}
        primaryColor={COLORS.primary}
        secondaryColor={COLORS.secondary}
        accentColor={COLORS.accent}
      />

      {/* Local time labels at start/end */}
      {props.showLocalTimes && (
        <LocalTimeOverlay
          frame={frame}
          drawProgress={drawProgress}
          startTimezone={props.startTimezone}
          endTimezone={props.endTimezone}
          startLabel={props.startCoord.label}
          endLabel={props.endCoord.label}
          font={FONTS.body}
          primaryColor={COLORS.primary}
          textColor={COLORS.text}
        />
      )}
    </AbsoluteFill>
  );
};

/**
 * Shows departure and arrival local times in the bottom-left corner.
 */
const LocalTimeOverlay: React.FC<{
  frame: number;
  drawProgress: number;
  startTimezone: string;
  endTimezone: string;
  startLabel?: string;
  endLabel?: string;
  font: string;
  primaryColor: string;
  textColor: string;
}> = ({
  frame,
  drawProgress,
  startTimezone,
  endTimezone,
  startLabel,
  endLabel,
  font,
  primaryColor,
  textColor,
}) => {
  const departOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const arriveOpacity = interpolate(frame, [280, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Parse offsets
  const startOff = parseOffset(startTimezone);
  const endOff = parseOffset(endTimezone);
  const baseHour = 10;

  // Departure time = base hour in start timezone
  const departTime = formatTime(baseHour);
  // Arrival time = base hour + (end - start) offset in end timezone
  const arrivalHours = baseHour + (endOff - startOff);
  const arriveTime = formatTime(arrivalHours);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity: departOpacity,
          backgroundColor: 'rgba(255,255,255,0.88)',
          borderRadius: 10,
          padding: '10px 18px',
          fontFamily: font,
          fontSize: 15,
          color: textColor,
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ fontWeight: 600, color: primaryColor }}>Departure</span>
        {startLabel ? ` (${startLabel})` : ''}: {departTime} {startTimezone}
      </div>
      {frame >= 280 && (
        <div
          style={{
            opacity: arriveOpacity,
            backgroundColor: 'rgba(255,255,255,0.88)',
            borderRadius: 10,
            padding: '10px 18px',
            fontFamily: font,
            fontSize: 15,
            color: textColor,
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ fontWeight: 600, color: primaryColor }}>Arrival</span>
          {endLabel ? ` (${endLabel})` : ''}: {arriveTime} {endTimezone}
        </div>
      )}
    </div>
  );
};

function parseOffset(tz: string): number {
  const match = tz.match(/UTC([+-]?\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  return parseFloat(match[1]);
}

function formatTime(totalHours: number): string {
  let h24 = totalHours % 24;
  if (h24 < 0) h24 += 24;
  const hours = Math.floor(h24);
  const mins = Math.floor((h24 - hours) * 60);
  let h12 = hours % 12;
  if (h12 === 0) h12 = 12;
  const amPm = hours >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(mins).padStart(2, '0')} ${amPm}`;
}

export default TimezoneTraveler;
