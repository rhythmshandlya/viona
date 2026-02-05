import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  registerRoot,
} from 'remotion';
import { COLORS, SPRING_CONFIG, TIMING, glassStyle } from './constants';

// ============================================
// ANIMATED BACKGROUND
// ============================================
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Subtle grid pattern */}
      <svg width={width} height={height} style={{ position: 'absolute', opacity: 0.1 }}>
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke={COLORS.primary} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Subtle floating particles */}
      {Array.from({ length: 15 }).map((_, i) => {
        const x = ((frame * 0.5 + i * 120) % (width + 100)) - 50;
        const y = height * (0.2 + (i % 5) * 0.15) + Math.sin((frame + i * 30) * 0.02) * 30;
        const isCyan = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isCyan ? COLORS.primary : COLORS.secondary,
              opacity: 0.3,
              filter: `blur(${1 + (i % 3)}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 1: THE QUESTION (Frames 0-87)
// ============================================

// Question Mark component that fades out
const QuestionMark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Question mark scales in, then fades out
  const scaleIn = spring({ frame, fps, config: SPRING_CONFIG });
  const fadeOut = interpolate(frame, [40, 70], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '35%',
        transform: `translate(-50%, -50%) scale(${scaleIn})`,
        opacity: fadeOut,
        fontSize: 200,
        fontWeight: 900,
        color: COLORS.accent,
        textShadow: `0 0 60px ${COLORS.accent}, 0 0 100px ${COLORS.accent}`,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      ?
    </div>
  );
};

// Folder Icon for Skills (Left side)
const FolderIcon: React.FC<{ glowActive: boolean }> = ({ glowActive }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide in from left
  const slideProgress = spring({ frame: frame - 30, fps, config: SPRING_CONFIG });
  const translateX = interpolate(slideProgress, [0, 1], [-200, 0], { extrapolateRight: 'clamp' });

  const glowIntensity = glowActive ? 1 : 0.3;

  return (
    <div
      style={{
        position: 'absolute',
        left: '20%',
        top: '50%',
        transform: `translate(-50%, -50%) translateX(${translateX}px)`,
        opacity: slideProgress,
      }}
    >
      {/* Folder shape */}
      <svg width="180" height="150" viewBox="0 0 180 150">
        {/* Folder body */}
        <rect
          x="10"
          y="40"
          width="160"
          height="100"
          rx="8"
          fill={COLORS.darkGray}
          stroke={COLORS.primary}
          strokeWidth="2"
          style={{
            filter: `drop-shadow(0 0 ${glowActive ? 30 : 10}px ${COLORS.primary})`,
            transition: 'filter 0.3s ease',
          }}
        />
        {/* Folder tab */}
        <path
          d="M 10 40 L 10 30 Q 10 20 20 20 L 60 20 L 75 40"
          fill={COLORS.darkGray}
          stroke={COLORS.primary}
          strokeWidth="2"
        />
        {/* Glow overlay */}
        {glowActive && (
          <rect
            x="15"
            y="45"
            width="150"
            height="90"
            rx="6"
            fill={COLORS.primary}
            opacity={0.2}
          />
        )}
      </svg>
      {/* Label */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.primary,
          letterSpacing: 2,
          opacity: glowIntensity,
        }}
      >
        SKILLS
      </div>
    </div>
  );
};

// Server Icon for MCP (Right side)
const ServerIcon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide in from right
  const slideProgress = spring({ frame: frame - 35, fps, config: SPRING_CONFIG });
  const translateX = interpolate(slideProgress, [0, 1], [200, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        right: '20%',
        top: '50%',
        transform: `translate(50%, -50%) translateX(${translateX}px)`,
        opacity: slideProgress,
      }}
    >
      {/* Server shape */}
      <svg width="140" height="160" viewBox="0 0 140 160">
        {/* Server unit 1 */}
        <rect
          x="10"
          y="10"
          width="120"
          height="40"
          rx="6"
          fill={COLORS.darkGray}
          stroke={COLORS.secondary}
          strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 10px ${COLORS.secondary})` }}
        />
        <circle cx="30" cy="30" r="6" fill={COLORS.secondary} opacity={0.8} />
        <rect x="50" y="25" width="60" height="10" rx="2" fill={COLORS.mediumGray} />

        {/* Server unit 2 */}
        <rect
          x="10"
          y="60"
          width="120"
          height="40"
          rx="6"
          fill={COLORS.darkGray}
          stroke={COLORS.secondary}
          strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 10px ${COLORS.secondary})` }}
        />
        <circle cx="30" cy="80" r="6" fill={COLORS.secondary} opacity={0.8} />
        <rect x="50" y="75" width="60" height="10" rx="2" fill={COLORS.mediumGray} />

        {/* Server unit 3 */}
        <rect
          x="10"
          y="110"
          width="120"
          height="40"
          rx="6"
          fill={COLORS.darkGray}
          stroke={COLORS.secondary}
          strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 10px ${COLORS.secondary})` }}
        />
        <circle cx="30" cy="130" r="6" fill={COLORS.secondary} opacity={0.8} />
        <rect x="50" y="125" width="60" height="10" rx="2" fill={COLORS.mediumGray} />
      </svg>
      {/* Label */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.secondary,
          letterSpacing: 2,
        }}
      >
        MCP
      </div>
    </div>
  );
};

