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
import type { GlobeSpinProps } from './schema';

/**
 * Globe Spin — 3D globe with real NASA satellite textures, glowing arc
 * connecting two cities, cinematic camera orbit and zoom.
 *
 * Powered by react-globe.gl (WebGL globe with built-in arc/point/ring layers).
 *
 * Timeline (360 frames / 12s @ 30fps):
 * - Phase 1 (0–90):   Wide establishing shot at midpoint, high altitude
 * - Phase 2 (90–270):  Camera pans start → end as arc draws progressively
 * - Phase 3 (270–360): Zoom in toward destination
 */
const GlobeSpin: React.FC<GlobeSpinProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const globeRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Loading globe textures'));

  // ── Texture URLs ──────────────────────────────────────────────────────
  const textureUrl = GLOBE_TEXTURES[props.globeTexture];

  // ── Camera animation ──────────────────────────────────────────────────
  const midLat = (props.startCoord.lat + props.endCoord.lat) / 2;
  const midLng = (props.startCoord.lng + props.endCoord.lng) / 2;

  const cameraLat = interpolate(
    frame,
    [0, 90, 270, 360],
    [midLat, props.startCoord.lat, props.endCoord.lat, props.endCoord.lat],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const cameraLng = interpolate(
    frame,
    [0, 90, 270, 360],
    [midLng, props.startCoord.lng, props.endCoord.lng, props.endCoord.lng],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const cameraAltitude = interpolate(
    frame,
    [0, 90, 270, 360],
    [3.0, 2.5, 2.5, 1.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Arc draw progress ─────────────────────────────────────────────────
  const drawProgress = interpolate(frame, [90, 270], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // ── Arc data ──────────────────────────────────────────────────────────
  const arcsData = useMemo(
    () => [
      {
        startLat: props.startCoord.lat,
        startLng: props.startCoord.lng,
        endLat: props.endCoord.lat,
        endLng: props.endCoord.lng,
        color: props.arcColor,
      },
    ],
    [
      props.startCoord.lat,
      props.startCoord.lng,
      props.endCoord.lat,
      props.endCoord.lng,
      props.arcColor,
    ],
  );

  // ── Points data (dot markers at endpoints) ────────────────────────────
  const pointsData = useMemo(
    () => [
      { lat: props.startCoord.lat, lng: props.startCoord.lng },
      { lat: props.endCoord.lat, lng: props.endCoord.lng },
    ],
    [
      props.startCoord.lat,
      props.startCoord.lng,
      props.endCoord.lat,
      props.endCoord.lng,
    ],
  );

  // ── Rings data (pulsing rings at endpoints) ───────────────────────────
  const showStartRing = frame >= 60;
  const showEndRing = frame >= 250;
  const ringsData = useMemo(() => {
    const rings: Array<{
      lat: number;
      lng: number;
      maxR: number;
      propagationSpeed: number;
      repeatPeriod: number;
    }> = [];
    if (showStartRing) {
      rings.push({
        lat: props.startCoord.lat,
        lng: props.startCoord.lng,
        maxR: 3,
        propagationSpeed: 2,
        repeatPeriod: 800,
      });
    }
    if (showEndRing) {
      rings.push({
        lat: props.endCoord.lat,
        lng: props.endCoord.lng,
        maxR: 3,
        propagationSpeed: 2,
        repeatPeriod: 800,
      });
    }
    return rings;
  }, [
    showStartRing,
    showEndRing,
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
  ]);

  // ── HTML labels (positioned in 3D space by globe.gl) ──────────────────
  const showStartLabel = props.showLabels && !!props.startCoord.label && frame >= 60;
  const showEndLabel = props.showLabels && !!props.endCoord.label && frame >= 250;
  const htmlData = useMemo(() => {
    const labels: Array<{
      lat: number;
      lng: number;
      label: string;
      alt: number;
    }> = [];
    if (showStartLabel) {
      labels.push({
        lat: props.startCoord.lat,
        lng: props.startCoord.lng,
        label: props.startCoord.label!,
        alt: 0.05,
      });
    }
    if (showEndLabel) {
      labels.push({
        lat: props.endCoord.lat,
        lng: props.endCoord.lng,
        label: props.endCoord.label!,
        alt: 0.05,
      });
    }
    return labels;
  }, [showStartLabel, showEndLabel, props.startCoord, props.endCoord]);

  // Capture label styling for the imperative htmlElement callback
  const labelColor = COLORS.text;
  const labelFont = FONTS.headline;

  // ── Globe ready → continue render ─────────────────────────────────────
  const onGlobeReady = useCallback(() => {
    continueRender(handle);
  }, [handle]);

  // ── Camera control via pointOfView (every frame) ──────────────────────
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: cameraLat, lng: cameraLng, altitude: cameraAltitude },
      0,
    );
    const c = globeRef.current.controls();
    if (c) c.enabled = false;
  });

  // ── Fade in / fade out ────────────────────────────────────────────────
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalOpacity = fadeIn * fadeOut;

  // ── Route text animation ──────────────────────────────────────────────
  const titleEnter = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
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
        backgroundColor: props.backgroundColor,
        opacity: globalOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Globe with real NASA textures */}
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl={textureUrl}
        bumpImageUrl={BUMP_MAP_URL}
        backgroundImageUrl={props.showStars ? STAR_FIELD_URL : undefined}
        backgroundColor={props.backgroundColor}
        showAtmosphere={props.showAtmosphere}
        atmosphereColor={COLORS.accent}
        atmosphereAltitude={0.2}
        animateIn={false}
        waitForGlobeReady={true}
        enablePointerInteraction={false}
        onGlobeReady={onGlobeReady}
        // Arcs — progressive draw via dash length
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={drawProgress}
        arcDashGap={2}
        arcStroke={props.arcWidth * 0.1}
        arcsTransitionDuration={0}
        // Points — small dot markers at start/end
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => props.arcColor}
        pointAltitude={0.02}
        pointRadius={0.5}
        pointsTransitionDuration={0}
        // Rings — pulsing effect at endpoints
        ringsData={ringsData}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => props.arcColor}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        // HTML labels — positioned in 3D, auto-occluded behind globe
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
          el.style.fontSize = '14px';
          el.style.fontWeight = '600';
          el.style.letterSpacing = '0.08em';
          el.style.textTransform = 'uppercase';
          el.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
          el.style.pointerEvents = 'none';
          el.style.whiteSpace = 'nowrap';
          return el;
        }}
      />

      {/* Vignette overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.5) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Route text bar */}
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
        {props.startCoord.label && props.endCoord.label && (
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.text,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span>{props.startCoord.label}</span>
            <span
              style={{
                display: 'inline-block',
                width: 40,
                height: 2,
                backgroundColor: props.arcColor,
                boxShadow: `0 0 8px ${props.arcColor}`,
              }}
            />
            <span>{props.endCoord.label}</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default GlobeSpin;
