import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
} from 'remotion';
import { COLORS, SPRING_SETTLED } from './constants';

const CommentBlock: React.FC<{
  id: string | number;
  color: any;
  size: number;
  y: number;
  opacity: number;
  style?: React.CSSProperties;
}> = ({ id, color, size, y, opacity, style }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: `${y}px`,
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: size * 0.1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateX(-50%)`,
        opacity,
        boxShadow: `0 4px 10px rgba(0,0,0,0.3)`,
        border: `2px solid ${COLORS.glassBorder}`,
        ...style,
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: size * 0.25,
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
        }}
      >
        ID: {id}
      </span>
    </div>
  );
};

const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);
  const s1CommentSize = minDim * 0.15;
  const s1Comments = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({ id: i + 1, delay: i * 8 })), []);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {s1Comments.map((c) => {
        const localFrame = frame - c.delay;
        if (localFrame < 0) return null;
        const s1Speed = interpolate(localFrame, [0, 100], [1, 2], { extrapolateRight: 'clamp' });
        const s1y = interpolate(localFrame * s1Speed, [0, 60], [-100, height + 100]);
        const s1op = interpolate(s1y, [0, 200, height - 200, height], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return <CommentBlock key={c.id} id={c.id} color={COLORS.primary} size={s1CommentSize} y={s1y} opacity={s1op} />;
      })}
    </AbsoluteFill>
  );
};

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);
  const s2CommentSize = minDim * 0.15;
  const s2Comments = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({ id: i + 20, delay: i * 10 })), []);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {s2Comments.map((c) => {
        const lFrame = frame - c.delay;
        if (lFrame < 0) return null;
        const winner = c.id === 27;
        const s2Color = winner ? COLORS.accent : COLORS.primary;
        const s2Speed = (winner && lFrame > 30 && lFrame < 60) ? 0.3 : 1;
        const s2y = interpolate(lFrame * s2Speed, [0, 60], [-100, height + 100]);
        const s2op = interpolate(s2y, [0, 200, height - 200, height], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const s2Scale = winner ? (interpolate(lFrame, [10, 30], [1, 1.3], { extrapolateRight: 'clamp' }) as number) : 1;
        const s2Glow = winner ? (interpolate(lFrame, [10, 30], [0, 20], { extrapolateRight: 'clamp' }) as number) : 0;
        return <CommentBlock key={c.id} id={c.id} color={s2Color} size={s2CommentSize} y={s2y} opacity={s2op} style={{ transform: `translateX(-50%) scale(${s2Scale})`, boxShadow: `0 0 ${s2Glow}px ${COLORS.accent}` }} />;
      })}
    </AbsoluteFill>
  );
};

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const minDim = Math.min(width, height);
  const s3BoxSpring = spring({ frame: frame - 10, fps, config: SPRING_SETTLED });
  const s3Overflow = frame >= 80;
  const s3Shake = s3Overflow ? Math.sin(frame * 2) * (interpolate(frame, [80, 120], [0, 1], { extrapolateRight: 'clamp' }) as number) * 10 : 0;
  const s3ColP = interpolate(frame, [80, 110], [0, 1], { extrapolateRight: 'clamp' }) as number;
  const s3Color = `rgb(${interpolate(s3ColP, [0, 1], [59, 239])}, ${interpolate(s3ColP, [0, 1], [130, 68])}, ${interpolate(s3ColP, [0, 1], [246, 68])})`;
  const s3Blocks = useMemo(() => Array.from({ length: 12 }), []);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: minDim * 0.6, height: minDim * 0.6, border: `4px solid ${s3Overflow ? COLORS.danger : COLORS.secondary}`, borderRadius: 20, backgroundColor: s3Color, display: 'flex', flexWrap: 'wrap', padding: 20, gap: 10, transform: `scale(${s3BoxSpring}) translate(${s3Shake}px, 0px)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontWeight: 'bold', fontSize: 24 }}>RAM</div>
        {s3Blocks.map((_, i) => {
            const bFrame = frame - 20 - i * 5;
            const bScale = spring({ frame: bFrame, fps, config: SPRING_SETTLED });
            return bFrame >= 0 ? <div key={i} style={{ width: '20%', height: '20%', backgroundColor: COLORS.white, borderRadius: 5, transform: `scale(${bScale})` }} /> : null;
        })}
      </div>
      {frame > 110 && <div style={{ position: 'absolute', top: height * 0.3, fontSize: 120, opacity: interpolate(frame, [110, 130], [0, 1], { extrapolateRight: 'clamp' }) as number }}>❓</div>}
    </AbsoluteFill>
  );
};

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const text = "RESERVOIR SAMPLING";
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {text.split("").map((char, i) => {
          const d = i * 3;
          const op = interpolate(frame - 10 - d, [0, 10], [0, 1], { extrapolateRight: 'clamp' }) as number;
          const ty = interpolate(frame - 10 - d, [0, 10], [20, 0], { extrapolateRight: 'clamp' }) as number;
          return <span key={i} style={{ color: COLORS.accent, fontSize: height * 0.06, fontWeight: 800, opacity: op, transform: `translateY(${ty}px)`, textShadow: `0 0 15px ${COLORS.accent}44` }}>{char === " " ? "\u00A0" : char}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const minDim = Math.min(width, height);
  const s5ResScale = spring({ frame: frame - 10, fps, config: SPRING_SETTLED });
  const s5Slide = spring({ frame: frame - 70, fps, config: SPRING_SETTLED });
  const s5cX = interpolate(s5Slide, [0, 1], [-200, width * 0.2]) as number;
  const s5Rot = interpolate(frame - 90, [0, 30], [0, 360], { extrapolateRight: 'clamp' }) as number;
  const s5DieOp = interpolate(frame - 90, [0, 10], [0, 1], { extrapolateRight: 'clamp' }) as number;
  const s5FormOp = interpolate(frame - 160, [0, 20], [0, 1], { extrapolateRight: 'clamp' }) as number;
  const s5SwapF = 240;
  const s5IsSwap = frame >= s5SwapF;
  const s5SwapS = spring({ frame: frame - s5SwapF, fps, config: SPRING_SETTLED });
  const s5OldX = s5IsSwap ? (interpolate(s5SwapS, [0, 1], [width * 0.5, width * 1.2], { extrapolateRight: 'clamp' }) as number) : (width * 0.5);
  const s5NewX = s5IsSwap ? (interpolate(s5SwapS, [0, 1], [width * 0.2, width * 0.5], { extrapolateRight: 'clamp' }) as number) : s5cX;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', fontSize: 60, color: COLORS.accent, fontWeight: 'bold', opacity: s5FormOp }}>P = 1/n</div>
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: `translateX(-50%) rotate(${s5Rot}deg)`, fontSize: 80, opacity: s5DieOp }}>🎲</div>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${s5ResScale})`, width: minDim * 0.3, height: minDim * 0.3, border: `4px solid ${COLORS.accent}`, borderRadius: 20, boxShadow: `0 0 20px ${COLORS.accent}44` }}>
          <div style={{ textAlign: 'center', color: 'white', marginTop: 10 }}>Winner</div>
          {(!s5IsSwap || frame < s5SwapF + 20) && (
            <div style={{ position: 'absolute', left: '50%', top: '60%', transform: `translate(-50%, -50%) translateX(${s5OldX - width * 0.5}px)`, width: '80%', height: '40%', backgroundColor: COLORS.primary, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ID: 15</div>
          )}
      </div>
      <div style={{ position: 'absolute', left: s5NewX, top: '50%', transform: `translate(-50%, -50%)`, width: minDim * 0.2, height: minDim * 0.12, backgroundColor: COLORS.accent, borderRadius: 10, display: s5IsSwap && frame > s5SwapF + 10 ? 'flex' : (frame > 70 ? 'flex' : 'none'), alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>ID: n</div>
      {s5IsSwap && frame < s5SwapF + 30 && <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 100, height: 100, borderRadius: '50%', backgroundColor: 'white', opacity: interpolate(frame - s5SwapF, [0, 10], [0.8, 0], { extrapolateRight: 'clamp' }) as number }} />}
    </AbsoluteFill>
  );
};

const Scene6: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();
    const minDim = width * 0.6;
    const s6Split = spring({ frame: frame - 10, fps, config: SPRING_SETTLED });
    const s6Bs = Array.from({ length: 5 });
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', height: minDim * 0.5, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                {s6Bs.map((_, i) => {
                    const off = (i - 2) * (minDim * 0.18) * s6Split;
                    const sc = interpolate(s6Split, [0, 1], [1.5, 1], { extrapolateRight: 'clamp' }) as number;
                    return <div key={i} style={{ width: minDim * 0.15, height: minDim * 0.15, border: `3px solid ${COLORS.accent}`, borderRadius: 10, transform: `translateX(${off}px) scale(${sc})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20 }}>W</div>;
                })}
            </div>
            <div style={{ marginTop: 50, fontSize: 80, color: COLORS.accent, fontWeight: 'bold', opacity: interpolate(frame - 100, [0, 20], [0, 1], { extrapolateRight: 'clamp' }) as number, transform: `scale(${spring({ frame: frame - 100, fps, config: SPRING_SETTLED })})` }}>P = ? / n</div>
        </AbsoluteFill>
    );
};