// VS Divider
const VSDivider: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({ frame: frame - 50, fps, config: SPRING_CONFIG });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.white,
          textShadow: `0 0 20px ${COLORS.accent}`,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        VS
      </div>
    </div>
  );
};

// Scene 1 Component
const Scene1Question: React.FC = () => {
  const frame = useCurrentFrame();

  // Key sync at frame 87 - folder icon glows
  const glowActive = frame >= 80; // Glow starts slightly before sync

  return (
    <AbsoluteFill>
      <QuestionMark key="question" />
      <FolderIcon key="folder" glowActive={glowActive} />
      <ServerIcon key="server" />
      <VSDivider key="vs" />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: SKILLS INTRODUCTION (Frames 88-268)
// ============================================

// 3D-style folder with CSS transforms
const SkillsFolder3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 62 (relative) = frame 150 absolute
  const keySyncRelative = 62; // 150 - 88

  // Folder moves to center and scales up
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });
  const scale = interpolate(enterProgress, [0, 1], [0.5, 1.2], { extrapolateRight: 'clamp' });

  // Hover/float animation
  const floatY = Math.sin(frame * 0.05) * 15;

  // 3D transformation at key sync (frame 150 = relative frame 62)
  const is3DActive = frame >= keySyncRelative - 5;
  const rotateProgress = spring({ frame: frame - keySyncRelative + 5, fps, config: { ...SPRING_CONFIG, damping: 25 } });
  const rotateX = is3DActive ? interpolate(rotateProgress, [0, 1], [0, 15], { extrapolateRight: 'clamp' }) : 0;
  const rotateY = is3DActive ? interpolate(rotateProgress, [0, 1], [0, -10], { extrapolateRight: 'clamp' }) : 0;

  // Glow intensifies at sync point
  const glowSize = is3DActive ? interpolate(rotateProgress, [0, 1], [15, 40], { extrapolateRight: 'clamp' }) : 15;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '45%',
        transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${scale}) perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        opacity: enterProgress,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Folder shadow */}
      <div
        style={{
          position: 'absolute',
          width: 280,
          height: 50,
          background: `radial-gradient(ellipse, rgba(0, 245, 212, 0.3) 0%, transparent 70%)`,
          bottom: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          filter: 'blur(15px)',
        }}
      />

      {/* Main folder SVG */}
      <svg width="280" height="220" viewBox="0 0 280 220">
        {/* Folder back */}
        <rect
          x="20"
          y="50"
          width="240"
          height="150"
          rx="12"
          fill={COLORS.darkGray}
          stroke={COLORS.primary}
          strokeWidth="3"
          style={{ filter: `drop-shadow(0 0 ${glowSize}px ${COLORS.primary})` }}
        />

        {/* Folder tab */}
        <path
          d="M 20 50 L 20 35 Q 20 20 35 20 L 100 20 L 120 50"
          fill={COLORS.darkGray}
          stroke={COLORS.primary}
          strokeWidth="3"
        />

        {/* Inner glow */}
        <rect
          x="30"
          y="60"
          width="220"
          height="130"
          rx="8"
          fill={COLORS.primary}
          opacity={is3DActive ? 0.15 : 0.05}
        />

        {/* Decorative lines suggesting content */}
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x="50"
            y={90 + i * 35}
            width={160 - i * 30}
            height="8"
            rx="4"
            fill={COLORS.primary}
            opacity={0.3 + (is3DActive ? 0.2 : 0)}
          />
        ))}
      </svg>

      {/* SKILL label */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 30,
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.primary,
          letterSpacing: 8,
          textShadow: `0 0 ${glowSize}px ${COLORS.primary}`,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        SKILL
      </div>
    </div>
  );
};

// Particle effects around the folder
const SkillsParticles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <>
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 200 + Math.sin((frame + i * 10) * 0.03) * 30;
        const x = 540 + Math.cos(angle + frame * 0.01) * radius;
        const y = 850 + Math.sin(angle + frame * 0.01) * radius * 0.6;
        const size = 4 + Math.sin((frame + i * 20) * 0.05) * 2;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: COLORS.primary,
              opacity: 0.4 + Math.sin((frame + i * 15) * 0.04) * 0.2,
              boxShadow: `0 0 10px ${COLORS.primary}`,
            }}
          />
        );
      })}
    </>
  );
};

// Scene 2 Component
const Scene2SkillsIntro: React.FC = () => {
  return (
    <AbsoluteFill>
      <SkillsParticles key="particles" />
      <SkillsFolder3D key="folder3d" />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: SKILLS ARCHITECTURE (Frames 269-606)
// ============================================

// Front Matter Section (always glowing)
const FrontMatterSection: React.FC<{ enterProgress: number }> = ({ enterProgress }) => {
  return (
    <div
      style={{
        ...glassStyle,
        width: 400,
        padding: 24,
        opacity: enterProgress,
        transform: `translateY(${interpolate(enterProgress, [0, 1], [-30, 0], { extrapolateRight: 'clamp' })}px)`,
        borderColor: COLORS.primary,
        boxShadow: `0 0 30px rgba(0, 245, 212, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3)`,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: COLORS.primary,
          letterSpacing: 3,
          marginBottom: 16,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        FRONT MATTER
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS.primary,
              boxShadow: `0 0 10px ${COLORS.primary}`,
            }}
          />
          <span style={{ color: COLORS.white, fontSize: 18, fontFamily: 'system-ui, sans-serif' }}>name</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS.primary,
              boxShadow: `0 0 10px ${COLORS.primary}`,
            }}
          />
          <span style={{ color: COLORS.white, fontSize: 18, fontFamily: 'system-ui, sans-serif' }}>description</span>
        </div>
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 14,
          color: 'rgba(255,255,255,0.5)',
          fontStyle: 'italic',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Lightweight metadata - always loaded
      </div>
    </div>
  );
};

