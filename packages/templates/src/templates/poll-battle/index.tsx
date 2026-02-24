import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { PollBattleProps } from './schema';

const POLL_COLORS = ['#61DAFB', '#42B883', '#FF3E00', '#DD0031', '#6366F1', '#EC4899'];

const PollBattle: React.FC<PollBattleProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const options = props.options;
  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0) || 1;
  const maxVotes = Math.max(...options.map((o) => o.votes));
  const winnerIdx = options.findIndex((o) => o.votes === maxVotes);

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const questionOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const questionSlide = interpolate(frame, [0, 20], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Fill progress (all bars fill simultaneously, frames 25-250)
  const fillProgress = interpolate(frame, [25, 250], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Winner badge
  const winnerBadgeScale = spring({ frame: frame - 260, fps, config: { damping: 12, stiffness: 180, mass: 0.5 } });

  // Layout
  const BAR_TOP = s(200);
  const BAR_LEFT = s(80);
  const BAR_RIGHT = s(80);
  const BAR_WIDTH = width - BAR_LEFT - BAR_RIGHT;
  const BAR_HEIGHT = s(52);
  const BAR_GAP = s(100);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: introOpacity * outroOpacity }}>
      {/* Question */}
      <div style={{ position: 'absolute', top: s(60), left: s(60), right: s(60), textAlign: 'center', opacity: questionOpacity, transform: `translateY(${questionSlide}px)` }}>
        <span style={{ fontFamily: FONTS.headline, fontSize: s(42), fontWeight: 800, color: theme.text, lineHeight: 1.2 }}>{props.question}</span>
      </div>

      {/* Total votes label */}
      <div style={{ position: 'absolute', top: s(140), left: 0, right: 0, textAlign: 'center', opacity: questionOpacity }}>
        <span style={{ fontFamily: FONTS.body, fontSize: s(18), fontWeight: 500, color: theme.textMuted }}>{props.totalLabel}</span>
      </div>

      {/* Option bars */}
      {options.map((opt, i) => {
        const pct = (opt.votes / totalVotes) * 100;
        const barFillPct = (opt.votes / maxVotes) * 100 * fillProgress;
        const color = opt.color ?? POLL_COLORS[i % POLL_COLORS.length];
        const isWinner = i === winnerIdx;

        const y = BAR_TOP + i * BAR_GAP;

        const labelEnter = interpolate(frame, [15 + i * 5, 30 + i * 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        const displayPct = Math.round(pct * fillProgress);

        return (
          <div key={i} style={{ position: 'absolute', left: BAR_LEFT, top: y, width: BAR_WIDTH }}>
            {/* Label + percentage row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: s(10), opacity: labelEnter }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: s(10) }}>
                <span style={{ fontFamily: FONTS.headline, fontSize: s(26), fontWeight: 700, color: theme.text }}>{opt.label}</span>
                {isWinner && frame >= 260 && (
                  <span style={{ fontSize: s(22), transform: `scale(${winnerBadgeScale})`, display: 'inline-block' }}>&#128081;</span>
                )}
              </div>
              <span style={{ fontFamily: FONTS.headline, fontSize: s(28), fontWeight: 800, color }}>{displayPct}%</span>
            </div>

            {/* Bar track */}
            <div style={{ width: '100%', height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, background: theme.trackBg, overflow: 'hidden' }}>
              <div style={{
                width: `${barFillPct}%`,
                height: '100%',
                borderRadius: BAR_HEIGHT / 2,
                background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
                boxShadow: isWinner && frame >= 250 ? `0 0 ${s(20)}px ${color}60` : `0 0 ${s(8)}px ${color}30`,
              }} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default PollBattle;
