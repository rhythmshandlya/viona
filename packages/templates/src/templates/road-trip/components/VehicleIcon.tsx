import React, { useId } from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface VehicleIconProps {
  x: number;
  y: number;
  angle: number;
  vehicleType: 'car' | 'van' | 'motorcycle' | 'bicycle';
  size?: number;
  color?: string;
}

/** Darken a hex color by a percentage (0-1). */
function darken(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/* ── Isometric 3D Car (top-down 45° bird's-eye) ─────────────────── */
const CarSvg: React.FC<{ size: number; color: string; uid: string }> = ({ size, color, uid }) => {
  const dark = darken(color, 0.3);
  const gradId = `car-grad-${uid}`;
  const windshieldId = `car-ws-${uid}`;
  const chromeId = `car-chr-${uid}`;
  const blurId = `car-blur-${uid}`;
  return (
    <svg width={size} height={size * 0.67} viewBox="0 0 60 40" fill="none">
      <defs>
        <filter id={blurId}>
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <linearGradient id={windshieldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a2a3a" />
          <stop offset="100%" stopColor="#4a6a8a" />
        </linearGradient>
        <linearGradient id={chromeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d0d0d0" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx={30} cy={36} rx={24} ry={4} fill="rgba(0,0,0,0.25)" filter={`url(#${blurId})`} />
      {/* Body */}
      <rect x={8} y={10} width={44} height={22} rx={5} fill={`url(#${gradId})`} />
      {/* Roof with shine */}
      <rect x={14} y={12} width={32} height={16} rx={3} fill={color} opacity={0.9} />
      <rect x={16} y={13} width={12} height={2} rx={1} fill="white" opacity={0.25} />
      {/* Windshield */}
      <path d="M40 14 L48 12 L48 24 L40 26 Z" fill={`url(#${windshieldId})`} opacity={0.8} />
      {/* Reflection slash */}
      <line x1={44} y1={13} x2={42} y2={25} stroke="white" strokeWidth={0.8} opacity={0.4} />
      {/* Rear window */}
      <path d="M20 14 L14 13 L14 25 L20 26 Z" fill={`url(#${windshieldId})`} opacity={0.6} />
      {/* Chrome bumpers */}
      <rect x={51} y={15} width={2} height={10} rx={1} fill={`url(#${chromeId})`} opacity={0.7} />
      <rect x={7} y={15} width={2} height={10} rx={1} fill={`url(#${chromeId})`} opacity={0.7} />
      {/* Wheels */}
      <ellipse cx={16} cy={10} rx={4} ry={2.5} fill="#2a2a2a" />
      <ellipse cx={44} cy={10} rx={4} ry={2.5} fill="#2a2a2a" />
      <ellipse cx={16} cy={32} rx={4} ry={2.5} fill="#2a2a2a" />
      <ellipse cx={44} cy={32} rx={4} ry={2.5} fill="#2a2a2a" />
      {/* Wheel highlights */}
      <ellipse cx={16} cy={9.5} rx={2} ry={1} fill="#555" />
      <ellipse cx={44} cy={9.5} rx={2} ry={1} fill="#555" />
      <ellipse cx={16} cy={31.5} rx={2} ry={1} fill="#555" />
      <ellipse cx={44} cy={31.5} rx={2} ry={1} fill="#555" />
      {/* Headlights */}
      <rect x={52} y={16} width={2} height={3} rx={1} fill="#FFD700" opacity={0.85} />
      <rect x={52} y={22} width={2} height={3} rx={1} fill="#FFD700" opacity={0.85} />
    </svg>
  );
};

/* ── Isometric 3D Van ────────────────────────────────────────────── */
const VanSvg: React.FC<{ size: number; color: string; uid: string }> = ({ size, color, uid }) => {
  const dark = darken(color, 0.3);
  const gradId = `van-grad-${uid}`;
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 60 45" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx={30} cy={41} rx={26} ry={4} fill="rgba(0,0,0,0.25)" />
      {/* Body */}
      <rect x={5} y={8} width={50} height={28} rx={4} fill={`url(#${gradId})`} />
      {/* Roof shine */}
      <rect x={8} y={10} width={44} height={24} rx={3} fill={color} opacity={0.85} />
      <rect x={10} y={11} width={16} height={2} rx={1} fill="white" opacity={0.2} />
      {/* Front windshield */}
      <rect x={46} y={13} width={6} height={14} rx={1.5} fill="#1a2a3a" opacity={0.75} />
      <line x1={49} y1={14} x2={48} y2={26} stroke="white" strokeWidth={0.6} opacity={0.35} />
      {/* Side windows */}
      <rect x={10} y={13} width={8} height={8} rx={1} fill="#1a2a3a" opacity={0.55} />
      <rect x={20} y={13} width={8} height={8} rx={1} fill="#1a2a3a" opacity={0.55} />
      <rect x={30} y={13} width={8} height={8} rx={1} fill="#1a2a3a" opacity={0.55} />
      {/* Wheels */}
      <ellipse cx={16} cy={8} rx={4.5} ry={2.5} fill="#2a2a2a" />
      <ellipse cx={44} cy={8} rx={4.5} ry={2.5} fill="#2a2a2a" />
      <ellipse cx={16} cy={36} rx={4.5} ry={2.5} fill="#2a2a2a" />
      <ellipse cx={44} cy={36} rx={4.5} ry={2.5} fill="#2a2a2a" />
      {/* Headlights */}
      <rect x={54} y={17} width={2} height={3} rx={1} fill="#FFD700" opacity={0.85} />
      <rect x={54} y={22} width={2} height={3} rx={1} fill="#FFD700" opacity={0.85} />
    </svg>
  );
};

/* ── Isometric 3D Motorcycle ─────────────────────────────────────── */
const MotorcycleSvg: React.FC<{ size: number; color: string; uid: string }> = ({ size, color, uid }) => {
  const dark = darken(color, 0.3);
  const gradId = `moto-grad-${uid}`;
  return (
    <svg width={size} height={size * 0.67} viewBox="0 0 60 40" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx={30} cy={36} rx={18} ry={3} fill="rgba(0,0,0,0.2)" />
      {/* Rear wheel */}
      <ellipse cx={16} cy={24} rx={7} ry={10} fill="#2a2a2a" />
      <ellipse cx={16} cy={24} rx={4} ry={7} fill="#444" />
      <ellipse cx={16} cy={24} rx={1.5} ry={2} fill="#666" />
      {/* Front wheel */}
      <ellipse cx={44} cy={24} rx={7} ry={10} fill="#2a2a2a" />
      <ellipse cx={44} cy={24} rx={4} ry={7} fill="#444" />
      <ellipse cx={44} cy={24} rx={1.5} ry={2} fill="#666" />
      {/* Frame body */}
      <path d="M20 18 L40 16 L44 20 L40 28 L20 30 Z" fill={`url(#${gradId})`} />
      {/* Tank */}
      <ellipse cx={28} cy={22} rx={6} ry={4} fill={color} />
      <ellipse cx={27} cy={21} rx={3} ry={1.5} fill="white" opacity={0.15} />
      {/* Seat */}
      <rect x={18} y={20} width={10} height={4} rx={2} fill={dark} />
      {/* Handlebars */}
      <line x1={42} y1={14} x2={46} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <line x1={42} y1={14} x2={46} y2={16} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Headlight */}
      <ellipse cx={48} cy={18} rx={2} ry={2.5} fill="#FFD700" opacity={0.85} />
      {/* Exhaust */}
      <line x1={16} y1={30} x2={10} y2={32} stroke="#888" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
};

/* ── Isometric 3D Bicycle ────────────────────────────────────────── */
const BicycleSvg: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const dark = darken(color, 0.3);
  return (
    <svg width={size} height={size * 0.67} viewBox="0 0 60 40" fill="none">
      {/* Shadow */}
      <ellipse cx={30} cy={36} rx={16} ry={2.5} fill="rgba(0,0,0,0.15)" />
      {/* Rear wheel */}
      <ellipse cx={16} cy={24} rx={6} ry={9} fill="none" stroke="#555" strokeWidth={2} />
      <ellipse cx={16} cy={24} rx={1.2} ry={1.8} fill="#777" />
      {/* Front wheel */}
      <ellipse cx={44} cy={24} rx={6} ry={9} fill="none" stroke="#555" strokeWidth={2} />
      <ellipse cx={44} cy={24} rx={1.2} ry={1.8} fill="#777" />
      {/* Frame */}
      <path d="M16 24 L28 16 L40 16 L44 24" stroke={color} strokeWidth={2} strokeLinejoin="round" fill="none" />
      <line x1={28} y1={16} x2={44} y2={24} stroke={color} strokeWidth={2} />
      <line x1={28} y1={16} x2={16} y2={24} stroke={color} strokeWidth={2} />
      {/* Seat */}
      <line x1={24} y1={14} x2={32} y2={14} stroke={dark} strokeWidth={3} strokeLinecap="round" />
      <line x1={28} y1={16} x2={28} y2={14} stroke={color} strokeWidth={2} />
      {/* Handlebars */}
      <path d="M40 14 L42 11 L46 11" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Pedal crank */}
      <circle cx={28} cy={22} r={2} fill={color} opacity={0.7} />
    </svg>
  );
};

