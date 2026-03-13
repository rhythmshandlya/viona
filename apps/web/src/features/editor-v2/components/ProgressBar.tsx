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
 * Each phase has an id, label, and the percent threshold at which it starts.
 * Phase is determined by percent (most reliable) with backend `phase` string as fallback.
 */
const PHASES_BY_JOB: Record<string, Array<{ id: string; label: string; startAt: number }>> = {
  'plan-visuals': [
    { id: 'plan', label: 'Plan', startAt: 0 },
  ],
  'generate-visuals': [
    { id: 'plan', label: 'Plan', startAt: 0 },
    { id: 'animate', label: 'Animate', startAt: 15 },
    { id: 'verify', label: 'Verify', startAt: 65 },
    { id: 'bundle', label: 'Bundle', startAt: 75 },
  ],
  'edit-visuals': [
    { id: 'animate', label: 'Edit', startAt: 0 },
    { id: 'verify', label: 'Verify', startAt: 65 },
    { id: 'bundle', label: 'Bundle', startAt: 75 },
  ],
};

/** Backend phase aliases — map alternate phase IDs to their canonical ID */
const PHASE_ALIASES: Record<string, string> = {
  self_heal: 'verify',
  workspace: 'plan',
  // Fallback heuristic phase names → canonical
  preparing: 'plan',
  planning: 'plan',
  generating: 'animate',
  editing: 'animate',
  validating: 'verify',
  finalizing: 'bundle',
  uploading: 'bundle',
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

  // Resolve aliases (e.g. self_heal → verify, workspace → plan, generating → animate)
  const resolvedPhase = PHASE_ALIASES[phase] ?? phase;

  // Determine current phase index.
  // Primary: use percent thresholds (most reliable — backend phase strings are inconsistent).
  // Fallback: match resolved phase string against phase IDs.
  const currentPhaseIdx = (() => {
    if (resolvedPhase === 'done') return phases.length;

    // Percent-based: find the last phase whose startAt threshold has been reached
    if (displayPercent > 0 && phases.length > 1) {
      let idx = 0;
      for (let i = phases.length - 1; i >= 0; i--) {
        if (displayPercent >= phases[i].startAt) { idx = i; break; }
      }
      return idx;
    }

    // Fallback: match phase string
    const direct = phases.findIndex((p) => p.id === resolvedPhase);
    if (direct >= 0) return direct;
    return 0;
  })();

  const roundedPercent = Math.round(displayPercent);
  const isDone = phase === 'done';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0' }}>
      {/* Phase text + percent */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: error ? 'rgb(239, 68, 68)' : 'var(--editor-text-primary)',
        }}>
          {phaseName}
          {detail ? <span style={{ color: 'var(--editor-text-muted)', fontWeight: 400 }}> — {detail}</span> : ''}
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: error ? 'rgb(239, 68, 68)' : isDone ? barColor : 'var(--editor-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}>{roundedPercent}%</span>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'relative',
        height: 10,
        borderRadius: 5,
        backgroundColor: 'var(--editor-border-default)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${displayPercent}%`,
          background: isDone
            ? barColor
            : error
              ? barColor
              : `linear-gradient(90deg, var(--editor-accent), color-mix(in srgb, var(--editor-accent) 70%, white))`,
          borderRadius: 5,
          transition: 'width 300ms ease, background 300ms ease',
          ...(isActive && !error ? { animation: 'bar-pulse 2s ease-in-out infinite' } : {}),
        }}>
          {isActive && !error && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)`,
              animation: 'shimmer 1.5s ease-in-out infinite',
            }} />
          )}
        </div>
      </div>

      {/* Phase timeline */}
      {phases.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 0,
          alignItems: 'center',
          fontSize: 11,
          marginTop: 2,
        }}>
          {phases.map((p, i) => {
            const isComplete = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx;

            return (
              <React.Fragment key={p.id}>
                {i > 0 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: isComplete ? barColor : 'var(--editor-border-default)',
                    transition: 'background-color 300ms ease',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  borderRadius: 4,
                  color: isComplete
                    ? barColor
                    : isCurrent
                      ? 'var(--editor-text-primary)'
                      : 'var(--editor-text-muted)',
                  fontWeight: isCurrent ? 600 : 400,
                  ...(isCurrent ? { backgroundColor: 'var(--editor-bg-hover)' } : {}),
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: isComplete
                      ? barColor
                      : isCurrent
                        ? 'var(--editor-text-primary)'
                        : 'var(--editor-border-default)',
                    ...(isCurrent && !error ? { animation: 'pulse 2s infinite' } : {}),
                    transition: 'background-color 300ms ease',
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
          50% { opacity: 0.8; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