const Scene7: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const minDim = Math.min(width, height);
    const pScale = spring({ frame: frame - 10, fps, config: SPRING_SETTLED });
    const op = interpolate(frame - 40, [0, 20], [0, 1], { extrapolateRight: 'clamp' }) as number;
    const s7h = height;
    return (
        <AbsoluteFill style={{ backgroundColor: COLORS.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: minDim * 0.04 }}>
            <div style={{ width: minDim * 0.3, height: minDim * 0.3, borderRadius: '50%', backgroundColor: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: minDim * 0.1, transform: `scale(${pScale})`, border: `${minDim * 0.01}px solid ${COLORS.accent}` }}>👨‍💻</div>
            <div style={{ color: 'white', fontSize: minDim * 0.06, fontWeight: 'bold', opacity: op }}>Prasanna</div>
            <div style={{ color: COLORS.accent, fontSize: minDim * 0.04, opacity: interpolate(frame - 60, [0, 20], [0, 1], { extrapolateRight: 'clamp' }) as number }}>Technical Architect @ Zoho</div>
            <div style={{ display: 'flex', gap: minDim * 0.04, marginTop: minDim * 0.04 }}>
                {['Follow', 'Share'].map((t, i) => {
                    const s = spring({ frame: frame - (120 + i * 20), fps, config: { ...SPRING_SETTLED, damping: 15 } });
                    return <div key={i} style={{ padding: `${minDim * 0.02}px ${minDim * 0.04}px`, borderRadius: 50, backgroundColor: COLORS.accent, color: 'white', fontSize: minDim * 0.032, fontWeight: 'bold', transform: `scale(${s})`, boxShadow: `0 0 20px ${COLORS.accent}66` }}>{t}</div>;
                })}
            </div>
            <div style={{display: 'none'}}>{s7h}</div>
        </AbsoluteFill>
    );
};

export const ProjC9b2ab0e8fbc4e9aA15e252f94536675: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Sequence from={0} durationInFrames={150}><Scene1 /></Sequence>
      <Sequence from={180} durationInFrames={120}><Scene2 /></Sequence>
      <Sequence from={300} durationInFrames={450}><Scene3 /></Sequence>
      <Sequence from={810} durationInFrames={150}><Scene4 /></Sequence>
      <Sequence from={960} durationInFrames={690}><Scene5 /></Sequence>
      <Sequence from={1650} durationInFrames={330}><Scene6 /></Sequence>
      <Sequence from={1980}><Scene7 /></Sequence>
    </AbsoluteFill>
  );
};
