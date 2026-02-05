import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import * as THREE from 'three';
import React, { useMemo } from 'react';

const COLORS = {
  bg: '#1a1a1a',
  primary: '#3498db',
  secondary: '#f1c40f',
  accent: '#e74c3c',
  grid: '#333333',
  brad: '#2ecc71',
  blippi: '#e67e22',
};

const CarModel = ({ color, position, assembledProgress }: { color: string, position: [number, number, number], assembledProgress: number }) => {
  return (
    <group position={position}>
      {/* Chassis */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2, 0.3, 1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      
      {/* Body Panels - Flying in based on progress */}
      <mesh position={[0, 0.6, 0]} scale={[assembledProgress, assembledProgress, assembledProgress]}>
        <boxGeometry args={[1.8, 0.6, 0.9]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Wheels */}
      {[-0.7, 0.7].map((x) => (
        [-0.5, 0.5].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.1, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.2, 16]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        ))
      ))}
    </group>
  );
};

const Character = ({ color, position, waveAmount, scale }: { color: string, position: [number, number, number], waveAmount: number, scale: number }) => {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Waving Arm */}
      <group position={[0.2, 1, 0]} rotation={[0, 0, -waveAmount * 1.5]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
};

export default function ModularAssemblyScene() {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Persistence: Previous scene ended at 80% assembly with camera at front grill.
  // Transition: Camera pulls back to reveal everything.
  
  const assemblyProgress = interpolate(frame, [0, 40], [0.8, 1.0], {
    extrapolateRight: 'clamp',
  });

  const cameraZ = interpolate(frame, [0, 80], [3, 8], {
    extrapolateRight: 'clamp',
  });

  const cameraX = interpolate(frame, [0, 80], [3, 0], {
    extrapolateRight: 'clamp',
  });

  const car1X = -3;
  const car2X = 2.5;

  // Character Entrances
  const bradEntrance = spring({
    frame: frame - 40,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const blippiEntrance = spring({
    frame: frame - 55,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Waving animation
  const waving = Math.sin(frame * 0.2) * 0.5 + 0.5;

  const floorGrid = useMemo(() => {
    return new THREE.GridHelper(20, 20, COLORS.grid, COLORS.grid);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [cameraX, 2, cameraZ], fov: 45 }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-5, 8, 2]} intensity={0.8} />

        {/* Global Garage Floor */}
        <primitive object={floorGrid} position={[0, -0.01, 0]} />

        {/* First Car (Multi-Colored from previous scene context) */}
        <CarModel color={COLORS.secondary} position={[car1X, 0, 0]} assembledProgress={1} />

        {/* Second Car (Blue - focus of this segment) */}
        <CarModel color={COLORS.primary} position={[car2X, 0, 0]} assembledProgress={assemblyProgress} />

        {/* Characters Appearing */}
        {frame > 40 && (
          <Character 
            color={COLORS.brad} 
            position={[car2X + 1.2, 0, 1]} 
            waveAmount={waving} 
            scale={bradEntrance} 
          />
        )}
        {frame > 55 && (
          <Character 
            color={COLORS.blippi} 
            position={[car2X + 2, 0, 0.8]} 
            waveAmount={waving * 0.8} 
            scale={blippiEntrance} 
          />
        )}
      </ThreeCanvas>

      {/* 2D Labels */}
      <Sequence from={0}>
        <div style={{
          position: 'absolute',
          top: height * 0.05,
          width: '100%',
          textAlign: 'center',
          color: 'white',
          fontSize: minDim * 0.05,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          opacity: interpolate(frame, [0, 30], [0, 1])
        }}>
          MODULAR ASSEMBLY COMPLETE
        </div>
      </Sequence>

      <Sequence from={60}>
        <div style={{
          position: 'absolute',
          bottom: height * 0.15,
          left: width * 0.55,
          display: 'flex',
          flexDirection: 'column',
          gap: minDim * 0.02,
          opacity: bradEntrance
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
            borderRadius: minDim * 0.02,
            border: `2px solid ${COLORS.brad}`,
            color: 'white',
            fontSize: minDim * 0.035,
            fontFamily: 'sans-serif'
          }}>
            Brad: "Nice to meet you!"
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            padding: `${minDim * 0.02}px ${minDim * 0.04}px`,
            borderRadius: minDim * 0.02,
            border: `2px solid ${COLORS.blippi}`,
            color: 'white',
            fontSize: minDim * 0.035,
            fontFamily: 'sans-serif',
            marginLeft: minDim * 0.05,
            opacity: blippiEntrance
          }}>
            Blippi: "I'm Blippi!"
          </div>
        </div>
      </Sequence>

      <div style={{
          position: 'absolute',
          bottom: height * 0.05,
          width: '100%',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: minDim * 0.025,
          fontFamily: 'sans-serif',
          letterSpacing: '2px'
        }}>
          CHARACTER INTERACTION AREA
      </div>
    </AbsoluteFill>
  );
}