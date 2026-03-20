import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  delayRender,
  continueRender,
} from 'remotion';
import Globe from 'react-globe.gl';
import { getConstants, GLOBE_TEXTURES, STAR_FIELD_URL, BUMP_MAP_URL } from './constants';
import type { GlobeNetworkProps, Coord } from './schema';

/**
 * Globe Network — 3D rotating globe with arcs connecting multiple cities.
 *
 * The globe rotates continuously while arcs draw in sequentially,
 * connecting city1 → city2 → city3 → city4 → city5 in a loop.
 * Rings pulse at each node, labels appear on arrival.
 */
const GlobeNetwork: React.FC<GlobeNetworkProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const globeRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Loading globe textures'));

  // ── Collect active cities (non-empty label or has coords) ───────────
  const cities = useMemo(() => {
    const all = [props.city1, props.city2, props.city3, props.city4, props.city5];
    return all.filter((c) => c.label || (c.lat !== 0 && c.lng !== 0));
  }, [props.city1, props.city2, props.city3, props.city4, props.city5]);

  // ── Build arc connections: sequential chain + loop back ─────────────
  const arcSegments = useMemo(() => {
    if (cities.length < 2) return [];
    const segs: Array<{
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
      color: string;
      index: number;
    }> = [];
    for (let i = 0; i < cities.length; i++) {
      const next = cities[(i + 1) % cities.length];
      segs.push({
        startLat: cities[i].lat,
        startLng: cities[i].lng,
        endLat: next.lat,
        endLng: next.lng,
        color: props.arcColor,
        index: i,
      });
    }
    return segs;
  }, [cities, props.arcColor]);

  // ── Arc timing: stagger draw across the timeline ────────────────────
  const arcDrawStart = 30; // first arc starts drawing at frame 30
  const arcDrawDuration = 60; // each arc takes 60 frames to draw
  const arcStagger = 40; // gap between each arc start

  // ── Points data (dot markers at each city) ──────────────────────────
  const pointsData = useMemo(
    () => cities.map((c) => ({ lat: c.lat, lng: c.lng })),
    [cities],
  );

  // ── Rings data (pulse at each city as its arc arrives) ──────────────
  const ringsData = useMemo(() => {
    return cities
      .map((c, i) => {
        // First city ring appears at arcDrawStart, others when their incoming arc finishes
        const ringAppearFrame = i === 0 ? arcDrawStart : arcDrawStart + (i - 1) * arcStagger + arcDrawDuration;
        if (frame < ringAppearFrame) return null;
        return {
          lat: c.lat,
          lng: c.lng,
          maxR: 4,
          propagationSpeed: 2,
          repeatPeriod: 1000,
        };
      })
      .filter(Boolean);
  }, [cities, frame, arcDrawStart, arcStagger, arcDrawDuration]);

  // ── HTML labels ─────────────────────────────────────────────────────
  const htmlData = useMemo(() => {
    if (!props.showLabels) return [];
    return cities
      .map((c, i) => {
        const labelAppearFrame = i === 0 ? arcDrawStart + 10 : arcDrawStart + (i - 1) * arcStagger + arcDrawDuration + 5;
        if (frame < labelAppearFrame || !c.label) return null;
        return { lat: c.lat, lng: c.lng, label: c.label, alt: 0.06 };
      })
      .filter(Boolean);
  }, [cities, frame, props.showLabels, arcDrawStart, arcStagger, arcDrawDuration]);

  const labelColor = COLORS.text;
  const labelFont = FONTS.headline;

  // ── Globe ready → continue render ──────────────────────────────────
  const onGlobeReady = useCallback(() => {
    continueRender(handle);
  }, [handle]);

  // ── Camera: continuous rotation + slight tilt ──────────────────────
  const baseLng = useMemo(() => {
    if (cities.length === 0) return 0;
    const avgLng = cities.reduce((s, c) => s + c.lng, 0) / cities.length;
    return avgLng;
  }, [cities]);

  const baseLat = useMemo(() => {
    if (cities.length === 0) return 20;
    const avgLat = cities.reduce((s, c) => s + c.lat, 0) / cities.length;
    return avgLat * 0.5 + 10; // bias slightly north for a pleasing angle
  }, [cities]);

  useEffect(() => {
    if (!globeRef.current) return;
    const rotationLng = baseLng + (frame / fps) * props.rotationSpeed * 15;
    globeRef.current.pointOfView(
      { lat: baseLat, lng: rotationLng, altitude: 2.2 },
      0,
    );
    const c = globeRef.current.controls();
    if (c) c.enabled = false;
  });

  // ── Fade in / fade out ─────────────────────────────────────────────
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: props.backgroundColor,
        opacity: fadeIn * fadeOut,
        overflow: 'hidden',
      }}
    >
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl={GLOBE_TEXTURES[props.globeTexture]}
        bumpImageUrl={BUMP_MAP_URL}
        backgroundImageUrl={props.showStars ? STAR_FIELD_URL : undefined}
        backgroundColor={props.backgroundColor}
        showAtmosphere={props.showAtmosphere}
        atmosphereColor={COLORS.accent}
        atmosphereAltitude={0.18}
        animateIn={false}
        waitForGlobeReady={true}
        enablePointerInteraction={false}
        onGlobeReady={onGlobeReady}
        // Arcs — each draws progressively based on its timing
        arcsData={arcSegments}
        arcColor="color"
        arcDashLength={(d: any) => {
          const start = arcDrawStart + d.index * arcStagger;
          const end = start + arcDrawDuration;
          return interpolate(frame, [start, end], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.quad),
          });
        }}
        arcDashGap={2}
        arcStroke={props.arcWidth * 0.1}
        arcsTransitionDuration={0}
        // Points — dot markers at each city
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => props.arcColor}
        pointAltitude={0.02}
        pointRadius={0.4}
        pointsTransitionDuration={0}
        // Rings — pulsing at each visited city
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
          el.style.fontSize = '13px';
          el.style.fontWeight = '600';
          el.style.letterSpacing = '0.08em';
          el.style.textTransform = 'uppercase';
          el.style.textShadow = '0 2px 8px rgba(0,0,0,0.9)';
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
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default GlobeNetwork;
