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
import { getConstants, GLOBE_TEXTURES, STAR_FIELD_URL, BUMP_MAP_URL } from './constants';
import type { GlobeConnectionsProps } from './schema';

/**
 * Global Connections — Dark globe with neon arcs launching sequentially
 * from a hub city to worldwide destinations, ring ripples at landings.
 *
 * Timeline (360 frames / 12s @ 30fps):
 * - 0–30:   Fade in, camera at hub
 * - 60–300: Arcs launch sequentially (arc i starts at 60 + i * stagger)
 * - Ring i appears when arc i is ~80% drawn
 * - 60–240: Camera pulls out, orbits +45° lng
 * - 330–360: Fade out
 */
const GlobeConnections: React.FC<GlobeConnectionsProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const globeRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Loading globe textures'));

  const textureUrl = GLOBE_TEXTURES[props.globeTexture];
  const stagger = props.arcStaggerFrames;

  // Build arcs data with staggered launch frames
  const arcsData = useMemo(() => {
    return props.destinations.map((dest, i) => ({
      startLat: props.hubCity.lat,
      startLng: props.hubCity.lng,
      endLat: dest.lat,
      endLng: dest.lng,
      label: dest.label,
      launchFrame: 60 + i * stagger,
      color: props.arcColor,
    }));
  }, [props.hubCity, props.destinations, stagger, props.arcColor]);

  // Hub point
  const pointsData = useMemo(
    () => [{ lat: props.hubCity.lat, lng: props.hubCity.lng }],
    [props.hubCity.lat, props.hubCity.lng],
  );

  // Rings at destinations — appear when arc is ~80% drawn
  const ringsData = useMemo(() => {
    if (!props.showRings) return [];
    return props.destinations
      .map((dest, i) => {
        const arcLaunch = 60 + i * stagger;
        const ringAppearFrame = arcLaunch + 72; // 80% of 90 frame draw
        if (frame < ringAppearFrame) return null;
        return {
          lat: dest.lat,
          lng: dest.lng,
          maxR: 3,
          propagationSpeed: 2,
          repeatPeriod: 800,
        };
      })
      .filter(Boolean) as Array<{
        lat: number; lng: number; maxR: number;
        propagationSpeed: number; repeatPeriod: number;
      }>;
  }, [frame, props.destinations, stagger, props.showRings]);

  // HTML labels — appear with their arc
  const htmlData = useMemo(() => {
    if (!props.showLabels) return [];
    const labels: Array<{ lat: number; lng: number; label: string; alt: number }> = [];

    // Hub label
    if (props.hubCity.label && frame >= 30) {
      labels.push({
        lat: props.hubCity.lat,
        lng: props.hubCity.lng,
        label: props.hubCity.label,
        alt: 0.05,
      });
    }

    // Destination labels — appear when arc reaches ~80%
    props.destinations.forEach((dest, i) => {
      if (!dest.label) return;
      const arcLaunch = 60 + i * stagger;
      if (frame < arcLaunch + 72) return;
      labels.push({
        lat: dest.lat,
        lng: dest.lng,
        label: dest.label,
        alt: 0.05,
      });
    });

    return labels;
  }, [frame, props.hubCity, props.destinations, stagger, props.showLabels]);

  const labelColor = COLORS.text;
  const labelFont = FONTS.headline;

  // Camera: start at hub, pull out and orbit
  const cameraLat = interpolate(frame, [0, 60, 300, 360], [props.hubCity.lat, props.hubCity.lat, 20, 20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraLng = interpolate(frame, [0, 60, 240, 360], [props.hubCity.lng, props.hubCity.lng, props.hubCity.lng + 45, props.hubCity.lng + 50], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraAltitude = interpolate(frame, [0, 30, 60, 240, 360], [1.8, 1.8, 1.8, 3.5, 3.5], {
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
        atmosphereAltitude={0.2}
        animateIn={false}
        waitForGlobeReady={true}
        enablePointerInteraction={false}
        onGlobeReady={onGlobeReady}
        // Arcs — staggered draw via function accessor
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={(d: any) => {
          const progress = interpolate(frame, [d.launchFrame, d.launchFrame + 90], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return progress;
        }}
        arcDashGap={2}
        arcStroke={props.arcWidth * 0.1}
        arcsTransitionDuration={0}
        // Points (hub dot)
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => props.arcColor}
        pointAltitude={0.02}
        pointRadius={0.7}
        pointsTransitionDuration={0}
        // Rings
        ringsData={ringsData}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => props.arcColor}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        // HTML labels
        htmlElementsData={htmlData}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude="alt"
        htmlTransitionDuration={0}
        htmlElement={(d: any) => {
          const el = document.createElement('div');
          el.textContent = d.label;
          el.style.color = labelColor;
          el.style.fontFamily = labelFont;
          el.style.fontSize = '12px';
          el.style.fontWeight = '600';
          el.style.letterSpacing = '0.08em';
          el.style.textTransform = 'uppercase';
          el.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
          el.style.pointerEvents = 'none';
          el.style.whiteSpace = 'nowrap';
          return el;
        }}
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
              fontSize: 30,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textShadow: `0 0 16px ${COLORS.primary}, 0 2px 12px rgba(0,0,0,0.8)`,
            }}
          >
            {props.title}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default GlobeConnections;
