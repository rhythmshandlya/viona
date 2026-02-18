import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { GlitchTransitionProps } from './schema';

// ── Deterministic pseudo-random based on seed ──
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49269;
  return x - Math.floor(x);
}

// ── DotGrid SVG background ──
const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="glitch-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#glitch-dot-grid)" />
  </svg>
);

// ── Scan Lines overlay ──
const ScanLines: React.FC<{ opacity: number; color: string }> = ({ opacity, color }) => (
  <AbsoluteFill
    style={{
      background: `repeating-linear-gradient(
        0deg,
        transparent 0px,
        transparent 2px,
        ${color} 2px,
        ${color} 3px
      )`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

// ── Corruption Block ──
interface CorruptionBlockData {
  x: number;
  y: number;
  w: number;
  h: number;
  offsetX: number;
  color: string;
  flickerSeed: number;
}

const CorruptionBlocks: React.FC<{
  frame: number;
  intensity: number;
  glitchAmount: number;
  accentColor: string;
}> = ({ frame, intensity, glitchAmount, accentColor }) => {
  const blocks = useMemo<CorruptionBlockData[]>(() => {
    const result: CorruptionBlockData[] = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const seed = i * 7 + 31;
      result.push({
        x: seededRandom(seed) * 1080,
        y: seededRandom(seed + 1) * 1080,
        w: 60 + seededRandom(seed + 2) * 300,
        h: 4 + seededRandom(seed + 3) * 40,
        offsetX: (seededRandom(seed + 4) - 0.5) * 80 * intensity,
        color:
          seededRandom(seed + 5) > 0.5
            ? accentColor
            : seededRandom(seed + 5) > 0.25
              ? '#FF0040'
              : 'rgba(255,255,255,0.15)',
        flickerSeed: seed + 6,
      });
    }
    return result;
  }, [intensity, accentColor]);

  if (glitchAmount <= 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {blocks.map((block, i) => {
        // Flicker: each block appears/disappears at different frame intervals
        const flickerPhase = Math.floor(frame * 0.5 + block.flickerSeed);
        const visible = seededRandom(flickerPhase) > 0.4;
        if (!visible) return null;

        // Jitter position each frame
        const jitterX = (seededRandom(frame * 3 + i * 13) - 0.5) * 20 * intensity;
        const jitterY = (seededRandom(frame * 5 + i * 17) - 0.5) * 10 * intensity;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: block.x + block.offsetX * glitchAmount + jitterX,
              top: block.y + jitterY,
              width: block.w * (0.5 + glitchAmount * 0.5),
              height: block.h,
              backgroundColor: block.color,
              opacity: glitchAmount * 0.8,
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Digital Noise texture overlay ──
const DigitalNoise: React.FC<{ frame: number; opacity: number }> = ({ frame, opacity }) => {
  const noiseLines = useMemo(() => {
    const lines: { top: number; height: number; opacity: number }[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push({
        top: seededRandom(i * 11 + 3) * 1080,
        height: 1 + seededRandom(i * 11 + 7) * 3,
        opacity: 0.1 + seededRandom(i * 11 + 9) * 0.3,
      });
    }
    return lines;
  }, []);

  if (opacity <= 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      {noiseLines.map((line, i) => {
        const visible = seededRandom(frame * 7 + i * 23) > 0.5;
        if (!visible) return null;
        const jitterY = (seededRandom(frame * 11 + i * 29) - 0.5) * 40;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: line.top + jitterY,
              width: '100%',
              height: line.height,
              backgroundColor: `rgba(255,255,255,${line.opacity})`,
              mixBlendMode: 'overlay',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ── Main Component ──
const GlitchTransition: React.FC<GlitchTransitionProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];
  const intensity = props.intensity;

  // ── Phase interpolations ──

  // Background fade in (0-15)
  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out (330-360)
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pre-glitch subtle scan lines (15-60): ramp from 0 to 0.3
  const preGlitchScan = interpolate(frame, [15, 60], [0, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Main glitch (60-120): intense ramp up then sustain
  const mainGlitchRamp = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mainGlitchDown = interpolate(frame, [110, 160], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mainGlitch = Math.min(mainGlitchRamp, 1) * Math.min(mainGlitchDown + 0.001, 1);

  // Settle phase (120-160): glitch reduces
  const settleAmount = interpolate(frame, [120, 160], [0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Clean hold subtle scan lines (160-310)
  const holdScan = interpolate(frame, [160, 180], [0, 0.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const holdScanOut = interpolate(frame, [290, 310], [0.08, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cleanHoldScan = frame < 180 ? holdScan : frame > 290 ? holdScanOut : 0.08;

  // Second glitch burst (310-340)
  const secondGlitchUp = interpolate(frame, [310, 320], [0, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const secondGlitchDown = interpolate(frame, [330, 345], [0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const secondGlitch = frame < 320 ? secondGlitchUp : secondGlitchDown;

  // Composite glitch amount (used for RGB split, corruption, noise)
  const glitchAmount = Math.max(mainGlitch, settleAmount, secondGlitch) * intensity;

  // Scan line composite opacity
  const scanOpacity = Math.max(preGlitchScan, glitchAmount * 0.6, cleanHoldScan) * intensity;

  // ── RGB Split offset ──
  const rgbOffset = glitchAmount * 12;

  // Frame-based jitter for RGB split during glitch
  const rgbJitterX = glitchAmount > 0.1
    ? (seededRandom(frame * 13) - 0.5) * 8 * glitchAmount * intensity
    : 0;
  const rgbJitterY = glitchAmount > 0.1
    ? (seededRandom(frame * 17) - 0.5) * 4 * glitchAmount * intensity
    : 0;

  // ── White flash (peaks at frame 75-85, brief) ──
  const flashMain = interpolate(frame, [70, 78, 82, 95], [0, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flashSecond = interpolate(frame, [315, 320, 322, 330], [0, 0.35, 0.35, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flashOpacity = Math.max(flashMain, flashSecond) * intensity;

  // ── Text animation (100-130 slam in, hold, exit with fade out) ──
  const textSpring = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.7 },
  });
  const textScale = interpolate(textSpring, [0, 1], [1.8, 1.0]);
  const textOpacity = interpolate(frame, [100, 108], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textExitOpacity = interpolate(frame, [330, 355], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Text glitch jitter during intense phases
  const textJitterX = glitchAmount > 0.3
    ? (seededRandom(frame * 19 + 7) - 0.5) * 16 * glitchAmount
    : 0;
  const textJitterY = glitchAmount > 0.3
    ? (seededRandom(frame * 23 + 11) - 0.5) * 8 * glitchAmount
    : 0;

  // ── Overall opacity ──
  const overallOpacity = bgFadeIn * fadeOut;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: overallOpacity,
        overflow: 'hidden',
      }}
    >
      {/* DotGrid background */}
      <DotGrid color={theme.gridColor} />

      {/* ── RGB Split: Red layer (offset left/up) ── */}
      <AbsoluteFill
        style={{
          backgroundColor: theme.bg,
          mixBlendMode: 'screen',
          opacity: glitchAmount > 0.05 ? 0.6 * glitchAmount : 0,
          transform: `translate(${-rgbOffset + rgbJitterX}px, ${-rgbOffset * 0.3 + rgbJitterY}px)`,
          pointerEvents: 'none',
        }}
      >
        <AbsoluteFill
          style={{
            backgroundColor: '#FF0000',
            opacity: 0.3,
          }}
        />
        <DotGrid color="rgba(255,0,0,0.1)" />
      </AbsoluteFill>

      {/* ── RGB Split: Cyan layer (offset right/down) ── */}
      <AbsoluteFill
        style={{
          backgroundColor: theme.bg,
          mixBlendMode: 'screen',
          opacity: glitchAmount > 0.05 ? 0.6 * glitchAmount : 0,
          transform: `translate(${rgbOffset - rgbJitterX}px, ${rgbOffset * 0.3 - rgbJitterY}px)`,
          pointerEvents: 'none',
        }}
      >
        <AbsoluteFill
          style={{
            backgroundColor: props.accentColor,
            opacity: 0.3,
          }}
        />
        <DotGrid color={`${props.accentColor}1A`} />
      </AbsoluteFill>

      {/* ── Scan Lines ── */}
      <ScanLines opacity={scanOpacity} color={theme.scanLineColor} />

      {/* ── Corruption Blocks ── */}
      <CorruptionBlocks
        frame={frame}
        intensity={intensity}
        glitchAmount={glitchAmount}
        accentColor={props.accentColor}
      />

      {/* ── Digital Noise ── */}
      <DigitalNoise frame={frame} opacity={glitchAmount * 0.5} />

      {/* ── Center Text ── */}
      {props.text && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              opacity: textOpacity * textExitOpacity,
              transform: `scale(${textScale}) translate(${textJitterX}px, ${textJitterY}px)`,
            }}
          >
            <h1
              style={{
                fontFamily: FONTS.headline,
                fontSize: 96,
                fontWeight: 900,
                color: theme.text,
                letterSpacing: 6,
                textTransform: 'uppercase',
                textAlign: 'center',
                margin: 0,
                padding: '0 80px',
                textShadow: glitchAmount > 0.1
                  ? `${rgbOffset * 0.5}px 0 ${props.accentColor}, ${-rgbOffset * 0.5}px 0 #FF0040`
                  : 'none',
                lineHeight: 1.1,
              }}
            >
              {props.text}
            </h1>

            {/* Accent underline beneath text */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: 20,
              }}
            >
              <div
                style={{
                  width: interpolate(textSpring, [0, 1], [0, 200]),
                  height: 4,
                  backgroundColor: props.accentColor,
                  opacity: textOpacity * textExitOpacity,
                  boxShadow: `0 0 20px ${props.accentColor}`,
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* ── White Flash overlay ── */}
      <AbsoluteFill
        style={{
          backgroundColor: theme.flashColor,
          opacity: flashOpacity,
          pointerEvents: 'none',
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Horizontal tear lines during glitch ── */}
      {glitchAmount > 0.2 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          {[0.15, 0.35, 0.55, 0.75, 0.9].map((pos, i) => {
            const visible = seededRandom(frame * 3 + i * 41) > 0.5;
            if (!visible) return null;
            const tearOffset = (seededRandom(frame * 7 + i * 53) - 0.5) * 40 * glitchAmount * intensity;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `${pos * 100}%`,
                  width: '100%',
                  height: 2,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  transform: `translateX(${tearOffset}px)`,
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}

      {/* ── Vignette (subtle) ── */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, ${theme.bg} 100%)`,
          opacity: 0.4,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default GlitchTransition;
