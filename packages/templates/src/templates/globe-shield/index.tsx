import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  delayRender,
  continueRender,
} from 'remotion';
import Globe from 'react-globe.gl';
import { getConstants, GLOBE_TEXTURES, STAR_FIELD_URL, BUMP_MAP_URL, RING_PRESETS } from './constants';
import type { GlobeShieldProps } from './schema';

/**
 * Earth Shield — Rapid concentric rings expanding from poles/custom points.
 *
 * Timeline (360 frames / 12s @ 30fps):
 * - 0–30:   Fade in
 * - 30–90:  Ring sources activate staggered (source i at 30 + i*15)
 * - 90–300: Full shield active, all rings pulsing
 * - 0–360:  Gentle orbit with tilt oscillation
 * - 330–360: Fade out
 */
const GlobeShield: React.FC<GlobeShieldProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const globeRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Loading globe textures'));

  const textureUrl = GLOBE_TEXTURES[props.globeTexture];

  // Determine ring sources
  const allSources = useMemo(() => {
    if (props.customSources.length > 0) return props.customSources;
    return [...RING_PRESETS[props.ringStyle]];
  }, [props.ringStyle, props.customSources]);

  // Build rings data — sources activate staggered
  const ringsData = useMemo(() => {
    const rings: Array<{
      lat: number;
      lng: number;
      maxR: number;
      propagationSpeed: number;
      repeatPeriod: number;
      altLayer: number;
    }> = [];

    for (let i = 0; i < allSources.length; i++) {
      const activateFrame = 30 + i * 15;
      if (frame < activateFrame) continue;

      const src = allSources[i];
      for (let layer = 0; layer < props.ringLayers; layer++) {
        const layerActivateFrame = activateFrame + layer * 30;
        if (frame < layerActivateFrame) continue;

        rings.push({
          lat: src.lat,
          lng: src.lng,
          maxR: props.ringMaxRadius / 6, // degrees to globe.gl units
          propagationSpeed: props.ringPropagationSpeed,
          repeatPeriod: props.ringRepeatPeriod,
          altLayer: layer,
        });
      }
    }
    return rings;
  }, [frame, allSources, props.ringLayers, props.ringMaxRadius, props.ringPropagationSpeed, props.ringRepeatPeriod]);

  // Point markers at ring sources
  const pointsData = useMemo(() => {
    return allSources
      .filter((_, i) => frame >= 30 + i * 15)
      .map((src) => ({ lat: src.lat, lng: src.lng }));
  }, [frame, allSources]);

  // Parse ring color for fade function
  const ringColorRgb = useMemo(() => {
    const hex = props.ringColor.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }, [props.ringColor]);

  // Camera: gentle orbit with tilt oscillation
  const cameraLat = interpolate(frame, [0, 180, 360], [30, 10, 30], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraLng = interpolate(frame, [0, 360], [0, 90], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraAltitude = interpolate(frame, [0, 60, 300, 360], [3.5, 2.5, 2.5, 3.0], {
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
        atmosphereAltitude={0.25}
        animateIn={false}
        waitForGlobeReady={true}
        enablePointerInteraction={false}
        onGlobeReady={onGlobeReady}
        // Rings
        ringsData={ringsData}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        ringColor={() => (t: number) =>
          `rgba(${ringColorRgb.r}, ${ringColorRgb.g}, ${ringColorRgb.b}, ${Math.pow(1 - t, 1.5)})`
        }
        ringAltitude={(d: any) => d.altLayer * 0.015}
        // Points (source dots)
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => props.ringColor}
        pointAltitude={0.02}
        pointRadius={0.6}
        pointsTransitionDuration={0}
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

      {/* Title */}
      {props.showTitle && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: titleOpacity * titleExitOpacity,
            transform: `translateY(${(1 - titleEnter) * 20}px)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 32,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              textShadow: `0 0 20px ${COLORS.primary}, 0 2px 12px rgba(0,0,0,0.8)`,
            }}
          >
            {props.title}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default GlobeShield;
