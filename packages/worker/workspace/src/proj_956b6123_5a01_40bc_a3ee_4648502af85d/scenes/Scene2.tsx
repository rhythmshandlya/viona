import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_CONFIG, TYPOGRAPHY, glassStyle } from '../constants';
import { FolderIcon } from '../components/Icons';

interface Scene2Props {
  startFrame?: number;
}

// Modular toolbox drawer component
const ToolboxDrawer: React.FC<{
  index: number;
  openFrame: number;
  label: string;
}> = ({ index, openFrame, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = index * 8;
  const openProgress = spring({
    frame: frame - openFrame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  const slideOut = interpolate(openProgress, [0, 1], [0, 30], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 50,
        marginBottom: 8,
      }}
    >
      {/* Drawer body */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${COLORS.primary}20, ${COLORS.primary}10)`,
          border: `1px solid ${COLORS.primary}40`,
          borderRadius: 8,
          transform: `translateX(${slideOut}px)`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          boxShadow: openProgress > 0.5 ? `0 4px 12px ${COLORS.primary}20` : 'none',
        }}
      >
        {/* Drawer handle */}
        <div
          style={{
            width: 40,
            height: 6,
            background: COLORS.primary,
            borderRadius: 3,
            opacity: 0.6,
          }}
        />
        {/* Label */}
        <span
          style={{
            marginLeft: 16,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 20,
            color: COLORS.white,
            opacity: interpolate(openProgress, [0.5, 1], [0, 0.8], {
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

// Smart modular toolbox
const SkillsToolbox: React.FC<{
  transformProgress: number;
  openFrame: number;
}> = ({ transformProgress, openFrame }) => {
  const frame = useCurrentFrame();

  const glowIntensity = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [0.4, 0.7],
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: '7.5%',
        top: '25%',
        width: '40%',
        height: '50%',
        opacity: transformProgress,
        transform: `scale(${0.9 + transformProgress * 0.1})`,
      }}
    >
      {/* Toolbox container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          ...glassStyle,
          borderRadius: 20,
          border: `2px solid ${COLORS.primary}50`,
          boxShadow: `
            0 0 ${30 * glowIntensity}px ${COLORS.primary}30,
            0 0 ${60 * glowIntensity}px ${COLORS.primary}15
          `,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Folder icon header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: `1px solid ${COLORS.primary}30`,
          }}
        >
          <FolderIcon size={40} color={COLORS.primary} />
          <span
            style={{
              marginLeft: 12,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 24,
              fontWeight: 600,
              color: COLORS.white,
            }}
          >
            Instructions
          </span>
        </div>

        {/* Drawers */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <ToolboxDrawer index={0} openFrame={openFrame} label="name" />
          <ToolboxDrawer index={1} openFrame={openFrame} label="description" />
          <ToolboxDrawer index={2} openFrame={openFrame} label="content" />
        </div>
      </div>
    </div>
  );
};

// Right side mystery container (dimmed)
const MysteryMCPContainer: React.FC = () => {
  const frame = useCurrentFrame();

  const glowIntensity = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.2, 0.4],
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: '52.5%',
        top: '30%',
        width: '35%',
        height: '40%',
        opacity: 0.5,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...glassStyle,
          borderRadius: 24,
          border: `2px solid ${COLORS.secondary}30`,
          boxShadow: `0 0 ${30 * glowIntensity}px ${COLORS.secondary}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Simplified hub */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: `3px solid ${COLORS.secondary}50`,
            boxShadow: `0 0 15px ${COLORS.secondary}30`,
          }}
        />
      </div>

      {/* MCP label (dimmed) */}
      <div
        style={{
          position: 'absolute',
          bottom: -50,
          left: 0,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: TYPOGRAPHY.label,
          fontWeight: 600,
          color: COLORS.secondary,
          opacity: 0.4,
        }}
      >
        MCP
      </div>
    </div>
  );
};

export const Scene2: React.FC<Scene2Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Transform progress (container to toolbox)
  const transformProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
  });

  // Key sync at frame 132 (relative to scene start at 65, so frame 67 within scene)
  // But since we're passed startFrame=0 from Sequence, we need to calculate
  // The key sync "skill" is at absolute frame 132, scene starts at 65
  // So within scene it's frame 132 - 65 = 67
  const keySync = 67;

  // Label animation with bounce
  const labelProgress = spring({
    frame: frame - startFrame - keySync,
    fps,
    config: { damping: 15, stiffness: 150, mass: 0.8 },
  });

  // Description text
  const descriptionOpacity = interpolate(
    frame - startFrame,
    [keySync + 20, keySync + 40],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <AbsoluteFill>
      {/* Skills Toolbox */}
      <SkillsToolbox
        transformProgress={transformProgress}
        openFrame={startFrame + keySync}
      />

      {/* Skills Label */}
      <div
        style={{
          position: 'absolute',
          left: '7.5%',
          top: '12%',
          width: '40%',
          textAlign: 'center',
          transform: `scale(${labelProgress})`,
          opacity: labelProgress,
        }}
      >
        <h2
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: TYPOGRAPHY.title * 0.8,
            fontWeight: 700,
            color: COLORS.primary,
            margin: 0,
            textShadow: `0 0 30px ${COLORS.primary}50`,
          }}
        >
          Skills
        </h2>
      </div>

      {/* Mystery MCP (right side, dimmed) */}
      <MysteryMCPContainer />

      {/* Description text */}
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          left: '10%',
          width: '80%',
          textAlign: 'center',
          opacity: descriptionOpacity,
        }}
      >
        <p
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: TYPOGRAPHY.body,
            fontWeight: 400,
            color: `${COLORS.white}cc`,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Just a folder of instructions
        </p>
      </div>
    </AbsoluteFill>
  );
};