// Body Section (illuminates at sync point)
const BodySection: React.FC<{ enterProgress: number; isIlluminated: boolean; illuminateProgress: number }> = ({
  enterProgress,
  isIlluminated,
  illuminateProgress,
}) => {
  const glowIntensity = isIlluminated ? interpolate(illuminateProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  return (
    <div
      style={{
        ...glassStyle,
        width: 400,
        padding: 24,
        marginTop: 20,
        opacity: enterProgress,
        transform: `translateY(${interpolate(enterProgress, [0, 1], [30, 0], { extrapolateRight: 'clamp' })}px)`,
        borderColor: isIlluminated ? COLORS.primary : 'rgba(0, 245, 212, 0.3)',
        boxShadow: isIlluminated
          ? `0 0 ${30 + glowIntensity * 30}px rgba(0, 245, 212, ${0.3 + glowIntensity * 0.4}), 0 8px 32px rgba(0, 0, 0, 0.3)`
          : '0 8px 32px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.3s ease',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: isIlluminated ? COLORS.primary : 'rgba(0, 245, 212, 0.4)',
          letterSpacing: 3,
          marginBottom: 16,
          fontFamily: 'system-ui, sans-serif',
          transition: 'color 0.3s ease',
        }}
      >
        BODY
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {['instructions', 'scripts', 'resources', 'examples'].map((item, i) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isIlluminated ? COLORS.primary : 'rgba(0, 245, 212, 0.3)',
                boxShadow: isIlluminated ? `0 0 10px ${COLORS.primary}` : 'none',
                transition: 'all 0.3s ease',
                transitionDelay: `${i * 0.1}s`,
              }}
            />
            <span
              style={{
                color: isIlluminated ? COLORS.white : 'rgba(255,255,255,0.4)',
                fontSize: 18,
                fontFamily: 'system-ui, sans-serif',
                transition: 'color 0.3s ease',
                transitionDelay: `${i * 0.1}s`,
              }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 14,
          color: isIlluminated ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
          fontStyle: 'italic',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {isIlluminated ? 'Detailed content - loaded on demand' : 'Waiting to be invoked...'}
      </div>
    </div>
  );
};

// Data flow particles between sections
const DataFlowParticles: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const frame = useCurrentFrame();

  if (!isActive) return null;

  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => {
        const progress = ((frame * 3 + i * 30) % 150) / 150;
        const x = 540 + Math.sin(progress * Math.PI * 2 + i) * 30;
        const y = interpolate(progress, [0, 1], [700, 1000], { extrapolateRight: 'clamp' });
        const opacity = Math.sin(progress * Math.PI);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: COLORS.primary,
              opacity: opacity * 0.8,
              boxShadow: `0 0 15px ${COLORS.primary}`,
            }}
          />
        );
      })}
    </>
  );
};

// Scene 3 Component
const Scene3Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 457 absolute = 188 relative (457 - 269)
  const keySyncRelative = 188;

  // Enter animation
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  // Body illumination at sync point
  const isIlluminated = frame >= keySyncRelative - 10;
  const illuminateProgress = spring({
    frame: frame - keySyncRelative + 10,
    fps,
    config: { ...SPRING_CONFIG, damping: 25 },
  });

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textShadow: `0 0 20px ${COLORS.primary}`,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        SKILL ARCHITECTURE
      </div>

      {/* Sections container */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <FrontMatterSection enterProgress={enterProgress} />
        <BodySection
          enterProgress={enterProgress}
          isIlluminated={isIlluminated}
          illuminateProgress={illuminateProgress}
        />
      </div>

      {/* Data flow particles */}
      <DataFlowParticles isActive={isIlluminated} />

      {/* Connection arrow */}
      <svg
        width="100"
        height="60"
        style={{
          position: 'absolute',
          left: '50%',
          top: '58%',
          transform: 'translateX(-50%)',
          opacity: enterProgress * 0.6,
        }}
      >
        <path
          d="M 50 0 L 50 40 L 35 25 M 50 40 L 65 25"
          stroke={COLORS.primary}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${COLORS.primary})` }}
        />
      </svg>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: LAZY LOADING MAGIC (Frames 607-763)
// ============================================

// Active front matter with data streams
const ActiveFrontMatter: React.FC<{ pulseActive: boolean; pulseProgress: number }> = ({ pulseActive, pulseProgress }) => {
  const frame = useCurrentFrame();

  const pulseScale = pulseActive ? 1 + pulseProgress * 0.05 : 1;
  const pulseGlow = pulseActive ? 30 + pulseProgress * 40 : 30;

  return (
    <div
      style={{
        ...glassStyle,
        width: 380,
        padding: 24,
        borderColor: COLORS.primary,
        boxShadow: `0 0 ${pulseGlow}px rgba(0, 245, 212, 0.5), 0 8px 32px rgba(0, 0, 0, 0.3)`,
        transform: `scale(${pulseScale})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: COLORS.primary,
            boxShadow: `0 0 ${pulseActive ? 20 : 10}px ${COLORS.primary}`,
            animation: 'none',
          }}
        />
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: COLORS.primary,
            letterSpacing: 3,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          FRONT MATTER
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 14,
            color: COLORS.primary,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          LOADED
        </span>
      </div>

      {/* Streaming data visualization */}
      <div style={{ position: 'relative', height: 60, overflow: 'hidden' }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const lineProgress = ((frame * 2 + i * 40) % 200) / 200;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: i * 12,
                width: `${lineProgress * 100}%`,
                height: 6,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${COLORS.primary} 0%, transparent 100%)`,
                opacity: 0.6,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// Dormant body section
const DormantBody: React.FC = () => {
  return (
    <div
      style={{
        ...glassStyle,
        width: 380,
        padding: 24,
        marginTop: 20,
        borderColor: 'rgba(0, 245, 212, 0.2)',
        opacity: 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'rgba(0, 245, 212, 0.2)',
            border: `2px dashed rgba(0, 245, 212, 0.3)`,
          }}
        />
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'rgba(0, 245, 212, 0.4)',
            letterSpacing: 3,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          BODY
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 14,
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          DORMANT
        </span>
      </div>

      {/* Placeholder content */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: `${70 - i * 15}%`,
            height: 8,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.1)',
            marginBottom: 10,
          }}
        />
      ))}

      <div
        style={{
          marginTop: 12,
          fontSize: 14,
          color: 'rgba(255,255,255,0.3)',
          fontStyle: 'italic',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Waiting for invocation...
      </div>
    </div>
  );
};

// Resource usage indicator
const ResourceMeter: React.FC<{ usage: number }> = ({ usage }) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 250,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 300,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 16,
          color: COLORS.white,
          marginBottom: 12,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        CONTEXT USAGE
      </div>
      <div
        style={{
          width: '100%',
          height: 12,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${usage}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${COLORS.primary} 0%, rgba(0, 245, 212, 0.6) 100%)`,
            borderRadius: 6,
            boxShadow: `0 0 10px ${COLORS.primary}`,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.primary,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {Math.round(usage)}%
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          marginTop: 4,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Minimal footprint
      </div>
    </div>
  );
};

