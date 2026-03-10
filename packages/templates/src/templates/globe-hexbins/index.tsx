import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  delayRender,
  continueRender,
  Easing,
} from 'remotion';
import Globe from 'react-globe.gl';
import { getConstants, lerpColor, GLOBE_TEXTURES, STAR_FIELD_URL, BUMP_MAP_URL } from './constants';
import type { GlobeHexbinsProps } from './schema';

/**
 * Population Towers — 3D hex columns rising from globe, colored by value.
 *
 * Timeline (360 frames / 12s @ 30fps):
 * - 0–30:   Fade in, camera high above
 * - 45–180: Hex columns rise from 0 → full height (eased)
 * - 180–300: Auto-orbit to show all sides
 * - 330–360: Fade out
 */
const GlobeHexbins: React.FC<GlobeHexbinsProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const globeRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Loading globe textures'));

  const textureUrl = GLOBE_TEXTURES[props.globeTexture];

  // Rise animation progress
  const riseProgress = interpolate(frame, [45, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Hex bin data — transform cities to the format react-globe.gl expects
  const hexBinData = useMemo(() => {
    return props.cities.map((city) => ({
      lat: city.lat,
      lng: city.lng,
      weight: city.value,
    }));
  }, [props.cities]);

  // Max weight for normalization
  const maxWeight = useMemo(() => {
    return Math.max(...props.cities.map((c) => c.value), 1);
  }, [props.cities]);

  // Camera: high establishing shot → orbit
  const cameraLat = interpolate(frame, [0, 60, 180, 360], [45, 35, 20, 20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraLng = interpolate(frame, [0, 180, 360], [30, 30, 210], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraAltitude = interpolate(frame, [0, 60, 360], [3.5, 2.5, 2.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade in / out
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalOpacity = fadeIn * fadeOut;

  const onGlobeReady = useCallback(() => {
    continueRender(handle);
  }, [handle]);

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: cameraLat, lng: cameraLng, altitude: cameraAltitude },
      0,
    );
    const c = globeRef.current.controls();
    if (c) c.enabled = false;
  });

  // Title animation
  const titleEnter = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const titleOpacity = interpolate(frame, [0, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleExitOpacity = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Capture for closures
  const colorLow = props.colorLow;
  const colorHigh = props.colorHigh;
  const maxAlt = props.maxAltitude;
  const currentRise = riseProgress;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        opacity: globalOpacity,
        overflow: 'hidden',
      }}
    >
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl={textureUrl}
        bumpImageUrl={BUMP_MAP_URL}
        backgroundImageUrl={props.showStars ? STAR_FIELD_URL : undefined}
        backgroundColor={COLORS.background}
        showAtmosphere={props.showAtmosphere}
        atmosphereColor={COLORS.primary}
        atmosphereAltitude={0.2}
        animateIn={false}
        waitForGlobeReady={true}
        enablePointerInteraction={false}
        onGlobeReady={onGlobeReady}
        // Hex bins
        hexBinPointsData={hexBinData}
        hexBinPointLat="lat"
        hexBinPointLng="lng"
        hexBinPointWeight="weight"
        hexBinResolution={props.hexResolution}
        hexMargin={props.hexMargin}
        hexAltitude={(d: any) => {
          const weight = d.sumWeight || 0;
          return (weight / maxWeight) * maxAlt * currentRise;
        }}
        hexTopColor={(d: any) => {
          const weight = d.sumWeight || 0;
          return lerpColor(colorLow, colorHigh, weight / maxWeight);
        }}
        hexSideColor={(d: any) => {
          const weight = d.sumWeight || 0;
          return lerpColor(colorLow, colorHigh, weight / maxWeight);
        }}
        hexBinMerge={true}
        hexTransitionDuration={0}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.5) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Title + Subtitle */}
      {props.showTitle && (
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: titleOpacity * titleExitOpacity,
            transform: `translateY(${(1 - titleEnter) * 20}px)`,
            pointerEvents: 'none',
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 30,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            }}
          >
            {props.title}
          </div>
          {props.subtitle && (
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 16,
                fontWeight: 400,
                color: `${COLORS.text}aa`,
                letterSpacing: '0.05em',
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              {props.subtitle}
            </div>
          )}

          {/* Legend bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <span style={{ fontFamily: FONTS.body, fontSize: 11, color: `${COLORS.text}88` }}>
              Low
            </span>
            <div
              style={{
                width: 120,
                height: 6,
                borderRadius: 3,
                background: `linear-gradient(to right, ${colorLow}, ${colorHigh})`,
              }}
            />
            <span style={{ fontFamily: FONTS.body, fontSize: 11, color: `${COLORS.text}88` }}>
              High
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default GlobeHexbins;
