import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { PostcardRevealProps } from './schema';
import {
  computeViewport,
  MAP_STYLES,
  MapTileGrid,
  AnimatedPath,
  LocationMarker,
} from '../../lib/map';
import PostcardFrame from './components/PostcardFrame';
import StampOverlay from './components/StampOverlay';
import PostmarkCircle from './components/PostmarkCircle';

/**
 * Postcard Reveal — 3-phase animation (300 frames / 10s @ 30fps)
 *
 * Phase 1 (0-150): Map with route drawing, camera zooms into destination
 * Phase 2 (150-180): 3D card flip transition (map → postcard)
 * Phase 3 (180-300): Vintage postcard face with staggered element reveals
 */
const PostcardReveal: React.FC<PostcardRevealProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  // ── Viewport ─────────────────────────────────────────────────────
  const viewport = computeViewport(
    props.startCoord.lat,
    props.startCoord.lng,
    props.endCoord.lat,
    props.endCoord.lng,
    width,
    height,
    props.mapPadding,
  );

  // ── Phase 1: Route draw (frames 20-130) ──────────────────────────
  const drawProgress = interpolate(frame, [20, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // ── Phase 1: Camera zoom into destination (frames 100-150) ───────
  const zoomT = interpolate(frame, [100, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const cameraScale = interpolate(zoomT, [0, 1], [1, 2.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraX = interpolate(
    zoomT,
    [0, 1],
    [0, width / 2 - viewport.point2.x * 2.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const cameraY = interpolate(
    zoomT,
    [0, 1],
    [0, height / 2 - viewport.point2.y * 2.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 2: 3D Flip (frames 150-180) ────────────────────────────
  const flipProgress = spring({
    frame: Math.max(0, frame - 150),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
    durationInFrames: 30,
  });
  const flipAngle = interpolate(flipProgress, [0, 1], [0, 180], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Determine which face is visible: front (map) or back (postcard)
  const showFront = flipAngle < 90;

  // ── Phase 3: Postcard element stagger (spring entrances) ─────────
  const borderSpring = spring({
    frame: Math.max(0, frame - 180),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const greetingSpring = spring({
    frame: Math.max(0, frame - 195),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const destinationSpring = spring({
    frame: Math.max(0, frame - 210),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const stampSpring = spring({
    frame: Math.max(0, frame - 225),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const postmarkSpring = spring({
    frame: Math.max(0, frame - 240),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  // ── Fade out ─────────────────────────────────────────────────────
  const fadeOut = interpolate(frame, [275, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Translate Y for text entrances ───────────────────────────────
  const greetingTranslateY = interpolate(greetingSpring, [0, 1], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const destinationTranslateY = interpolate(destinationSpring, [0, 1], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* ── 3D Flip Container ─────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          width,
          height,
          perspective: 1000,
        }}
      >
        {/* ── FRONT FACE: Map ───────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            width,
            height,
            backfaceVisibility: 'hidden',
            transform: `rotateY(${flipAngle}deg)`,
            overflow: 'hidden',
          }}
        >
          {/* Camera-transformed map world */}
          <div
            style={{
              transform: `translate(${cameraX}px, ${cameraY}px) scale(${cameraScale})`,
              transformOrigin: '0 0',
              width,
              height,
              position: 'absolute',
            }}
          >
            <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
              <MapTileGrid
                viewport={viewport}
                width={width}
                height={height}
                mapStyle={props.mapStyle}
                margin={width / 2}
              />
            </div>

            {/* Animated route */}
            <AnimatedPath
              x1={viewport.point1.x}
              y1={viewport.point1.y}
              x2={viewport.point2.x}
              y2={viewport.point2.y}
              frame={frame}
              startFrame={20}
              endFrame={130}
              lineColor={COLORS.primary}
              lineWidth={4}
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
              enterFrame={15}
              color={COLORS.primary}
              size={s(18)}
              markerStyle="pulse"
            />

            {/* End marker */}
            <LocationMarker
              x={viewport.point2.x}
              y={viewport.point2.y}
              frame={frame}
              enterFrame={130}
              color={COLORS.primary}
              size={s(18)}
              markerStyle="pulse"
            />
          </div>
        </div>

        {/* ── BACK FACE: Postcard ───────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            width,
            height,
            backfaceVisibility: 'hidden',
            transform: `rotateY(${flipAngle - 180}deg)`,
            overflow: 'hidden',
          }}
        >
          <PostcardFrame
            width={width}
            height={height}
            borderStyle={props.borderStyle}
            backgroundColor={COLORS.background}
            borderColor={COLORS.secondary}
            accentColor={COLORS.accent}
            greeting={props.greeting}
            destinationName={props.destinationName}
            headlineFont={FONTS.headline}
            bodyFont={FONTS.body}
            textColor={COLORS.text}
            greetingOpacity={greetingSpring}
            destinationOpacity={destinationSpring}
            borderOpacity={borderSpring}
            greetingTranslateY={greetingTranslateY}
            destinationTranslateY={destinationTranslateY}
          >
            {/* Stamp — top-right */}
            <StampOverlay
              x={width - 160}
              y={60}
              stampColor={props.stampColor}
              opacity={stampSpring}
              scale={interpolate(stampSpring, [0, 1], [0.5, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
            />

            {/* Postmark — overlapping stamp slightly */}
            {props.showPostmark && (
              <PostmarkCircle
                x={width - 200}
                y={100}
                opacity={postmarkSpring}
                scale={interpolate(postmarkSpring, [0, 1], [0.5, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}
                color={COLORS.secondary}
              />
            )}
          </PostcardFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default PostcardReveal;
