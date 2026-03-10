import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants } from './constants';
import type { CoverageMapProps } from './schema';
import {
  computeViewport,
  lngToPixelX,
  latToPixelY,
  MAP_STYLES,
  getStaticCamera,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import CoverageWave from './components/CoverageWave';
import CoverageStats from './components/CoverageStats';
import CenterMarker from './components/CenterMarker';

/**
 * Coverage Map template.
 *
 * Timeline (300 frames / 10s @ 30fps):
 *   0-20:    Map tiles fade in
 *   10-30:   Title springs in
 *   20-40:   Center marker enters
 *   60-120:  Wave 1 expands
 *   130-190: Wave 2 expands
 *   200-260: Wave 3 expands
 *   260-280: Stats finalize
 *   280-300: Fade out
 */

/**
 * Convert a distance in meters to pixels at a given zoom and latitude.
 * Uses the Web Mercator scale factor: 40075016.686 * cos(lat) / (256 * 2^zoom)
 */
function metersToPixels(meters: number, lat: number, zoom: number): number {
  const metersPerPx =
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));
  return meters / metersPerPx;
}

const CoverageMap: React.FC<CoverageMapProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const { centerCoord, waves } = props;

  // ── Compute wave enter frames dynamically ───────────────────────────
  // Distribute waves evenly across frames 60-260
  const WAVE_START = 60;
  const WAVE_END = 260;
  const waveSpacing = waves.length > 1
    ? (WAVE_END - WAVE_START) / (waves.length - 1)
    : 0;
  const waveEnterFrames = waves.map((_, i) =>
    Math.round(WAVE_START + i * waveSpacing)
  );

  // ── Viewport: compute zoom that fits the largest radius ───────────
  const maxRadiusMeters = Math.max(...waves.map((w) => w.radius));
  const maxRadiusKm = maxRadiusMeters / 1000;
  const latOffset = maxRadiusKm / 111;
  const lngOffset =
    maxRadiusKm / (111 * Math.cos((centerCoord.lat * Math.PI) / 180));

  const viewport: Viewport = computeViewport(
    centerCoord.lat - latOffset,
    centerCoord.lng - lngOffset,
    centerCoord.lat + latOffset,
    centerCoord.lng + lngOffset,
    width,
    height,
    props.mapPadding
  );

  // ── Center pixel position ─────────────────────────────────────────
  const centerX =
    lngToPixelX(centerCoord.lng, viewport.zoom) + viewport.offsetX;
  const centerY =
    latToPixelY(centerCoord.lat, viewport.zoom) + viewport.offsetY;

  // ── Static camera ─────────────────────────────────────────────────
  const camera = getStaticCamera();

  // ── Map tiles fade in ─────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ───────────────────────────────────────────────
  const fadeOut = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Title spring entrance ─────────────────────────────────────────
  const TITLE_ENTER = 10;
  const titleScale = spring({
    frame: Math.max(0, frame - TITLE_ENTER),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const titleOpacity = interpolate(frame, [TITLE_ENTER, TITLE_ENTER + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Current phase for stats ───────────────────────────────────────
  // The current phase index is the index of the last wave that has started
  let currentPhaseIndex = 0;
  for (let i = 0; i < waves.length; i++) {
    if (frame >= waveEnterFrames[i]) {
      currentPhaseIndex = i;
    }
  }

  // ── Stats panel enter frame ───────────────────────────────────────
  // Stats appear when first wave starts (frame 60)
  const STATS_ENTER = 60;

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
          transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
          transformOrigin: '0 0',
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

        {/* Coverage waves as SVG overlay */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {waves.map((wave, i) => {
            const enterFrame = waveEnterFrames[i];
            const radiusPx = metersToPixels(
              wave.radius,
              centerCoord.lat,
              viewport.zoom
            );
            return (
              <CoverageWave
                key={`wave-${i}`}
                cx={centerX}
                cy={centerY}
                radiusPixels={radiusPx}
                label={wave.label}
                frame={frame}
                enterFrame={enterFrame}
                fps={fps}
                color={props.coverageColor}
                font={FONTS.headline}
              />
            );
          })}
        </svg>

        {/* Center marker */}
        <CenterMarker
          x={centerX}
          y={centerY}
          frame={frame}
          enterFrame={20}
          fps={fps}
          color={props.coverageColor}
          label={centerCoord.label ? 'HQ' : 'HQ'}
          font={FONTS.headline}
        />
      </div>

      {/* ── Fixed overlays ───────────────────────────────────────── */}

      {/* Title — top center */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: '50%',
          transform: `translateX(-50%) scale(${titleScale})`,
          transformOrigin: 'center top',
          opacity: titleOpacity,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderRadius: 14,
            padding: '10px 32px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            borderLeft: `5px solid ${COLORS.primary}`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 38,
              fontWeight: 700,
              color: COLORS.secondary,
              whiteSpace: 'nowrap',
              lineHeight: 1.15,
            }}
          >
            {props.title}
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 20,
              fontWeight: 400,
              color: COLORS.text,
              opacity: 0.75,
              marginTop: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {centerCoord.label}
          </div>
        </div>
      </div>

      {/* Coverage stats bar — bottom */}
      {props.showStats && (
        <CoverageStats
          phases={waves.map((w) => ({
            label: w.label ?? '',
            radius: w.radius,
          }))}
          currentPhaseIndex={currentPhaseIndex}
          frame={frame}
          enterFrame={STATS_ENTER}
          fps={fps}
          font={FONTS}
          colors={COLORS}
        />
      )}
    </AbsoluteFill>
  );
};

export default CoverageMap;
