'use client';

import React, { useEffect, useRef } from 'react';
import { useEditorActions, useItem, useTransitionPickerItemId } from '../store/use-editor-store';
import { VisualItemData } from '../store/types';

// ─── CSS keyframe animations for live previews ──────────────────────────────
const STYLES = `
@keyframes tp-cut-a {
  0%   { opacity: 1 }
  50%  { opacity: 1 }
  50.1%{ opacity: 0 }
  100% { opacity: 0 }
}
@keyframes tp-cut-b {
  0%   { opacity: 0 }
  50%  { opacity: 0 }
  50.1%{ opacity: 1 }
  100% { opacity: 1 }
}
@keyframes tp-fade-a {
  0%   { opacity: 1 }
  40%  { opacity: 1 }
  60%  { opacity: 0 }
  100% { opacity: 0 }
}
@keyframes tp-fade-b {
  0%   { opacity: 0 }
  40%  { opacity: 0 }
  60%  { opacity: 1 }
  100% { opacity: 1 }
}
@keyframes tp-zoomin-a {
  0%   { opacity: 1; transform: scale(1) }
  40%  { opacity: 1; transform: scale(1) }
  60%  { opacity: 0; transform: scale(0.6) }
  100% { opacity: 0; transform: scale(0.6) }
}
@keyframes tp-zoomin-b {
  0%   { opacity: 0; transform: scale(1.5) }
  40%  { opacity: 0; transform: scale(1.5) }
  60%  { opacity: 1; transform: scale(1) }
  100% { opacity: 1; transform: scale(1) }
}
@keyframes tp-zoomout-a {
  0%   { opacity: 1; transform: scale(1) }
  40%  { opacity: 1; transform: scale(1) }
  60%  { opacity: 0; transform: scale(1.5) }
  100% { opacity: 0; transform: scale(1.5) }
}
@keyframes tp-zoomout-b {
  0%   { opacity: 0; transform: scale(0.6) }
  40%  { opacity: 0; transform: scale(0.6) }
  60%  { opacity: 1; transform: scale(1) }
  100% { opacity: 1; transform: scale(1) }
}
`;

// ─── Transition definitions ───────────────────────────────────────────────────
const TRANSITIONS = [
  {
    type: 'cut' as const,
    label: 'Cut',
    description: 'Instant switch between scenes',
    animA: 'tp-cut-a 2.4s ease infinite',
    animB: 'tp-cut-b 2.4s ease infinite',
    durationMs: 0,
  },
  {
    type: 'fade' as const,
    label: 'Fade',
    description: 'Smooth crossfade',
    animA: 'tp-fade-a 2.4s ease infinite',
    animB: 'tp-fade-b 2.4s ease infinite',
    durationMs: 300,
  },
  {
    type: 'zoom-in' as const,
    label: 'Zoom In',
    description: 'Zooms in from large',
    animA: 'tp-zoomin-a 2.4s ease infinite',
    animB: 'tp-zoomin-b 2.4s ease infinite',
    durationMs: 300,
  },
  {
    type: 'zoom-out' as const,
    label: 'Zoom Out',
    description: 'Zooms out from small',
    animA: 'tp-zoomout-a 2.4s ease infinite',
    animB: 'tp-zoomout-b 2.4s ease infinite',
    durationMs: 300,
  },
];

