import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
} from 'remotion';
import {
  FadeIn,
  GlowPulse,
  ScaleIn,
  PremiumStagger,
  BounceIn,
} from '../../animations';

const COLORS = {
  background: '#0F172A',
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  error: '#EF4444',
  text: '#FFFFFF',
  card: 'rgba(30, 41, 59, 0.7)',
};

const DataPacket = ({ 
  frame, 
  index, 
  minDim, 
  width 
}: { 
  frame: number; 
  index: number; 
  minDim: number; 
  width: number;
}) => {
  const fps = 24;
  const startDelay = index * 60;
  const progress = interpolate(
    frame - startDelay,
    [0, 150],
    [width * 0.75, width * 0.15],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  // Validation point is at width * 0.5
  const isPassedGateway = progress < width * 0.5;
  const gatewayFrame = frame - startDelay - 75; // Time at gate
  
  const isValidating = gatewayFrame > 0 && gatewayFrame < 25;
  const scale = spring({ 
    frame: isValidating ? gatewayFrame : 0, 
    fps, 
    config: { stiffness: 100 } 
  });

  const packetSize = minDim * 0.12;

  // Visual state changes
  const isMessy = !isPassedGateway;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: progress,
        top: '45%',
        width: packetSize,
        height: packetSize,
        backgroundColor: COLORS.card,
        borderRadius: minDim * 0.02,
        border: `${minDim * 0.005}px solid ${isPassedGateway ? COLORS.secondary : COLORS.accent}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: minDim * 0.01,
        boxShadow: isPassedGateway ? `0 0 ${minDim * 0.04}px ${COLORS.secondary}44` : 'none',
        transform: `scale(${1 + (scale * 0.1)})`,
        opacity: progress < width * 0.2 ? interpolate(progress, [width * 0.15, width * 0.2], [0, 1]) : 1,
      }}
    >
      <div style={{ fontSize: minDim * 0.02, color: COLORS.text, fontWeight: 'bold', marginBottom: minDim * 0.01 }}>
        {isPassedGateway ? 'VALID' : 'RAW'}
      </div>
      
      {/* Dynamic Content: URL vs Valid URL */}
      {isMessy ? (
        <div style={{ display: 'flex', gap: minDim * 0.005 }}>
           <img 
            src="https://api.iconify.design/lucide/alert-circle.svg?color=%23F59E0B" 
            width={minDim * 0.04} 
            height={minDim * 0.04} 
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: minDim * 0.005 }}>
           <img 
            src="https://api.iconify.design/lucide/check-circle.svg?color=%2310B981" 
            width={minDim * 0.04} 
            height={minDim * 0.04} 
          />
        </div>
      )}
    </div>
  );
};

export default function PostelLawMomentThree() {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  const packets = useMemo(() => [0, 1, 2, 3], []);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ 
        height: height * 0.15, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: `0 ${minDim * 0.05}px`
      }}>
        <BounceIn>
          <h1 style={{ 
            color: COLORS.text, 
            fontSize: minDim * 0.06, 
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: minDim * 0.01
          }}>
            Strict Output Validation
          </h1>
        </BounceIn>
      </div>

      {/* MAIN VISUAL AREA */}
      <div style={{ height: height * 0.6, position: 'relative' }}>
        
        {/* Persistent Path */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '10%',
          right: '10%',
          height: minDim * 0.002,
          background: `linear-gradient(to right, ${COLORS.secondary}22, ${COLORS.accent}22)`,
          transform: 'translateY(-50%)'
        }} />

        {/* PERSISTENT ELEMENTS: Left (Frontend) */}
        <div style={{
          position: 'absolute',
          left: width * 0.05,
          top: '35%',
          width: width * 0.2,
          height: height * 0.3,
          border: `${minDim * 0.005}px solid ${COLORS.primary}44`,
          borderRadius: minDim * 0.02,
          background: 'rgba(59, 130, 246, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: minDim * 0.02
        }}>
          <img src="https://api.iconify.design/lucide/monitor.svg?color=%233B82F6" width={minDim * 0.08} height={minDim * 0.08} />
          <span style={{ color: COLORS.primary, fontSize: minDim * 0.025, marginTop: minDim * 0.01 }}>Frontend UI</span>
          
          <div style={{ width: '100%', marginTop: minDim * 0.03, gap: minDim * 0.01, display: 'flex', flexDirection: 'column' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: minDim * 0.01, background: `${COLORS.primary}33`, borderRadius: 10, width: '80%' }} />
            ))}
          </div>
        </div>

        {/* PERSISTENT ELEMENTS: Right (Database) */}
        <div style={{
          position: 'absolute',
          right: width * 0.05,
          top: '35%',
          width: width * 0.2,
          height: height * 0.3,
          border: `${minDim * 0.005}px solid ${COLORS.accent}44`,
          borderRadius: minDim * 0.02,
          background: 'rgba(245, 158, 11, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: minDim * 0.02
        }}>
          <img src="https://api.iconify.design/lucide/database.svg?color=%23F59E0B" width={minDim * 0.08} height={minDim * 0.08} />
          <span style={{ color: COLORS.accent, fontSize: minDim * 0.025, marginTop: minDim * 0.01 }}>Database</span>
          
          <div style={{ width: '100%', marginTop: minDim * 0.03, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: minDim * 0.01 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: minDim * 0.02, background: `${COLORS.accent}33`, borderRadius: 4 }} />
            ))}
          </div>
        </div>

        {/* CENTRAL GATEWAY (Validation Lens) */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '20%',
          bottom: '20%',
          width: minDim * 0.15,
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            border: `${minDim * 0.005}px solid ${COLORS.text}22`,
            borderRadius: minDim * 0.04,
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: minDim * 0.03
          }}>
            <GlowPulse>
              <img src="https://api.iconify.design/lucide/shield-check.svg?color=%2310B981" width={minDim * 0.08} height={minDim * 0.08} />
            </GlowPulse>
            <div style={{ 
              height: '60%', 
              width: minDim * 0.005, 
              background: `linear-gradient(to bottom, transparent, ${COLORS.secondary}, transparent)` 
            }} />
            <span style={{ color: COLORS.secondary, fontSize: minDim * 0.02, fontWeight: 'bold' }}>STRICT</span>
          </div>
        </div>

        {/* DATA FLOWING FROM RIGHT TO LEFT */}
        {packets.map((p) => (
          <DataPacket key={p} index={p} frame={frame} minDim={minDim} width={width} />
        ))}
      </div>

      {/* LABELS & EXPLANATION */}
      <div style={{ 
        height: height * 0.25, 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        gap: minDim * 0.03,
        padding: `0 ${minDim * 0.1}px`
      }}>
        <Sequence from={0}>
          <PremiumStagger speed="normal">
            <FadeIn>
              <div style={{ 
                background: COLORS.card, 
                padding: `${minDim * 0.02}px ${minDim * 0.04}px`, 
                borderRadius: minDim * 0.02,
                borderLeft: `${minDim * 0.01}px solid ${COLORS.secondary}`,
                display: 'flex',
                alignItems: 'center',
                gap: minDim * 0.03
              }}>
                <ScaleIn delay={20}>
                   <img src="https://api.iconify.design/lucide/check-square.svg?color=%2310B981" width={minDim * 0.05} height={minDim * 0.05} />
                </ScaleIn>
                <div style={{ color: COLORS.text, fontSize: minDim * 0.035, lineHeight: 1.4 }}>
                  Ensure <span style={{ color: COLORS.secondary, fontWeight: 'bold' }}>mandatory fields</span> are present
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={40}>
              <div style={{ 
                background: COLORS.card, 
                padding: `${minDim * 0.02}px ${minDim * 0.04}px`, 
                borderRadius: minDim * 0.02,
                borderLeft: `${minDim * 0.01}px solid ${COLORS.secondary}`,
                display: 'flex',
                alignItems: 'center',
                gap: minDim * 0.03
              }}>
                <ScaleIn delay={60}>
                   <img src="https://api.iconify.design/lucide/link-2.svg?color=%2310B981" width={minDim * 0.05} height={minDim * 0.05} />
                </ScaleIn>
                <div style={{ color: COLORS.text, fontSize: minDim * 0.035, lineHeight: 1.4 }}>
                  Validate <span style={{ color: COLORS.secondary, fontWeight: 'bold' }}>URL formats</span> & data integrity
                </div>
              </div>
            </FadeIn>
          </PremiumStagger>
        </Sequence>
      </div>

      {/* SCANNING EFFECT ON GATEWAY */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.secondary} stopOpacity="0" />
            <stop offset="50%" stopColor={COLORS.secondary} stopOpacity="0.5" />
            <stop offset="100%" stopColor={COLORS.secondary} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect 
          x={width * 0.425} 
          y={height * 0.2 + (Math.sin(frame * 0.1) + 1) * height * 0.3} 
          width={width * 0.15} 
          height={height * 0.05} 
          fill="url(#scan)"
          style={{ opacity: 0.3 }}
        />
      </svg>
    </AbsoluteFill>
  );
}