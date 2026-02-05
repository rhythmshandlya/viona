import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import * as THREE from 'three';

const COLORS = {
  background: '#1a1a1a',
  blue: '#3498db',
  yellow: '#f1c40f',
  red: '#e74c3c',
  green: '#2ecc71',
  grid: '#333333',
  wireframe: '#444444',
};

const CarModel = ({ color, isWireframe, progress }: { color: string; isWireframe: boolean; progress: number }) => {
  const meshOpacity = isWireframe ? 0.3 : interpolate(progress, [0, 1], [0, 1]);
  const scale = isWireframe ? 1 : interpolate(progress, [0, 0.2, 1], [0, 1.1, 1]);

  return (
    <group scale={scale}>
      {/* Main Chassis */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 0.5, 4]} />
        <meshStandardMaterial 
          color={color} 
          wireframe={isWireframe} 
          transparent 
          opacity={meshOpacity} 
        />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 1.2, -0.5]}>
        <boxGeometry args={[1.8, 0.8, 2]} />
        <meshStandardMaterial 
          color={color} 
          wireframe={isWireframe} 
          transparent 
          opacity={meshOpacity * 0.8} 
        />
      </mesh>
      {/* Wheels */}
      {[-1, 1].map((x) => 
        [-1.5, 1.5].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * 1.1, 0.4, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.4, 0.4, 0.3, 24]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        ))
      )}
    </group>
  );
};

const Panel = ({ startPos, endPos, progress, color }: { startPos: [number, number, number], endPos: [number, number, number], progress: number, color: string }) => {
  const currentPos = [
    interpolate(progress, [0, 1], [startPos[0], endPos[0]]),
    interpolate(progress, [0, 1], [startPos[1], endPos[1]]),
    interpolate(progress, [0, 1], [startPos[2], endPos[2]]),
  ] as [number, number, number];

  const opacity = interpolate(progress, [0, 0.2], [0, 1]);

  return (
    <mesh position={currentPos}>
      <boxGeometry args={[2.1, 0.1, 1.5]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

const GarageScene = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Camera Pan: Starts at Left (previous car) and moves Right (new car)
  // Frame 0-224: Pan from x=-5 to x=5
  const camX = interpolate(frame, [0, 150], [-6, 6], { extrapolateRight: 'clamp' });
  
  // Animation for the Blue Panels snapping in
  const assemblySpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [camX, 4, 10], fov: 45 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <pointLight position={[-10, 5, -5]} intensity={0.5} color={COLORS.blue} />

        {/* Global Grid Floor */}
        <gridHelper args={[100, 50, COLORS.grid, COLORS.grid]} position={[0, 0, 0]} />

        {/* CAR 1: Multi-colored (Left Side, from previous scene) */}
        <group position={[-6, 0, 0]}>
          <CarModel color={COLORS.yellow} isWireframe={false} progress={1} />
        </group>

        {/* CAR 2: Blue Modular Assembly (Right Side) */}
        <group position={[6, 0, 0]}>
          {/* Base Wireframe */}
          <CarModel color={COLORS.wireframe} isWireframe={true} progress={1} />
          
          {/* Incoming blue panels snapping in */}
          <Panel 
            startPos={[5, 5, 0]} 
            endPos={[0, 0.76, 1.2]} 
            progress={assemblySpring} 
            color={COLORS.blue} 
          />
          <Panel 
            startPos={[8, 2, -2]} 
            endPos={[0, 0.76, -1.2]} 
            progress={spring({ frame: frame - 80, fps, config: { damping: 14 } })} 
            color={COLORS.blue} 
          />
          <Panel 
            startPos={[2, 6, 4]} 
            endPos={[0, 1.6, -0.5]} 
            progress={spring({ frame: frame - 100, fps, config: { damping: 15 } })} 
            color={COLORS.blue} 
          />
        </group>
      </ThreeCanvas>

      {/* 2D HUD UI Elements */}
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
          textTransform: 'uppercase',
          letterSpacing: '0.2em'
        }}>
          Modular Assembly
        </div>
      </Sequence>

      <Sequence from={110}>
        <div style={{
          position: 'absolute',
          bottom: height * 0.15,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
          borderRadius: minDim * 0.02,
          border: `2px solid ${COLORS.blue}`,
          backdropFilter: 'blur(10px)',
          color: 'white',
          fontSize: minDim * 0.04,
          fontFamily: 'sans-serif',
          opacity: spring({ frame: frame - 110, fps }),
        }}>
          STATUS: APPLYING BLUE METALLIC
        </div>
      </Sequence>

      {/* Floating Indicators for the second car */}
      <div style={{
        position: 'absolute',
        top: '40%',
        right: interpolate(frame, [0, 150], [-200, 100], { extrapolateRight: 'clamp' }),
        display: 'flex',
        flexDirection: 'column',
        gap: minDim * 0.02,
      }}>
        {['Material: Alloy', 'Color: #3498db', 'Module: Body_North'].map((text, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.1)',
            color: COLORS.blue,
            padding: '5px 15px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: minDim * 0.02,
            borderLeft: `4px solid ${COLORS.blue}`
          }}>
            {text}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export default GarageScene;