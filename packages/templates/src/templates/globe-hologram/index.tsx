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
import * as THREE from 'three';
import { getConstants, GLOBE_TEXTURES, STAR_FIELD_URL } from './constants';
import type { GlobeHologramProps } from './schema';

/**
 * Hologram Globe — Transparent wireframe/hollow globe with cyberpunk neon arcs,
 * scanline overlay and typewriter labels.
 *
 * Timeline (360 frames / 12s @ 30fps):
 * - 0–45:   Globe materializes (wireframe fades in)
 * - 45:     Start label appears (typewriter)
 * - 60–210: Neon arc draws start→end
 * - 200:    End label appears (typewriter)
 * - 0–360:  Scanline sweeps continuously
 * - 330–360: Fade out
 */
const GlobeHologram: React.FC<GlobeHologramProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const globeRef = useRef<any>(null);
  const [handle] = useState(() => delayRender('Loading globe'));

  // Arc draw progress
  const drawProgress = interpolate(frame, [60, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  // Materialize opacity (wireframe fading in)
  const materializeOpacity = interpolate(frame, [0, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Arc data
  const arcsData = useMemo(
    () => [
      {
        startLat: props.startCoord.lat,
        startLng: props.startCoord.lng,
        endLat: props.endCoord.lat,
        endLng: props.endCoord.lng,
      },
    ],
    [props.startCoord.lat, props.startCoord.lng, props.endCoord.lat, props.endCoord.lng],
  );

  // Points at endpoints
  const pointsData = useMemo(
    () => [
      { lat: props.startCoord.lat, lng: props.startCoord.lng },
      { lat: props.endCoord.lat, lng: props.endCoord.lng },
    ],
    [props.startCoord.lat, props.startCoord.lng, props.endCoord.lat, props.endCoord.lng],
  );

  // Typewriter effect for labels
  const typewriterText = (text: string, startFrame: number, charsPerFrame: number = 0.5) => {
    const elapsed = Math.max(0, frame - startFrame);
    const chars = Math.floor(elapsed * charsPerFrame);
    return text.substring(0, Math.min(chars, text.length));
  };

  const startLabelText = props.startCoord.label
    ? typewriterText(props.startCoord.label, 45)
    : '';
  const endLabelText = props.endCoord.label
    ? typewriterText(props.endCoord.label, 200)
    : '';

  // HTML labels
  const htmlData = useMemo(() => {
    if (!props.showLabels) return [];
    const labels: Array<{ lat: number; lng: number; label: string; alt: number; isStart: boolean }> = [];
    if (props.startCoord.label && frame >= 45) {
      labels.push({
        lat: props.startCoord.lat,
        lng: props.startCoord.lng,
        label: startLabelText,
        alt: 0.06,
        isStart: true,
      });
    }
    if (props.endCoord.label && frame >= 200) {
      labels.push({
        lat: props.endCoord.lat,
        lng: props.endCoord.lng,
        label: endLabelText,
        alt: 0.06,
        isStart: false,
      });
    }
    return labels;
  }, [frame, props.showLabels, props.startCoord, props.endCoord, startLabelText, endLabelText]);

  const labelColor = COLORS.text;

  // Camera: midpoint between cities, gentle orbit
  const midLat = (props.startCoord.lat + props.endCoord.lat) / 2;
  const midLng = (props.startCoord.lng + props.endCoord.lng) / 2;

  const cameraLat = interpolate(
    frame,
    [0, 90, 270, 360],
    [midLat + 10, midLat, midLat - 5, midLat],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const cameraLng = interpolate(
    frame,
    [0, 90, 270, 360],
    [midLng, midLng + 15, midLng + 30, midLng + 35],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const cameraAltitude = interpolate(frame, [0, 60, 300, 360], [3.5, 2.2, 2.2, 2.8], {
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

  // Scanline position (cycles every 90 frames)
  const scanlineY = ((frame % 90) / 90) * 100;

  // Wireframe material — created once, opacity updated per frame
  const wireframeMaterial = useMemo(() => {
    if (props.style !== 'wireframe') return undefined;
    const mat = new THREE.MeshPhongMaterial({
      wireframe: true,
      color: new THREE.Color(props.glowColor),
      opacity: 0.15,
      transparent: true,
    });
    return mat;
  }, [props.style, props.glowColor]);

  // Update wireframe opacity for materialize effect
  if (wireframeMaterial) {
    wireframeMaterial.opacity = 0.15 * materializeOpacity;
  }

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
        globeImageUrl={props.style === 'wireframe' ? GLOBE_TEXTURES['dark'] : undefined}
        globeMaterial={wireframeMaterial}
        backgroundImageUrl={undefined}
        backgroundColor="rgba(0,0,0,0)"
        showGlobe={props.style === 'wireframe'}
        showGraticules={true}
        showAtmosphere={props.showAtmosphere}
        atmosphereColor={props.glowColor}
        atmosphereAltitude={0.35}
        animateIn={false}
        waitForGlobeReady={true}
        enablePointerInteraction={false}
        onGlobeReady={onGlobeReady}
        // Arcs
        arcsData={arcsData}
        arcColor={() => [props.arcColor, props.glowColor]}
        arcDashLength={drawProgress}
        arcDashGap={2}
        arcStroke={0.4}
        arcsTransitionDuration={0}
        // Points
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => props.glowColor}
        pointAltitude={0.03}
        pointRadius={0.5}
        pointsTransitionDuration={0}
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
          el.style.fontFamily = '"Courier New", monospace';
          el.style.fontSize = '14px';
          el.style.fontWeight = '700';
          el.style.letterSpacing = '0.1em';
          el.style.textTransform = 'uppercase';
          el.style.textShadow = `0 0 10px ${labelColor}, 0 0 20px ${labelColor}`;
          el.style.pointerEvents = 'none';
          el.style.whiteSpace = 'nowrap';
          el.style.borderBottom = `1px solid ${labelColor}`;
          el.style.paddingBottom = '2px';
          return el;
        }}
      />

      {/* Scanline overlay */}
      {props.showScanline && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${scanlineY}%`,
              height: 2,
              background: `linear-gradient(to right, transparent, ${props.glowColor}66, transparent)`,
              boxShadow: `0 0 20px ${props.glowColor}44, 0 0 40px ${props.glowColor}22`,
            }}
          />
          {/* Subtle horizontal line pattern */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 3px,
                rgba(0,255,204,0.03) 3px,
                rgba(0,255,204,0.03) 4px
              )`,
            }}
          />
        </div>
      )}

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Title bar — cyberpunk style */}
      {props.showTitle && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: titleOpacity * titleExitOpacity,
            transform: `translateY(${(1 - titleEnter) * -20}px)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 24,
              fontWeight: 700,
              color: props.glowColor,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              textShadow: `0 0 12px ${props.glowColor}, 0 0 24px ${props.glowColor}66`,
              borderTop: `1px solid ${props.glowColor}44`,
              borderBottom: `1px solid ${props.glowColor}44`,
              padding: '8px 24px',
            }}
          >
            {props.title}
          </div>
        </div>
      )}

      {/* Bottom route bar */}
      {props.showLabels && props.startCoord.label && props.endCoord.label && (
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: titleOpacity * titleExitOpacity,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 16,
              fontWeight: 600,
              color: `${props.glowColor}88`,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>{props.startCoord.label}</span>
            <span
              style={{
                display: 'inline-block',
                width: 30,
                height: 1,
                backgroundColor: props.arcColor,
                boxShadow: `0 0 8px ${props.arcColor}`,
              }}
            />
            <span>{props.endCoord.label}</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default GlobeHologram;