// Efficient data streams flowing to front matter only
const EfficientDataStreams: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => {
        const delay = i * 15;
        const progress = ((frame + delay) % 90) / 90;
        const startY = 200;
        const endY = 620;
        const y = interpolate(progress, [0, 1], [startY, endY], { extrapolateRight: 'clamp' });
        const x = 540 + Math.sin(i * 0.8) * 150;
        const opacity = Math.sin(progress * Math.PI) * 0.8;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS.primary,
              opacity,
              boxShadow: `0 0 12px ${COLORS.primary}`,
            }}
          />
        );
      })}
    </>
  );
};

// Scene 4 Component
const Scene4LazyLoading: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 657 absolute = 50 relative (657 - 607)
  const keySyncRelative = 50;

  // Enter animation
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  // Pulse at sync point
  const pulseActive = frame >= keySyncRelative - 5;
  const pulseProgress = spring({
    frame: frame - keySyncRelative + 5,
    fps,
    config: { ...SPRING_CONFIG, damping: 15, stiffness: 120 },
  });

  // Resource usage (stays low)
  const resourceUsage = interpolate(frame, [0, 60], [5, 18], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textShadow: `0 0 20px ${COLORS.primary}`,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        LAZY LOADING
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 20,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: 2,
          opacity: enterProgress,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Only load what you need
      </div>

      {/* Data streams */}
      <EfficientDataStreams />

      {/* Sections container */}
      <div
        style={{
          position: 'absolute',
          top: '32%',
          left: '50%',
          transform: `translateX(-50%) scale(${enterProgress})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: enterProgress,
        }}
      >
        <ActiveFrontMatter pulseActive={pulseActive} pulseProgress={pulseProgress} />
        <DormantBody />
      </div>

      {/* Resource meter */}
      <ResourceMeter usage={resourceUsage} />
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 5: MCP SERVER INTRODUCTION (Frames 764-1028)
// ============================================

// MCP Tool Panel
const MCPPanel: React.FC<{ title: string; items: string[]; isActive: boolean; delay: number }> = ({
  title,
  items,
  isActive,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activeProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  const glowIntensity = isActive ? activeProgress : 0.3;

  return (
    <div
      style={{
        ...glassStyle,
        width: 200,
        padding: 16,
        borderColor: isActive ? COLORS.secondary : 'rgba(123, 44, 191, 0.3)',
        boxShadow: isActive
          ? `0 0 ${20 + activeProgress * 20}px rgba(123, 44, 191, ${0.3 + activeProgress * 0.4}), 0 8px 32px rgba(0, 0, 0, 0.3)`
          : '0 8px 32px rgba(0, 0, 0, 0.3)',
        transform: `scale(${0.8 + activeProgress * 0.2})`,
        opacity: 0.4 + glowIntensity * 0.6,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: COLORS.secondary,
          letterSpacing: 2,
          marginBottom: 12,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {title}
      </div>
      {items.map((item, i) => (
        <div
          key={item}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isActive ? COLORS.secondary : 'rgba(123, 44, 191, 0.4)',
              boxShadow: isActive ? `0 0 8px ${COLORS.secondary}` : 'none',
            }}
          />
          <span
            style={{
              fontSize: 13,
              color: isActive ? COLORS.white : 'rgba(255,255,255,0.5)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
};

// MCP Data Streams (converging from all directions)
const MCPDataStreams: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  if (!isActive) return null;

  const streams = [
    { startX: 0, startY: height * 0.3, endX: width / 2, endY: height * 0.5 },
    { startX: width, startY: height * 0.3, endX: width / 2, endY: height * 0.5 },
    { startX: 0, startY: height * 0.7, endX: width / 2, endY: height * 0.5 },
    { startX: width, startY: height * 0.7, endX: width / 2, endY: height * 0.5 },
    { startX: width / 2, startY: 0, endX: width / 2, endY: height * 0.5 },
    { startX: width / 2, startY: height, endX: width / 2, endY: height * 0.5 },
  ];

  return (
    <>
      {streams.flatMap((stream, si) =>
        Array.from({ length: 5 }).map((_, i) => {
          const delay = si * 10 + i * 15;
          const progress = ((frame + delay) % 60) / 60;
          const x = interpolate(progress, [0, 1], [stream.startX, stream.endX], { extrapolateRight: 'clamp' });
          const y = interpolate(progress, [0, 1], [stream.startY, stream.endY], { extrapolateRight: 'clamp' });
          const opacity = Math.sin(progress * Math.PI) * 0.7;

          return (
            <div
              key={`${si}-${i}`}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: COLORS.secondary,
                opacity,
                boxShadow: `0 0 15px ${COLORS.secondary}`,
              }}
            />
          );
        })
      )}
    </>
  );
};

// Scene 5 Component
const Scene5MCPIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 845 absolute = 81 relative (845 - 764)
  const keySyncRelative = 81;

  // Enter animation
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  // All panels activate at sync point
  const isActive = frame >= keySyncRelative - 10;

  const panels = [
    { title: 'TOOLS', items: ['create', 'delete', 'update', 'query'], delay: keySyncRelative },
    { title: 'APIS', items: ['REST', 'GraphQL', 'WebSocket'], delay: keySyncRelative + 3 },
    { title: 'RESOURCES', items: ['files', 'database', 'cache'], delay: keySyncRelative + 6 },
    { title: 'SERVICES', items: ['auth', 'storage', 'compute'], delay: keySyncRelative + 9 },
  ];

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 36,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textShadow: `0 0 20px ${COLORS.secondary}`,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        MCP SERVER
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 20,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: 2,
          opacity: enterProgress,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Everything loaded upfront
      </div>

      {/* Data streams */}
      <MCPDataStreams isActive={isActive} />

      {/* Dashboard container */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: `translateX(-50%) scale(${enterProgress})`,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 20,
          opacity: enterProgress,
        }}
      >
        {panels.map((panel) => (
          <MCPPanel key={panel.title} {...panel} isActive={isActive} />
        ))}
      </div>

      {/* Server status indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 280,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: enterProgress,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: isActive ? COLORS.secondary : 'rgba(123, 44, 191, 0.4)',
            boxShadow: isActive ? `0 0 20px ${COLORS.secondary}` : 'none',
          }}
        />
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.secondary,
            letterSpacing: 2,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {isActive ? 'ALL SYSTEMS ACTIVE' : 'INITIALIZING...'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 6: CONTEXT PERFORMANCE TRADE-OFF (Frames 1029-1373)
// ============================================

// Context Meter Component
const ContextMeter: React.FC<{
  label: string;
  usage: number;
  maxUsage: number;
  color: string;
  isWarning?: boolean;
  warningFlash?: boolean;
}> = ({ label, usage, maxUsage, color, isWarning = false, warningFlash = false }) => {
  const meterHeight = 400;
  const fillHeight = (usage / 100) * meterHeight;

  return (
    <div style={{ textAlign: 'center', width: 120 }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: COLORS.white,
          marginBottom: 16,
          letterSpacing: 2,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {label}
      </div>

      {/* Meter container */}
      <div
        style={{
          width: 60,
          height: meterHeight,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 30,
          margin: '0 auto',
          position: 'relative',
          overflow: 'hidden',
          border: `2px solid ${isWarning ? COLORS.accent : color}`,
          boxShadow: warningFlash
            ? `0 0 40px ${COLORS.accent}, 0 0 80px ${COLORS.accent}`
            : `0 0 15px ${color}`,
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: fillHeight,
            background: isWarning
              ? `linear-gradient(180deg, ${COLORS.accent} 0%, ${color} 100%)`
              : `linear-gradient(180deg, ${color} 0%, rgba(${color === COLORS.primary ? '0, 245, 212' : '123, 44, 191'}, 0.5) 100%)`,
            borderRadius: '0 0 28px 28px',
            boxShadow: `0 0 20px ${isWarning ? COLORS.accent : color}`,
          }}
        />

        {/* Warning zone indicator */}
        {usage > 70 && (
          <div
            style={{
              position: 'absolute',
              top: meterHeight * 0.2,
              left: 0,
              right: 0,
              height: 2,
              background: COLORS.accent,
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Usage percentage */}
      <div
        style={{
          marginTop: 16,
          fontSize: 32,
          fontWeight: 800,
          color: isWarning ? COLORS.accent : color,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {Math.round(usage)}%
      </div>

      {/* Status label */}
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: isWarning ? COLORS.accent : 'rgba(255,255,255,0.6)',
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {isWarning ? 'HIGH USAGE' : usage < 30 ? 'EFFICIENT' : 'MODERATE'}
      </div>
    </div>
  );
};

// Mini Skills representation
const SkillsIcon: React.FC = () => {
  return (
    <svg width="80" height="70" viewBox="0 0 80 70">
      <rect
        x="5"
        y="20"
        width="70"
        height="45"
        rx="6"
        fill={COLORS.darkGray}
        stroke={COLORS.primary}
        strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 10px ${COLORS.primary})` }}
      />
      <path d="M 5 20 L 5 12 Q 5 5 12 5 L 35 5 L 42 20" fill={COLORS.darkGray} stroke={COLORS.primary} strokeWidth="2" />
    </svg>
  );
};