/* ── Dust Trail Particles ────────────────────────────────────────── */
const DustTrail: React.FC<{ angle: number; frame: number }> = ({ frame }) => {
  // Since the parent container is rotated to face the travel direction,
  // trail particles go in the negative-x direction (behind the vehicle).
  const particles = [
    { dist: 8, size: 5, baseOpacity: 0.35 },
    { dist: 16, size: 6, baseOpacity: 0.25 },
    { dist: 24, size: 4, baseOpacity: 0.18 },
    { dist: 32, size: 5, baseOpacity: 0.1 },
    { dist: 40, size: 3, baseOpacity: 0.05 },
  ];

  return (
    <>
      {particles.map((p, i) => {
        const cycle = (frame + i * 3) % 12;
        const pulse = interpolate(cycle, [0, 6, 12], [0.8, 1.2, 0.8], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <circle
            key={i}
            cx={-p.dist}
            cy={0}
            r={p.size * pulse}
            fill="rgba(180, 160, 130, 1)"
            opacity={p.baseOpacity}
          />
        );
      })}
    </>
  );
};

/* ── Main VehicleIcon Component ──────────────────────────────────── */
const VehicleIcon: React.FC<VehicleIconProps> = ({
  x,
  y,
  angle,
  vehicleType,
  size = 48,
  color = '#E8722A',
}) => {
  const frame = useCurrentFrame();
  const uid = useId().replace(/:/g, '');

  // Slight vertical bounce: 1px amplitude
  const bounceOffset = interpolate(frame % 8, [0, 4, 8], [-1, 1, -1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const VehicleSvg = (() => {
    switch (vehicleType) {
      case 'van':
        return <VanSvg size={size} color={color} uid={uid} />;
      case 'motorcycle':
        return <MotorcycleSvg size={size} color={color} uid={uid} />;
      case 'bicycle':
        return <BicycleSvg size={size} color={color} />;
      case 'car':
      default:
        return <CarSvg size={size} color={color} uid={uid} />;
    }
  })();

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + bounceOffset,
        transform: `translate(-50%, -50%) rotate(${angle}rad)`,
        pointerEvents: 'none',
      }}
    >
      {/* Dust trail behind vehicle (positioned at center, unrotated) */}
      <svg
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          overflow: 'visible',
          width: 0,
          height: 0,
        }}
      >
        <DustTrail angle={0} frame={frame} />
      </svg>
      {VehicleSvg}
    </div>
  );
};

export default VehicleIcon;
