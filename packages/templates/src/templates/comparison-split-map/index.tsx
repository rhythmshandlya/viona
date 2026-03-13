import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { ComparisonSplitMapProps } from './schema';
import { computeViewport, MAP_STYLES } from '../../lib/map';
import MapPanel from './components/MapPanel';
import SlidingDivider from './components/SlidingDivider';
import PanelLabel from './components/PanelLabel';

/**
 * Comparison Split Map — Side-by-side map comparison with animated sliding divider.
 *
 * Timeline (300 frames / 10s @ 30fps):
 *   0–30:    Both maps fade in, divider at right edge (100%)
 *   30–100:  Divider slides from right edge (100%) to center (50%) — eased cubic
 *   100–250: Divider slowly drifts from 50% to 30%, revealing more of right map
 *   110+:    Panel labels spring in
 *   280–300: Global fade out
 */
const ComparisonSplitMap: React.FC<ComparisonSplitMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const s = useScale();

  // ── Viewport ─────────────────────────────────────────────────────
  // Create a small bounding box around the center for a medium zoom
  const latOffset = 0.05;
  const lngOffset = 0.08;
  const viewport = computeViewport(
    props.centerCoord.lat - latOffset,
    props.centerCoord.lng - lngOffset,
    props.centerCoord.lat + latOffset,
    props.centerCoord.lng + lngOffset,
    width,
    height,
    props.mapPadding
  );

  // ── Map style configs ────────────────────────────────────────────
  const leftStyleConfig = MAP_STYLES[props.leftMapStyle];
  const rightStyleConfig = MAP_STYLES[props.rightMapStyle];

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Divider animation ────────────────────────────────────────────
  // Phase 1: 0–30: hold at 100% (right edge, left map fills screen)
  // Phase 2: 30–100: slide from 100% to 50% (reveal split)
  // Phase 3: 100–250: drift from 50% to 30% (reveal more right panel)
  const dividerPercent =
    frame < 30
      ? 100
      : frame < 100
        ? interpolate(frame, [30, 100], [100, 50], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          })
        : interpolate(frame, [100, 250], [50, 30], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

  const dividerX = (dividerPercent / 100) * width;

  // ── Label positions ──────────────────────────────────────────────
  // Left label: centered in the left portion (0% to dividerPercent%)
  // Right label: centered in the right portion (dividerPercent% to 100%)
  const leftLabelXPercent = dividerPercent / 2;
  const rightLabelXPercent = (100 + dividerPercent) / 2;
  const labelY = height * 0.12;

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Background color — blend between the two map backgrounds ─────
  // Use the left map's background when divider is to the right, right map's when left
  const bgColor = props.colors.background;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Map tiles layer */}
      <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
        {/* LEFT panel — clipRight hides everything to the right of the divider */}
        <MapPanel
          viewport={viewport}
          width={width}
          height={height}
          mapStyle={props.leftMapStyle}
          clipLeft={0}
          clipRight={100 - dividerPercent}
          margin={0}
        />

        {/* RIGHT panel — clipLeft hides everything to the left of the divider */}
        <MapPanel
          viewport={viewport}
          width={width}
          height={height}
          mapStyle={props.rightMapStyle}
          clipLeft={dividerPercent}
          clipRight={0}
          margin={0}
        />
      </div>

      {/* Sliding divider line + handle */}
      <SlidingDivider
        dividerX={dividerX}
        height={height}
        color={props.dividerColor}
        frame={frame}
        fps={fps}
      />

      {/* Panel labels */}
      {props.showLabels && (
        <>
          <PanelLabel
            label={props.leftLabel}
            xPercent={leftLabelXPercent}
            y={labelY}
            frame={frame}
            enterFrame={110}
            fps={fps}
            font={FONTS.headline}
            textColor={props.colors.text}
            darkBackground={!leftStyleConfig.darkMap}
          />
          <PanelLabel
            label={props.rightLabel}
            xPercent={rightLabelXPercent}
            y={labelY}
            frame={frame}
            enterFrame={120}
            fps={fps}
            font={FONTS.headline}
            textColor={props.colors.text}
            darkBackground={!rightStyleConfig.darkMap}
          />
        </>
      )}

      {/* Center location label at the bottom */}
      {props.centerCoord.label && (
        <div
          style={{
            position: 'absolute',
            bottom: s(40),
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: interpolate(frame, [115, 135], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: s(20),
              fontWeight: 500,
              color: 'rgba(255,255,255,0.8)',
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: s(24),
              paddingTop: s(8),
              paddingBottom: s(8),
              paddingLeft: s(20),
              paddingRight: s(20),
              letterSpacing: '0.04em',
            }}
          >
            {props.centerCoord.label}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default ComparisonSplitMap;
