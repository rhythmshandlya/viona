import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants, PANEL_GAP } from './constants';
import type { SplitDepartureProps } from './schema';
import { MAP_STYLES, haversineDistance, formatDistance } from '../../lib/map';
import SplitPanel from './components/SplitPanel';
import CenterArc from './components/CenterArc';
import PanelLabel from './components/PanelLabel';

/**
 * Split Departure — split screen showing departure and arrival cities
 * side by side with an animated connecting arc.
 *
 * Animation timeline (300 frames / 10s @ 30fps):
 *   0-40   Panels slide in from edges with spring
 *  40-60   Panels settled, location markers appear with spring
 *  60-200  CenterArc draws in the gap
 * 200-240  Labels appear, distance counter animates
 * 240-300  Hold, then fade out
 */
const SplitDeparture: React.FC<SplitDepartureProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const isVertical = props.splitDirection === 'vertical';

  // ── Panel dimensions ──────────────────────────────────────────
  const panelWidth = isVertical ? width : (width - PANEL_GAP) / 2;
  const panelHeight = isVertical ? (height - PANEL_GAP) / 2 : height;

  // ── Panel positions ───────────────────────────────────────────
  const panel1X = 0;
  const panel1Y = 0;
  const panel2X = isVertical ? 0 : panelWidth + PANEL_GAP;
  const panel2Y = isVertical ? panelHeight + PANEL_GAP : 0;

  // ── Distance ──────────────────────────────────────────────────
  const distKm = haversineDistance(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
  );

  // ── Distance counter animation ────────────────────────────────
  const distCountProgress = interpolate(frame, [200, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const displayedKm = Math.round(distKm * distCountProgress);

  // ── Distance label spring entrance ────────────────────────────
  const distLabelLocalFrame = Math.max(0, frame - 200);
  const distLabelScale = spring({
    frame: distLabelLocalFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // ── Global fade out ───────────────────────────────────────────
  const fadeOut = interpolate(frame, [270, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Gap background color ──────────────────────────────────────
  const gapColor = COLORS.secondary;

  return (
    <AbsoluteFill style={{ backgroundColor: gapColor, opacity: fadeOut, overflow: 'hidden' }}>
      {/* Panel 1: Origin city */}
      <div style={{ position: 'absolute', left: panel1X, top: panel1Y }}>
        <SplitPanel
          coord={props.startCoord}
          panelWidth={panelWidth}
          panelHeight={panelHeight}
          frame={frame}
          slideFrom={isVertical ? 'top' : 'left'}
          mapStyle={props.mapStyle}
          markerColor={props.lineColor}
          enterFrame={0}
          markerEnterFrame={40}
        />
      </div>

      {/* Panel 2: Destination city */}
      <div style={{ position: 'absolute', left: panel2X, top: panel2Y }}>
        <SplitPanel
          coord={props.endCoord}
          panelWidth={panelWidth}
          panelHeight={panelHeight}
          frame={frame}
          slideFrom={isVertical ? 'bottom' : 'right'}
          mapStyle={props.mapStyle}
          markerColor={props.lineColor}
          enterFrame={0}
          markerEnterFrame={40}
        />
      </div>

      {/* Center arc connecting the two panels */}
      <CenterArc
        width={width}
        height={height}
        frame={frame}
        lineColor={props.lineColor}
        splitDirection={props.splitDirection}
      />

      {/* Panel labels */}
      {props.showLabels && props.startCoord.label && (
        <PanelLabel
          label={props.startCoord.label}
          frame={frame}
          enterFrame={200}
          font={FONTS.headline}
          textColor="#FFFFFF"
          accentColor={COLORS.accent}
          panelWidth={panelWidth}
          panelHeight={panelHeight}
          offsetX={panel1X}
          offsetY={panel1Y}
          subtitle="DEPARTURE"
        />
      )}
      {props.showLabels && props.endCoord.label && (
        <PanelLabel
          label={props.endCoord.label}
          frame={frame}
          enterFrame={200}
          font={FONTS.headline}
          textColor="#FFFFFF"
          accentColor={COLORS.accent}
          panelWidth={panelWidth}
          panelHeight={panelHeight}
          offsetX={panel2X}
          offsetY={panel2Y}
          subtitle="ARRIVAL"
        />
      )}

      {/* Distance counter */}
      {props.showDistance && frame >= 200 && (
        <div
          style={{
            position: 'absolute',
            left: width / 2,
            top: height / 2,
            transform: `translate(-50%, -50%) scale(${distLabelScale})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 48,
              fontWeight: 700,
              color: '#FFFFFF',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              padding: '12px 32px',
              borderRadius: 50,
              backdropFilter: 'blur(10px)',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              border: `2px solid ${props.lineColor}`,
              whiteSpace: 'nowrap',
            }}
          >
            {displayedKm.toLocaleString('en-US')} km
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default SplitDeparture;
