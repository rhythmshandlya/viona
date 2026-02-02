import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  spring
} from 'remotion';
import { COLORS, SPRING_SETTLED, getResponsiveSizes } from './constants';
import { HeapTree } from './components/HeapTree';
import { TimingWheel } from './components/TimingWheel';

// Reusing from library imports (conceptual, will use local implementations for robustness)
import { ParticleStream } from '../components/visual/particles/ParticleStream';
import { Counter } from '../components/visual/data/Counter';
import { GlowingOrb } from '../components/visual/shapes/GlowingOrb';

export const Proj5b12b0680d544df3931c03803cb7381b: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { fontSize, minDim } = getResponsiveSizes(width, height);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundImage: `linear-gradient(${COLORS.muted} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.muted} 1px, transparent 1px)`,
          backgroundSize: '100px 100px'
        }} />
      </div>

      {/* S01: Hook - 0-60 */}
      <Sequence from={0} durationInFrames={60}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
          <div style={{
            transform: `translateY(${interpolate(
              spring({ frame: frame, fps, config: SPRING_SETTLED }),
              [0, 1],
              [-200, 0]
            )}px)`,
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: fontSize.xl, color: COLORS.accent, textShadow: `0 0 20px ${COLORS.accent}88` }}>
              SYSTEM DESIGN<br />CHALLENGE
            </h1>
          </div>
        </div>
      </Sequence>

      {/* S02: Scale - 60-270 */}
      <Sequence from={60} durationInFrames={210}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 200 }}>
          <div style={{ width: 400, height: 200, border: `4px solid ${COLORS.muted}`, borderTop: 'none', borderRadius: '0 0 100px 100px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -400, left: 0, width: '100%', height: 400 }}>
              <ParticleStream direction="down" density={40} color={COLORS.accent} speed={2} />
            </div>
          </div>
          <div style={{ marginTop: 200 }}>
             <Counter
                from={0}
                to={10000000}
                startFrame={10}
                durationFrames={120}
                format="none"
                fontSize={fontSize.xl / 16}
                color={COLORS.warning}
                glow
             />
             <div style={{ fontSize: fontSize.md, textAlign: 'center', marginTop: 20 }}>TASKS / SEC</div>
          </div>
        </div>
      </Sequence>

      {/* S03: HeapTrap - 270-600 */}
      <Sequence from={270} durationInFrames={330}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: fontSize.lg, marginBottom: 50 }}>Priority Queue (Heap)</h2>
          <HeapTree startFrame={0} />
        </div>
      </Sequence>

      {/* S04: Bottleneck - 600-1020 */}
      <Sequence from={600} durationInFrames={420}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            top: 200,
            fontSize: fontSize.xl,
            fontWeight: 'bold',
            color: COLORS.danger,
            opacity: interpolate(frame - 600, [150, 160, 170, 180], [0, 1, 0, 1], { extrapolateRight: 'clamp' })
          }}>
            O(log n)
          </div>
          <HeapTree startFrame={0} isStressed={frame > 750} />
        </div>
      </Sequence>

      {/* S05: The Wheel - 1020-1590 */}
      <Sequence from={1020} durationInFrames={570}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
           <h2 style={{ fontSize: fontSize.lg, marginBottom: 50, color: COLORS.success }}>O(1) CONSTANT TIME</h2>
           <div style={{
             transform: `scale(${spring({ frame: frame - 1150, fps, config: SPRING_SETTLED })})`
           }}>
             <TimingWheel size={minDim * 0.7} slots={60} rotationSpeed={0.5} />
           </div>

           {/* Task dropping into slot 5 */}
           {frame > 1350 && (
             <div style={{
               position: 'absolute',
               left: interpolate(frame, [1350, 1380], [200, 540], { extrapolateRight: 'clamp' }),
               top: interpolate(frame, [1350, 1365, 1380], [200, 400, 600], { extrapolateRight: 'clamp' }),
               opacity: interpolate(frame, [1380, 1390], [1, 0], { extrapolateLeft: 'clamp' })
             }}>
               <GlowingOrb size={0.5} color={COLORS.accent} sparkle />
             </div>
           )}
        </div>
      </Sequence>

      {/* S06: Hierarchy - 1590-2220 */}
      <Sequence from={1590} durationInFrames={630}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative' }}>
             {/* Outer Wheel (Minutes) */}
             <div style={{ position: 'absolute', left: '50%', top: '50%', transformOrigin: 'center', translate: '-50% -50%', zIndex: 0 }}>
                <TimingWheel size={minDim * 0.9} slots={60} rotationSpeed={0.05} accentColor={COLORS.primary} isSecondary />
             </div>
             {/* Inner Wheel (Seconds) */}
             <div style={{ zIndex: 1 }}>
                <TimingWheel size={minDim * 0.5} slots={60} rotationSpeed={3} />
             </div>

             {/* Cascade animation */}
             {frame > 2050 && frame < 2200 && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                   <ParticleStream direction="down" density={20} color={COLORS.accent} speed={3} />
                </div>
             )}
          </div>
          <div style={{ position: 'absolute', bottom: 200, fontSize: fontSize.md, textAlign: 'center', padding: '0 80px' }}>
             Levels cascade tasks down when they tick!
          </div>
        </div>
      </Sequence>

      {/* S07: RealWorld - 2250-2640 */}
      <Sequence from={2250} durationInFrames={390}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 40, marginBottom: 100 }}>
             <TimingWheel size={minDim * 0.3} slots={12} rotationSpeed={2} accentColor={COLORS.muted} isSecondary />
             <TimingWheel size={minDim * 0.3} slots={12} rotationSpeed={-2} accentColor={COLORS.muted} isSecondary />
          </div>

          <div style={{ display: 'flex', gap: 100, alignItems: 'center' }}>
             <div style={{
               background: COLORS.white, color: COLORS.bg, padding: '20px 40px', borderRadius: 20, fontWeight: 'bold', fontSize: fontSize.md,
               transform: `scale(${spring({ frame: frame - 2450, fps, config: SPRING_SETTLED })})`
             }}>KAFKA</div>
             <div style={{
               background: COLORS.white, color: COLORS.bg, padding: '20px 40px', borderRadius: 20, fontWeight: 'bold', fontSize: fontSize.md,
               transform: `scale(${spring({ frame: frame - 2470, fps, config: SPRING_SETTLED })})`
             }}>NETTY</div>
          </div>
        </div>
      </Sequence>

      {/* S08: Outro - 2640-2967 */}
      <Sequence from={2640} durationInFrames={327}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
           <h2 style={{ fontSize: fontSize.xl, color: COLORS.accent }}>PRASANNA</h2>
           <div style={{ fontSize: fontSize.md, color: COLORS.muted }}>ZOHO ENGINEER</div>

           <div style={{
             marginTop: 100,
             background: COLORS.primary,
             padding: '24px 80px',
             borderRadius: 50,
             fontSize: fontSize.md,
             fontWeight: 'bold',
             transform: `scale(${interpolate(
               Math.sin(frame * 0.1),
               [-1, 1],
               [0.95, 1.05]
             )})`
           }}>
             FOLLOW
           </div>
        </div>
      </Sequence>

      {/* Progress Bar (Global) */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 10,
        background: COLORS.accent,
        width: `${(frame / 2967) * 100}%`
      }} />
    </AbsoluteFill>
  );
};
