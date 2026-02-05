import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import * as THREE from 'three';
import React, { useMemo } from 'react';

const COLORS = {
  background: '#0f0f23',
  primary: '#3498db',
  secondary: '#f1c40f',
  accent: '#e74c3c',
  success: '#22c55e',
  white: '#ffffff',
  grid: '#2a2a4a'
};

const CarBody = ({ frame, fps, color }: { frame: number, fps: number, color: string }) => {
  const bounce = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <group scale={bounce}>
      {/* Main Chassis */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.5, 0.6, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Cabin */}
      <mesh position={[-0.2, 1.0, 0]}>
        <boxGeometry args={[1.2, 0.5, 1.0]} />
        <meshStandardMaterial color="#333" transparent opacity={0.6} metalness={1} />
      </mesh>
      {/* Wheels */}
      {[[-0.8, 0.2, 0.65], [0.8, 0.2, 0.65], [-0.8, 0.2, -0.65], [0.8, 0.2, -0.65]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 24]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
};

const Spoiler = ({ frame, fps }: { frame: number, fps: number }) => {
  const assemblyProgress = spring({
    frame: frame - 40,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  const posY = interpolate(assemblyProgress, [0, 1], [3, 0.85]);
  const scale = interpolate(assemblyProgress, [0, 1], [0.5, 1]);

  return (
    <mesh position={[-1.1, posY, 0]} scale={scale}>
      <boxGeometry args={[0.3, 0.05, 1.1]} />
      <meshStandardMaterial color={COLORS.accent} />
    </mesh>
  );
};

const GarageFloor = ({ width }: { width: number }) => {
  const gridSize = width * 0.02;
  return (
    <group position={[0, -0.1, 0]}>
      <gridHelper args={[20, 20, COLORS.grid, COLORS.grid]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color={COLORS.background} />
      </mesh>
      {/* Pedestal */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[2, 2.2, 0.4, 32]} />
        <meshStandardMaterial color="#222" metalness={0.5} roughness={0.2} />
      </mesh>
    </group>
  );
};

const Scene = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  const rotation = interpolate(frame, [0, 175], [0, Math.PI * 2]);
  
  // Color cycling logic
  const colorIndex = Math.floor(interpolate(frame, [60, 150], [0, 3], { extrapolateRight: 'clamp' }));
  const activeColor = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.success][colorIndex];

  // Title Animation
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const labels = ["AERODYNAMICS", "MODULAR CHASSIS", "PAINT FINISH"];
  const currentLabel = labels[Math.min(colorIndex, labels.length - 1)];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, fontFamily: 'sans-serif' }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [5, 4, 8], fov: 45 }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color={COLORS.white} />
        <spotLight position={[-5, 10, 5]} intensity={0.8} angle={0.3} penumbra={1} />
        
        <group rotation={[0, rotation, 0]}>
          <CarBody frame={frame} fps={fps} color={activeColor} />
          <Spoiler frame={frame} fps={fps} />
          <GarageFloor width={width} />
        </group>
      </ThreeCanvas>

      {/* 2D UI Overlay */}
      <Sequence from={0}>
        <div style={{
          position: 'absolute',
          top: height * 0.05,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          opacity: titleSpring
        }}>
          <h1 style={{
            color: 'white',
            fontSize: minDim * 0.08,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '4px',
            margin: 0,
            background: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.accent})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 2px 10px rgba(0,0,0,0.3))`
          }}>
            Modular Assembly
          </h1>
        </div>
      </Sequence>

      <div style={{
        position: 'absolute',
        bottom: height * 0.1,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: minDim * 0.02
      }}>
        <div style={{
          padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: minDim * 0.02,
          border: `1px solid rgba(255, 255, 255, 0.2)`,
          color: 'white',
          fontSize: minDim * 0.04,
          fontWeight: '600',
          transition: 'all 0.3s ease'
        }}>
          STATUS: {frame < 50 ? 'ASSEMBLING' : 'COMPLETE'}
        </div>
        
        <div style={{
          fontSize: minDim * 0.035,
          color: activeColor,
          fontWeight: 'bold',
          letterSpacing: '2px',
          textShadow: `0 0 15px ${activeColor}66`
        }}>
          {currentLabel}
        </div>
      </div>

      {/* Progress Circles for Colors */}
      <div style={{
        position: 'absolute',
        right: width * 0.05,
        top: '40%',
        display: 'flex',
        flexDirection: 'column',
        gap: minDim * 0.03
      }}>
        {[COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.success].map((c, i) => (
          <div
            key={c}
            style={{
              width: minDim * 0.05,
              height: minDim * 0.05,
              borderRadius: '50%',
              backgroundColor: c,
              border: `3px solid ${i === colorIndex ? 'white' : 'transparent'}`,
              transform: i === colorIndex ? 'scale(1.3)' : 'scale(1)',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: i === colorIndex ? `0 0 20px ${c}` : 'none'
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default Scene;