import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import * as THREE from 'three';
import React, { useMemo } from 'react';

const COLORS = {
  background: '#1a1a1a',
  primary: '#3498db',
  secondary: '#f1c40f',
  accent: '#e74c3c',
  green: '#2ecc71',
  white: '#ffffff',
  grid: '#333333',
};

const CarModel: React.FC<{ 
  rotationY: number; 
  positionX: number;
}> = ({ rotationY, positionX }) => {
  return (
    <group position={[positionX, -0.5, 0]} rotation={[0, rotationY, 0]}>
      {/* Chassis / Base */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2.2, 0.4, 1]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Hood - Yellow */}
      <mesh position={[0.7, 0.5, 0]}>
        <boxGeometry args={[0.8, 0.2, 0.9]} />
        <meshStandardMaterial color={COLORS.secondary} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Roof - Blue */}
      <mesh position={[-0.2, 0.8, 0]}>
        <boxGeometry args={[1, 0.1, 0.8]} />
        <meshStandardMaterial color={COLORS.primary} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Door/Side Panel - Red */}
      <mesh position={[-0.2, 0.45, 0.46]}>
        <boxGeometry args={[1, 0.5, 0.1]} />
        <meshStandardMaterial color={COLORS.accent} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Fender - Green */}
      <mesh position={[-0.8, 0.45, 0]}>
        <boxGeometry args={[0.6, 0.5, 0.9]} />
        <meshStandardMaterial color={COLORS.green} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Wheels */}
      {[[-0.7, 0, 0.5], [0.7, 0, 0.5], [-0.7, 0, -0.5], [0.7, 0, -0.5]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 24]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}

      {/* Spoiler (The component from previous scene) */}
      <mesh position={[-1, 0.7, 0]}>
        <boxGeometry args={[0.2, 0.05, 0.8]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  );
};

const Floor: React.FC<{ offset: number }> = ({ offset }) => {
  const gridHelper = useMemo(() => new THREE.GridHelper(100, 100, 0x444444, 0x222222), []);
  return (
    <group position={[offset, -0.5, 0]}>
      <primitive object={gridHelper} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={COLORS.background} />
      </mesh>
    </group>
  );
};

export default function ConstructionScene() {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // 1. Camera & Motion Logic
  // Initial state: Slow orbit
  // Transition: Wide pan starting around frame 100
  const orbitRotation = interpolate(frame, [0, 150], [0, Math.PI * 2]);
  
  const panProgress = spring({
    frame: frame - 100,
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  const cameraX = interpolate(panProgress, [0, 1], [0, 10]);
  const carX = interpolate(panProgress, [0, 1], [0, -2]);
  const cameraZ = interpolate(frame, [0, 75, 150], [5, 3.5, 8]); // Orbit gets closer then pulls away

  // 2. UI Interpolations
  const titleOpacity = interpolate(frame, [0, 20], [1, 1]); // Persistent
  const labelOpacity = interpolate(frame, [0, 30, 90, 110], [0, 1, 1, 0]);
  
  const labelScale = spring({
    frame: frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [cameraX, 1.5, cameraZ], fov: 45 }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight position={[-5, 10, 5]} angle={0.3} penumbra={1} intensity={2} />
        
        <CarModel 
          rotationY={orbitRotation} 
          positionX={carX} 
        />
        
        <Floor offset={0} />
        
        {/* Visual cues for colors */}
        <mesh position={[carX + 1.2, 0.8, 0]} scale={labelScale * labelOpacity}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={COLORS.secondary} emissive={COLORS.secondary} emissiveIntensity={1} />
        </mesh>
        <mesh position={[carX - 0.5, 0.4, 0.7]} scale={labelScale * labelOpacity}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={1} />
        </mesh>
      </ThreeCanvas>

      {/* 2D Overlay Content */}
      <div style={{
        position: 'absolute',
        top: height * 0.05,
        width: '100%',
        textAlign: 'center',
        color: COLORS.white,
        fontFamily: 'system-ui, sans-serif',
        opacity: titleOpacity,
      }}>
        <h1 style={{ 
          fontSize: minDim * 0.06, 
          margin: 0, 
          textTransform: 'uppercase', 
          letterSpacing: '0.2em',
          fontWeight: 900,
          textShadow: '0 0 20px rgba(255,255,255,0.3)'
        }}>
          Modular Assembly
        </h1>
      </div>

      <div style={{
        position: 'absolute',
        bottom: height * 0.1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: minDim * 0.02,
      }}>
        <Sequence from={20} layout="none">
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
            borderRadius: minDim * 0.05,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: COLORS.white,
            fontSize: minDim * 0.035,
            opacity: labelOpacity,
            transform: `scale(${labelScale})`,
            fontWeight: 500,
          }}>
            Vibrant Color Profiles Applied
          </div>
        </Sequence>

        <Sequence from={110} layout="none">
          <div style={{
            color: COLORS.primary,
            fontSize: minDim * 0.04,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Transitioning to Workshop...
          </div>
        </Sequence>
      </div>

      {/* Glassmorphic Navigation Card (Visual Detail) */}
      <div style={{
        position: 'absolute',
        right: minDim * 0.05,
        top: height * 0.2,
        width: minDim * 0.15,
        height: height * 0.4,
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: minDim * 0.02,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        alignItems: 'center',
        opacity: labelOpacity,
      }}>
        {[COLORS.accent, COLORS.secondary, COLORS.primary, COLORS.green].map((c, i) => (
          <div key={i} style={{
            width: minDim * 0.06,
            height: minDim * 0.06,
            borderRadius: '50%',
            backgroundColor: c,
            boxShadow: `0 0 15px ${c}66`
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}