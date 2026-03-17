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
  /** Which agent is currently working (Editor, Planner, Animator, Reviewer) */
  agentName?: string;
  /** Which track/region is being edited (Video, Overlay, Captions, Audio) */
  trackName?: string;
  /** Estimated seconds remaining for current phase */
  estimatedTimeRemaining?: number;
}

/**
 * Phase definitions per job type.
 * Each phase has an id, label, and the percent threshold at which it starts.
 */
const PHASES_BY_JOB: Record<string, Array<{ id: string; label: string; startAt: number }>> = {
  'plan-visuals': [
    { id: 'plan', label: 'Plan', startAt: 0 },
  ],
  // New sandbox pipeline — 6 visible phases (brainstorming + refinement are conversational)
  'sandbox-pipeline': [
    { id: 'trimming', label: 'Trim', startAt: 0 },
    { id: 'planning', label: 'Plan', startAt: 8 },
    { id: 'editing', label: 'Cut', startAt: 20 },
    { id: 'generating', label: 'Animate', startAt: 35 },
    { id: 'reviewing', label: 'Review', startAt: 70 },
    { id: 'assembling', label: 'Assemble', startAt: 85 },
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
  // Legacy heuristic phase names → canonical
  preparing: 'plan',
  // Sandbox pipeline phases map to themselves (no aliasing needed)
  // but also support legacy generate-visuals naming
  generating: 'animate',
  validating: 'verify',
  finalizing: 'bundle',
  uploading: 'bundle',
};

/** Agent display config — color accent per agent role */
const AGENT_STYLES: Record<string, { color: string; icon: string }> = {
  Editor:   { color: '#60a5fa', icon: '✂' },  // blue
  Planner:  { color: '#a78bfa', icon: '◈' },  // purple
  Animator: { color: '#34d399', icon: '◆' },  // green
  Reviewer: { color: '#fbbf24', icon: '◉' },  // amber
};

const DEFAULT_AGENT_STYLE = { color: 'var(--editor-text-muted)', icon: '●' };

/** Detect sandbox pipeline by presence of new-pipeline phase names */
function detectJobType(phase: string, jobType?: string): string {
  if (jobType && PHASES_BY_JOB[jobType]) return jobType;
  const sandboxPhases = ['trimming', 'planning', 'editing', 'generating', 'reviewing', 'assembling'];
  if (sandboxPhases.includes(phase)) return 'sandbox-pipeline';
  return jobType || 'generate-visuals';
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

const DEFAULT_PHASES = PHASES_BY_JOB['generate-visuals']!;

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  phase,
  phaseName,
  detail,
  isActive,
  error,
  jobType,
  agentName,
  trackName,
  estimatedTimeRemaining,
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

  const resolvedJobType = detectJobType(phase, jobType);
  const phases = PHASES_BY_JOB[resolvedJobType] || DEFAULT_PHASES;

  // Resolve aliases (e.g. self_heal → verify, workspace → plan)
  const resolvedPhase = PHASE_ALIASES[phase] ?? phase;

  // Determine current phase index
  const currentPhaseIdx = (() => {
    if (resolvedPhase === 'done' || resolvedPhase === 'complete') return phases.length;

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
  const isDone = phase === 'done' || phase === 'complete';

  const agentStyle = agentName ? (AGENT_STYLES[agentName] || DEFAULT_AGENT_STYLE) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>

      {/* ---- Agent + Status Row ---- */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 22,
      }}>
        {/* Agent badge */}
        {agentStyle && agentName && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: agentStyle.color,
            backgroundColor: `color-mix(in srgb, ${agentStyle.color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${agentStyle.color} 25%, transparent)`,
            flexShrink: 0,
            textTransform: 'uppercase',
          }}>
            <span style={{ fontSize: 9 }}>{agentStyle.icon}</span>
            {agentName}
          </span>
        )}

        {/* Track badge */}
        {trackName && (
          <span style={{
            fontSize: 11,
            color: 'var(--editor-text-muted)',
            padding: '2px 6px',
            borderRadius: 3,
            backgroundColor: 'var(--editor-bg-hover)',
            flexShrink: 0,
          }}>
            {trackName}
          </span>
        )}

        {/* Status text — fills remaining space */}
        <span style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 500,
          color: error ? 'rgb(239, 68, 68)' : 'var(--editor-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {phaseName}
          {detail && (
            <span style={{ color: 'var(--editor-text-muted)', fontWeight: 400 }}> — {detail}</span>
          )}
        </span>

        {/* ETA or percent */}
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: error
            ? 'rgb(239, 68, 68)'
            : isDone
              ? barColor
              : 'var(--editor-text-secondary)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {estimatedTimeRemaining != null && estimatedTimeRemaining > 0 && isActive && !error && (
            <span style={{
              color: 'var(--editor-text-muted)',
              fontWeight: 400,
              fontSize: 10,
            }}>
              ~{formatEta(estimatedTimeRemaining)}
            </span>
          )}
          {roundedPercent}%
        </span>
      </div>

      {/* ---- Progress Bar ---- */}
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
          background: isDone
            ? barColor
            : error
              ? barColor
              : agentStyle
                ? `linear-gradient(90deg, ${agentStyle.color}, color-mix(in srgb, ${agentStyle.color} 60%, white))`
                : `linear-gradient(90deg, var(--editor-accent), color-mix(in srgb, var(--editor-accent) 70%, white))`,
          borderRadius: 3,
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

      {/* ---- Phase Timeline ---- */}
      {phases.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 0,
          alignItems: 'center',
          fontSize: 10,
          marginTop: 2,
        }}>
          {phases.map((p, i) => {
            const isComplete = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx && !isDone;

            // For the active phase, tint with agent color
            const phaseColor = isComplete
              ? barColor
              : isCurrent && agentStyle
                ? agentStyle.color
                : isCurrent
                  ? 'var(--editor-text-primary)'
                  : 'var(--editor-text-muted)';

            return (
              <React.Fragment key={p.id}>
                {i > 0 && (
                  <div style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: isComplete
                      ? `color-mix(in srgb, ${barColor} 50%, transparent)`
                      : 'var(--editor-border-default)',
                    transition: 'background-color 300ms ease',
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 4px',
                  borderRadius: 3,
                  color: phaseColor,
                  fontWeight: isCurrent ? 600 : 400,
                  ...(isCurrent ? { backgroundColor: 'var(--editor-bg-hover)' } : {}),
                  transition: 'all 300ms ease',
                }}>
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: isComplete
                      ? barColor
                      : isCurrent
                        ? phaseColor
                        : 'var(--editor-border-default)',
                    ...(isCurrent && !error ? { animation: 'pulse 2s infinite' } : {}),
                    transition: 'background-color 300ms ease',
                  }} />
                  {p.label}
                </div>
              </React.Fragment>
            );
          })}
          {/* Done indicator at end */}
          {isDone && (
            <>
              <div style={{
                flex: 1,
                height: 1,
                backgroundColor: `color-mix(in srgb, ${barColor} 50%, transparent)`,
              }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 4px',
                color: barColor,
                fontWeight: 600,
                fontSize: 10,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  backgroundColor: barColor,
                }} />
                Done
              </div>
            </>
          )}
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