// ─── Animated scene-transition preview ───────────────────────────────────────
// Shows two "scenes" (A in blue, B in purple) transitioning into each other
function TransitionPreview({ animA, animB }: { animA: string; animB: string }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#0a0a14',
        position: 'relative',
      }}
    >
      {/* Scene A — blue tones */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          animation: animA,
          transformOrigin: 'center center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <div style={{ width: '50%', height: 4, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
        <div style={{ width: '35%', height: 3, background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
        <div style={{
          position: 'absolute', bottom: 4, left: 6,
          fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em',
        }}>
          A
        </div>
      </div>

      {/* Scene B — purple tones */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
          animation: animB,
          transformOrigin: 'center center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <div style={{ width: '40%', height: 4, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
        <div style={{ width: '55%', height: 3, background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
        <div style={{
          position: 'absolute', bottom: 4, left: 6,
          fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em',
        }}>
          B
        </div>
      </div>
    </div>
  );
}

// ─── Static SVG icon for each transition type ────────────────────────────────
function TransitionIcon({ type, color }: { type: string; color: string }) {
  const dim = color === '#818cf8' ? '#818cf8' : '#9ca3af';
  const fill = color === '#818cf8' ? 'rgba(129,140,248,0.25)' : 'rgba(156,163,175,0.15)';

  if (type === 'cut') {
    // Two frames with sharp vertical cut line
    return (
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <rect x="1" y="2" width="11" height="16" rx="2" fill={fill} stroke={dim} strokeWidth="1.2"/>
        <rect x="16" y="2" width="11" height="16" rx="2" fill={fill} stroke={dim} strokeWidth="1.2"/>
        <line x1="14" y1="0" x2="14" y2="20" stroke={dim} strokeWidth="1.5" strokeDasharray="2 1.5"/>
      </svg>
    );
  }

  if (type === 'fade') {
    // Overlapping translucent frames
    return (
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <rect x="1" y="3" width="14" height="14" rx="2" fill={fill} stroke={dim} strokeWidth="1.2"/>
        <rect x="13" y="3" width="14" height="14" rx="2" fill={fill} stroke={dim} strokeWidth="1.2" strokeDasharray="2 1.5"/>
      </svg>
    );
  }

  if (type === 'zoom-in') {
    // Large dashed frame shrinking to solid inner frame, inward arrows
    return (
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <rect x="1" y="1" width="26" height="18" rx="2" stroke={dim} strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5"/>
        <rect x="6" y="4" width="16" height="12" rx="2" fill={fill} stroke={dim} strokeWidth="1.2"/>
        <path d="M3 3L7 5.5" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
        <path d="M25 3L21 5.5" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
        <path d="M3 17L7 14.5" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
        <path d="M25 17L21 14.5" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
      </svg>
    );
  }

  // zoom-out: Small inner frame expanding to large dashed frame, outward arrows
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
      <rect x="1" y="1" width="26" height="18" rx="2" stroke={dim} strokeWidth="1" strokeDasharray="2 1.5" opacity="0.5"/>
      <rect x="8" y="5" width="12" height="10" rx="2" fill={fill} stroke={dim} strokeWidth="1.2"/>
      <path d="M7 5.5L3 3" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
      <path d="M21 5.5L25 3" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
      <path d="M7 14.5L3 17" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
      <path d="M21 14.5L25 17" stroke={dim} strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Main modal component ─────────────────────────────────────────────────────
export function TransitionPickerModal() {
  const itemId = useTransitionPickerItemId();
  const item = useItem(itemId ?? '');
  const { updateVisualTransition, closeTransitionPicker } = useEditorActions();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Inject CSS keyframes once
  useEffect(() => {
    if (document.getElementById('tp-styles')) return;
    const el = document.createElement('style');
    el.id = 'tp-styles';
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!itemId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTransitionPicker(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [itemId, closeTransitionPicker]);

  if (!itemId || !item) return null;

  const currentType = (item.data as VisualItemData).transition?.enter?.type ?? 'fade';

  const apply = (type: typeof TRANSITIONS[number]['type'], durationMs: number) => {
    updateVisualTransition(itemId, {
      enter: { type, durationMs },
      exit:  { type, durationMs },
    });
    closeTransitionPicker();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) closeTransitionPicker(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--editor-bg-surface, #1a1a2e)',
          border: '1px solid var(--editor-border-subtle, rgba(255,255,255,0.08))',
          borderRadius: 14,
          padding: 24,
          width: 420,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ color: 'var(--editor-text-primary, #e0e0e0)', fontSize: 15, fontWeight: 600 }}>
            Scene Transition
          </span>
          <button
            onClick={closeTransitionPicker}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--editor-text-secondary, #888)', fontSize: 18, lineHeight: 1, padding: '2px 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* 2×2 icon grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TRANSITIONS.map((t) => {
            const isSelected = currentType === t.type;
            const accentColor = isSelected ? '#818cf8' : '#9ca3af';
            return (
              <button
                key={t.type}
                onClick={() => apply(t.type, t.durationMs)}
                style={{
                  background: isSelected
                    ? 'rgba(99,102,241,0.12)'
                    : 'var(--editor-bg-elevated, rgba(255,255,255,0.03))',
                  border: isSelected
                    ? '2px solid #6366f1'
                    : '2px solid transparent',
                  borderRadius: 10,
                  padding: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                  outline: 'none',
                  boxShadow: isSelected ? '0 0 0 1px rgba(99,102,241,0.3)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.4)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--editor-bg-elevated, rgba(255,255,255,0.03))';
                  }
                }}
              >
                {/* Animated preview showing A → B transition */}
                <TransitionPreview animA={t.animA} animB={t.animB} />

                {/* Icon + label row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px' }}>
                  <TransitionIcon type={t.type} color={accentColor} />
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{
                      color: isSelected ? '#818cf8' : 'var(--editor-text-primary, #e0e0e0)',
                      fontSize: 12, fontWeight: 600, lineHeight: '16px',
                    }}>
                      {t.label}
                    </div>
                    <div style={{
                      color: 'var(--editor-text-secondary, #888)',
                      fontSize: 10, lineHeight: '14px',
                    }}>
                      {t.description}
                    </div>
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" fill="#6366f1"/>
                      <path d="M5 8.5L7 10.5L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <p style={{ color: 'var(--editor-text-muted, #555)', fontSize: 10, textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
          Applied to both enter &amp; exit of this scene
        </p>
      </div>
    </div>
  );
}