// Mini MCP representation
const MCPIcon: React.FC = () => {
  return (
    <svg width="70" height="80" viewBox="0 0 70 80">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x="5"
            y={5 + i * 25}
            width="60"
            height="20"
            rx="4"
            fill={COLORS.darkGray}
            stroke={COLORS.secondary}
            strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 8px ${COLORS.secondary})` }}
          />
          <circle cx="18" cy={15 + i * 25} r="4" fill={COLORS.secondary} opacity={0.8} />
        </g>
      ))}
    </svg>
  );
};

// Scene 6 Component
const Scene6Performance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 1114 absolute = 85 relative (1114 - 1029)
  const keySyncRelative = 85;

  // Enter animation
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  // Skills usage stays low
  const skillsUsage = interpolate(frame, [0, 100], [5, 15], { extrapolateRight: 'clamp' });

  // MCP usage rises then spikes at sync
  const mcpBaseUsage = interpolate(frame, [0, 60], [30, 55], { extrapolateRight: 'clamp' });
  const isSpiking = frame >= keySyncRelative - 5;
  const spikeProgress = spring({
    frame: frame - keySyncRelative + 5,
    fps,
    config: { ...SPRING_CONFIG, damping: 15, stiffness: 150 },
  });
  const mcpUsage = isSpiking ? mcpBaseUsage + spikeProgress * 30 : mcpBaseUsage;

  const isWarning = mcpUsage > 70;
  const warningFlash = isSpiking && spikeProgress > 0.5 && spikeProgress < 0.8;

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        CONTEXT USAGE
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 18,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: 2,
          opacity: enterProgress,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Performance trade-offs
      </div>

      {/* Comparison container */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: `translateX(-50%) scale(${enterProgress})`,
          display: 'flex',
          gap: 120,
          alignItems: 'flex-start',
          opacity: enterProgress,
        }}
      >
        {/* Skills side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <SkillsIcon />
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.primary,
              letterSpacing: 3,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            SKILLS
          </div>
          <ContextMeter label="CONTEXT" usage={skillsUsage} maxUsage={100} color={COLORS.primary} />
        </div>

        {/* VS divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 500,
            fontSize: 36,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.3)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          VS
        </div>

        {/* MCP side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <MCPIcon />
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.secondary,
              letterSpacing: 3,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            MCP
          </div>
          <ContextMeter
            label="CONTEXT"
            usage={mcpUsage}
            maxUsage={100}
            color={COLORS.secondary}
            isWarning={isWarning}
            warningFlash={warningFlash}
          />
        </div>
      </div>

      {/* Warning flash overlay */}
      {warningFlash && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 70% 50%, rgba(247, 37, 133, 0.2) 0%, transparent 50%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 7: CAPABILITY COMPARISON (Frames 1374-1928)
// ============================================

// MCP API Action Button
const APIActionButton: React.FC<{ label: string; delay: number }> = ({ label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG });

  return (
    <div
      style={{
        ...glassStyle,
        padding: '12px 20px',
        borderColor: COLORS.secondary,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transform: `scale(${enterProgress})`,
        opacity: enterProgress,
        boxShadow: `0 0 15px rgba(123, 44, 191, 0.4)`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: COLORS.secondary,
          boxShadow: `0 0 8px ${COLORS.secondary}`,
        }}
      />
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: 1,
          fontFamily: 'monospace',
        }}
      >
        {label}
      </span>
    </div>
  );
};

// Skills Template Section
const TemplateSection: React.FC<{ title: string; items: string[]; isHighlighted: boolean }> = ({
  title,
  items,
  isHighlighted,
}) => {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        background: isHighlighted ? 'rgba(0, 245, 212, 0.1)' : 'transparent',
        borderRadius: 8,
        borderLeft: `3px solid ${isHighlighted ? COLORS.primary : 'rgba(0, 245, 212, 0.3)'}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: COLORS.primary,
          letterSpacing: 2,
          marginBottom: 8,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {title}
      </div>
      {items.map((item, i) => (
        <div
          key={item}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isHighlighted ? COLORS.primary : 'rgba(0, 245, 212, 0.5)'}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
          <span
            style={{
              fontSize: 13,
              color: isHighlighted ? COLORS.white : 'rgba(255,255,255,0.6)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
};

// Scene 7 Component
const Scene7Capability: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 1712 absolute = 338 relative (1712 - 1374)
  const keySyncRelative = 338;

  // Enter animation
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  // Skills highlight at sync point
  const isSkillsHighlighted = frame >= keySyncRelative - 10;
  const highlightProgress = spring({
    frame: frame - keySyncRelative + 10,
    fps,
    config: { ...SPRING_CONFIG, damping: 20 },
  });

  const apiActions = ['CREATE_FILE()', 'DELETE_FILE()', 'UPDATE_FILE()', 'READ_FILE()', 'LIST_FILES()'];

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 28,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        GOOGLE DRIVE USE CASE
      </div>

      {/* Comparison container */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: `translateX(-50%)`,
          display: 'flex',
          gap: 40,
          opacity: enterProgress,
        }}
      >
        {/* MCP Side */}
        <div
          style={{
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: COLORS.secondary,
              letterSpacing: 3,
              marginBottom: 20,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            MCP
          </div>

          <div
            style={{
              ...glassStyle,
              width: '100%',
              padding: 20,
              borderColor: 'rgba(123, 44, 191, 0.5)',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.secondary,
                letterSpacing: 2,
                marginBottom: 16,
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              RAW API TOOLS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {apiActions.map((action, i) => (
                <APIActionButton key={action} label={action} delay={i * 8} />
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
                fontStyle: 'italic',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Direct API access
            </div>
          </div>
        </div>

        {/* VS Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 24,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.3)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          VS
        </div>

        {/* Skills Side */}
        <div
          style={{
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: COLORS.primary,
              letterSpacing: 3,
              marginBottom: 20,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            SKILLS
          </div>

          <div
            style={{
              ...glassStyle,
              width: '100%',
              padding: 20,
              borderColor: isSkillsHighlighted ? COLORS.primary : 'rgba(0, 245, 212, 0.3)',
              boxShadow: isSkillsHighlighted
                ? `0 0 ${20 + highlightProgress * 30}px rgba(0, 245, 212, ${0.3 + highlightProgress * 0.4}), 0 8px 32px rgba(0, 0, 0, 0.3)`
                : '0 8px 32px rgba(0, 0, 0, 0.3)',
              transform: isSkillsHighlighted ? `scale(${1 + highlightProgress * 0.02})` : 'scale(1)',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.primary,
                letterSpacing: 2,
                marginBottom: 16,
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              BEHAVIOR GUIDANCE
            </div>

            <TemplateSection
              title="NAMING CONVENTION"
              items={['Use descriptive names', 'Include date prefix']}
              isHighlighted={isSkillsHighlighted}
            />

            <TemplateSection
              title="ORGANIZATION"
              items={['Create project folders', 'Archive old files']}
              isHighlighted={isSkillsHighlighted}
            />

            <TemplateSection
              title="BEST PRACTICES"
              items={['Version control', 'Backup strategy']}
              isHighlighted={isSkillsHighlighted}
            />

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: isSkillsHighlighted ? COLORS.primary : 'rgba(255,255,255,0.5)',
                textAlign: 'center',
                fontStyle: 'italic',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Structured guidance
            </div>
          </div>
        </div>
      </div>

      {/* Highlight glow effect */}
      {isSkillsHighlighted && (
        <div
          style={{
            position: 'absolute',
            right: '15%',
            top: '40%',
            width: 350,
            height: 500,
            background: `radial-gradient(ellipse, rgba(0, 245, 212, ${highlightProgress * 0.15}) 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 8: FINAL WISDOM (Frames 1929-2208)
// ============================================

// Flowing tool icons for MCP
const FlowingToolIcons: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const frame = useCurrentFrame();

  const tools = ['API', 'DB', 'FS', 'NET', 'AUTH', 'CACHE'];

  return (
    <>
      {tools.map((tool, i) => {
        const delay = i * 20;
        const progress = ((frame + delay) % 120) / 120;
        const x = 200 + Math.sin(progress * Math.PI * 2 + i) * 80;
        const y = interpolate(progress, [0, 1], [100, 400], { extrapolateRight: 'clamp' });
        const opacity = isActive ? Math.sin(progress * Math.PI) * 0.8 : 0.3;
        const scale = 0.8 + Math.sin(progress * Math.PI) * 0.3;

        return (
          <div
            key={tool}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `scale(${scale})`,
              padding: '6px 12px',
              background: 'rgba(123, 44, 191, 0.3)',
              border: `1px solid ${COLORS.secondary}`,
              borderRadius: 6,
              opacity,
              boxShadow: `0 0 10px ${COLORS.secondary}`,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.secondary,
                fontFamily: 'monospace',
              }}
            >
              {tool}
            </span>
          </div>
        );
      })}
    </>
  );
};

// Workflow arrows for Skills
const WorkflowArrows: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const arrows = [
    { from: { x: 50, y: 100 }, to: { x: 50, y: 180 } },
    { from: { x: 50, y: 220 }, to: { x: 50, y: 300 } },
    { from: { x: 50, y: 340 }, to: { x: 50, y: 420 } },
  ];

  return (
    <svg width="100" height="500" style={{ position: 'absolute', left: 130, top: 100 }}>
      {arrows.map((arrow, i) => {
        const delay = i * 15;
        const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG });
        const dashOffset = interpolate(progress, [0, 1], [100, 0], { extrapolateRight: 'clamp' });

        return (
          <g key={i}>
            <line
              x1={arrow.from.x}
              y1={arrow.from.y}
              x2={arrow.to.x}
              y2={arrow.to.y}
              stroke={COLORS.primary}
              strokeWidth="3"
              strokeDasharray="100"
              strokeDashoffset={dashOffset}
              style={{ filter: `drop-shadow(0 0 5px ${COLORS.primary})` }}
            />
            <polygon
              points={`${arrow.to.x - 8},${arrow.to.y - 10} ${arrow.to.x + 8},${arrow.to.y - 10} ${arrow.to.x},${arrow.to.y}`}
              fill={COLORS.primary}
              opacity={progress}
              style={{ filter: `drop-shadow(0 0 5px ${COLORS.primary})` }}
            />
          </g>
        );
      })}
    </svg>
  );
};

// Final comparison card
const FinalCard: React.FC<{
  title: string;
  subtitle: string;
  color: string;
  items: string[];
  isHighlighted: boolean;
}> = ({ title, subtitle, color, items, isHighlighted }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  return (
    <div
      style={{
        ...glassStyle,
        width: 300,
        padding: 24,
        borderColor: color,
        transform: `scale(${enterProgress})`,
        opacity: enterProgress,
        boxShadow: isHighlighted
          ? `0 0 40px ${color}, 0 8px 32px rgba(0, 0, 0, 0.3)`
          : `0 0 15px ${color}40, 0 8px 32px rgba(0, 0, 0, 0.3)`,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color,
          letterSpacing: 3,
          marginBottom: 8,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 20,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {subtitle}
      </div>

      {items.map((item, i) => (
        <div
          key={item}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            padding: '8px 12px',
            background: `${color}15`,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          <span
            style={{
              fontSize: 14,
              color: COLORS.white,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
};

// Scene 8 Component
const Scene8FinalWisdom: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Key sync at frame 1947 absolute = 18 relative (1947 - 1929)
  const keySyncRelative = 18;

  // Enter animation
  const enterProgress = spring({ frame, fps, config: SPRING_CONFIG });

  // Tool flow activation at sync
  const isToolFlowActive = frame >= keySyncRelative;

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.white,
          letterSpacing: 4,
          opacity: enterProgress,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        THE TAKEAWAY
      </div>

      {/* Comparison container */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 60,
          opacity: enterProgress,
        }}
      >
        {/* MCP Side */}
        <div style={{ position: 'relative' }}>
          <FinalCard
            title="MCP"
            subtitle="RAW TOOLS & CAPABILITIES"
            color={COLORS.secondary}
            items={['Direct API access', 'Full tool capabilities', 'Immediate availability', 'Higher context cost']}
            isHighlighted={isToolFlowActive}
          />
          <FlowingToolIcons isActive={isToolFlowActive} />
        </div>

        {/* Skills Side */}
        <div style={{ position: 'relative' }}>
          <FinalCard
            title="SKILLS"
            subtitle="BEHAVIOR & GUIDANCE"
            color={COLORS.primary}
            items={['Structured workflows', 'Best practices built-in', 'Lazy loaded efficiency', 'Lower context cost']}
            isHighlighted={!isToolFlowActive}
          />
          <WorkflowArrows />
        </div>
      </div>

      {/* Bottom summary */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          opacity: enterProgress,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.white,
            marginBottom: 12,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Choose based on your needs
        </div>
        <div
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <span style={{ color: COLORS.secondary }}>MCP</span> for raw power &bull;{' '}
          <span style={{ color: COLORS.primary }}>Skills</span> for guided efficiency
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================
const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AnimatedBackground key="bg" />

      {/* Scene 1: The Question (Frames 0-87) */}
      <Sequence key="scene1" from={TIMING.scene1Start} durationInFrames={TIMING.scene1End - TIMING.scene1Start + 1}>
        <Scene1Question />
      </Sequence>

      {/* Scene 2: Skills Introduction (Frames 88-268) */}
      <Sequence key="scene2" from={TIMING.scene2Start} durationInFrames={TIMING.scene2End - TIMING.scene2Start + 1}>
        <Scene2SkillsIntro />
      </Sequence>

      {/* Scene 3: Skills Architecture (Frames 269-606) */}
      <Sequence key="scene3" from={TIMING.scene3Start} durationInFrames={TIMING.scene3End - TIMING.scene3Start + 1}>
        <Scene3Architecture />
      </Sequence>

      {/* Scene 4: Lazy Loading Magic (Frames 607-763) */}
      <Sequence key="scene4" from={TIMING.scene4Start} durationInFrames={TIMING.scene4End - TIMING.scene4Start + 1}>
        <Scene4LazyLoading />
      </Sequence>

      {/* Scene 5: MCP Server Introduction (Frames 764-1028) */}
      <Sequence key="scene5" from={TIMING.scene5Start} durationInFrames={TIMING.scene5End - TIMING.scene5Start + 1}>
        <Scene5MCPIntro />
      </Sequence>

      {/* Scene 6: Context Performance Trade-off (Frames 1029-1373) */}
      <Sequence key="scene6" from={TIMING.scene6Start} durationInFrames={TIMING.scene6End - TIMING.scene6Start + 1}>
        <Scene6Performance />
      </Sequence>

      {/* Scene 7: Capability Comparison (Frames 1374-1928) */}
      <Sequence key="scene7" from={TIMING.scene7Start} durationInFrames={TIMING.scene7End - TIMING.scene7Start + 1}>
        <Scene7Capability />
      </Sequence>

      {/* Scene 8: Final Wisdom (Frames 1929-2208) */}
      <Sequence key="scene8" from={TIMING.scene8Start} durationInFrames={TIMING.scene8End - TIMING.scene8Start + 1}>
        <Scene8FinalWisdom />
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================
// REMOTION EXPORTS
// ============================================
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="proj-c6e0a8e1-de72-4f2f-883a-5213e23dfa8a"
      component={MainComposition}
      durationInFrames={TIMING.totalDuration}
      fps={TIMING.fps}
      width={1080}
      height={1920}
    />
  );
};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
export default MainComposition;

// Register the root component for Remotion bundler
registerRoot(RemotionRoot);
