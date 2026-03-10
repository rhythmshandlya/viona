import React from 'react';
import { useSmoothProgress } from '../hooks/use-smooth-progress';

interface ProgressBarProps {
  percent: number;
  phase: string;
  phaseName: string;
  detail?: string;
  isActive: boolean;
  error?: boolean;
  /** Determines which phases to show in the timeline. */
  jobType?: string;
}

/**
 * Phase definitions per job type.
 * IDs must match the `phase` values emitted by the backend.
 */
const PHASES_BY_JOB: Record<string, Array<{ id: string; label: string }>> = {
  'plan-visuals': [
    { id: 'plan', label: 'Plan' },
  ],
  'generate-visuals': [
    { id: 'plan', label: 'Plan' },
    { id: 'animate', label: 'Animate' },
    { id: 'verify', label: 'Verify' },
    { id: 'bundle', label: 'Bundle' },
  ],
  'edit-visuals': [
    { id: 'animate', label: 'Edit' },
    { id: 'verify', label: 'Verify' },
    { id: 'bundle', label: 'Bundle' },
  ],
};

/** Backend phase aliases — map alternate phase IDs to their canonical ID */
const PHASE_ALIASES: Record<string, string> = {
  self_heal: 'verify',
  workspace: 'plan',
};

const DEFAULT_PHASES = PHASES_BY_JOB['generate-visuals']!;

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  phase,
  phaseName,
  detail,
  isActive,
  error,
  jobType,
}) => {
  const { displayPercent } = useSmoothProgress({
    targetPercent: percent,
    isActive,
  });

  const barColor = error
    ? 'rgb(239, 68, 68)'
    : phase === 'done'
      ? 'rgb(34, 197, 94)'
      : 'var(--editor-accent)';

  const phases = (jobType && PHASES_BY_JOB[jobType]) || DEFAULT_PHASES;

  // Resolve aliases (e.g. self_heal → verify, workspace → plan)
  const resolvedPhase = PHASE_ALIASES[phase] ?? phase;

  // Find the index of the current phase in our list.
  const currentPhaseIdx = (() => {
    const direct = phases.findIndex((p) => p.id === resolvedPhase);
    if (direct >= 0) return direct;
    if (resolvedPhase === 'done') return phases.length;
    return -1;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
      {/* Progress bar */}
      <div style={{
        position: 'relative',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'var(--editor-border-default)',
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
          ...(isActive && !error ? { animation: 'bar-pulse 2s ease-in-out infinite' } : {}),
        }}>
          {isActive && !error && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)`,
              animation: 'shimmer 1.5s ease-in-out infinite',
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
        color: error ? 'rgb(239, 68, 68)' : 'var(--editor-text-secondary)',
      }}>
        <span>
          {phaseName}
          {detail ? ` — ${detail}` : ''}
        </span>
        <span>{Math.round(displayPercent)}%</span>
      </div>

      {/* Phase timeline */}
      {phases.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          fontSize: 10,
          color: 'var(--editor-text-muted)',
        }}>
          {phases.map((p, i) => {
            const isComplete = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx;

            return (
              <React.Fragment key={p.id}>
                {i > 0 && (
                  <div style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: isComplete ? barColor : 'var(--editor-bg-hover)',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  color: isComplete
                    ? barColor
                    : isCurrent
                      ? 'var(--editor-text-primary)'
                      : 'var(--editor-text-muted)',
                  fontWeight: isCurrent ? 600 : 400,
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: isComplete
                      ? barColor
                      : isCurrent
                        ? 'var(--editor-text-primary)'
                        : 'var(--editor-bg-hover)',
                    ...(isCurrent && !error ? { animation: 'pulse 2s infinite' } : {}),
                  }} />
                  {p.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes bar-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
