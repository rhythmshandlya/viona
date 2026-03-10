import React from 'react';
import { useSmoothProgress } from '../hooks/use-smooth-progress';

interface ProgressBarProps {
  percent: number;
  phase: string;
  phaseName: string;
  detail?: string;
  isActive: boolean;
  error?: boolean;
}

const PHASE_ORDER = ['plan', 'animate', 'verify', 'bundle', 'upload', 'done'];
const PHASE_LABELS: Record<string, string> = {
  plan: 'Plan',
  animate: 'Animate',
  verify: 'Verify',
  bundle: 'Bundle',
  upload: 'Upload',
  done: 'Done',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  phase,
  phaseName,
  detail,
  isActive,
  error,
}) => {
  const { displayPercent } = useSmoothProgress({
    targetPercent: percent,
    isActive,
  });

  const barColor = error
    ? 'rgb(239, 68, 68)'
    : phase === 'done'
      ? 'rgb(34, 197, 94)'
      : 'rgb(99, 102, 241)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
      {/* Progress bar */}
      <div style={{
        position: 'relative',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${displayPercent}%`,
          backgroundColor: barColor,
          borderRadius: 3,
          transition: 'background-color 300ms ease',
        }}>
          {isActive && !error && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)`,
              animation: 'shimmer 2s infinite',
            }} />
          )}
        </div>
      </div>

      {/* Phase text + percent */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: error ? 'rgb(239, 68, 68)' : 'rgba(255, 255, 255, 0.6)',
      }}>
        <span>
          {phaseName}
          {detail ? ` — ${detail}` : ''}
        </span>
        <span>{Math.round(displayPercent)}%</span>
      </div>

      {/* Phase timeline */}
      <div style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.4)',
      }}>
        {PHASE_ORDER.filter(p => p !== 'done').map((p, i) => {
          const phaseIdx = PHASE_ORDER.indexOf(phase);
          const thisIdx = PHASE_ORDER.indexOf(p);
          const isComplete = thisIdx < phaseIdx || phase === 'done';
          const isCurrent = p === phase;

          return (
            <React.Fragment key={p}>
              {i > 0 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isComplete ? barColor : 'rgba(255, 255, 255, 0.1)',
                }} />
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                color: isComplete
                  ? barColor
                  : isCurrent
                    ? 'rgba(255, 255, 255, 0.8)'
                    : 'rgba(255, 255, 255, 0.3)',
                fontWeight: isCurrent ? 600 : 400,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: isComplete
                    ? barColor
                    : isCurrent
                      ? 'rgba(255, 255, 255, 0.8)'
                      : 'rgba(255, 255, 255, 0.15)',
                  ...(isCurrent && !error ? { animation: 'pulse 2s infinite' } : {}),
                }} />
                {PHASE_LABELS[p]}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
