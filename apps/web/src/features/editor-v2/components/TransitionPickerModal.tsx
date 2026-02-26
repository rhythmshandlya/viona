'use client';

import React, { useEffect, useRef } from 'react';
import { useEditorActions, useItem, useTransitionPickerItemId } from '../store/use-editor-store';
import { VisualItemData } from '../store/types';

// ─── CSS keyframe animations injected once ───────────────────────────────────
const STYLES = `
@keyframes tp-cut {
  0%   { opacity: 1 }
  55%  { opacity: 1 }
  56%  { opacity: 0 }
  80%  { opacity: 0 }
  81%  { opacity: 1 }
  100% { opacity: 1 }
}
@keyframes tp-fade {
  0%   { opacity: 0 }
  30%  { opacity: 1 }
  65%  { opacity: 1 }
  88%  { opacity: 0 }
  100% { opacity: 0 }
}
@keyframes tp-zoom-in {
  0%   { opacity: 0; transform: scale(1.35) }
  30%  { opacity: 1; transform: scale(1.0) }
  65%  { opacity: 1; transform: scale(1.0) }
  88%  { opacity: 0; transform: scale(1.35) }
  100% { opacity: 0; transform: scale(1.35) }
}
@keyframes tp-zoom-out {
  0%   { opacity: 0; transform: scale(0.65) }
  30%  { opacity: 1; transform: scale(1.0) }
  65%  { opacity: 1; transform: scale(1.0) }
  88%  { opacity: 0; transform: scale(0.65) }
  100% { opacity: 0; transform: scale(0.65) }
}
`;

// ─── Transition definitions ───────────────────────────────────────────────────
const TRANSITIONS = [
  {
    type: 'cut' as const,
    label: 'Cut',
    description: 'Instant switch',
    animation: 'tp-cut 2.2s infinite',
    durationMs: 0,
  },
  {
    type: 'fade' as const,
    label: 'Fade',
    description: 'Smooth fade in & out',
    animation: 'tp-fade 2.2s infinite',
    durationMs: 300,
  },
  {
    type: 'zoom-in' as const,
    label: 'Zoom In',
    description: 'Scales from large to fit',
    animation: 'tp-zoom-in 2.2s infinite',
    durationMs: 300,
  },
  {
    type: 'zoom-out' as const,
    label: 'Zoom Out',
    description: 'Scales from small to fit',
    animation: 'tp-zoom-out 2.2s infinite',
    durationMs: 300,
  },
];

// ─── Tiny animated preview box ────────────────────────────────────────────────
function Preview({ animation }: { animation: string }) {
  return (
    <div
      style={{
        width: 88,
        height: 58,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#0d0d1a',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Static "video" layer — thin horizontal lines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, transparent 2px, transparent 6px)',
      }} />
      {/* Animated visual graphic */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation,
          transformOrigin: 'center center',
        }}
      >
        {/* Tiny content representation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 8px', width: '100%' }}>
          <div style={{ height: 3, width: '70%', background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
          <div style={{ height: 3, width: '50%', background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
          <div style={{ height: 3, width: '60%', background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
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
          borderRadius: 12,
          padding: 20,
          width: 360,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ color: 'var(--editor-text-primary, #e0e0e0)', fontSize: 14, fontWeight: 600 }}>
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

        {/* 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TRANSITIONS.map((t) => {
            const isSelected = currentType === t.type;
            return (
              <button
                key={t.type}
                onClick={() => apply(t.type, t.durationMs)}
                style={{
                  background: isSelected
                    ? 'rgba(99,102,241,0.15)'
                    : 'var(--editor-bg-elevated, rgba(255,255,255,0.04))',
                  border: isSelected
                    ? '1.5px solid #6366f1'
                    : '1.5px solid var(--editor-border-subtle, rgba(255,255,255,0.08))',
                  borderRadius: 8,
                  padding: '10px 10px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 7,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.5)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--editor-border-subtle, rgba(255,255,255,0.08))';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--editor-bg-elevated, rgba(255,255,255,0.04))';
                  }
                }}
              >
                <Preview animation={t.animation} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    color: isSelected ? '#818cf8' : 'var(--editor-text-primary, #e0e0e0)',
                    fontSize: 12, fontWeight: 600, marginBottom: 2,
                  }}>
                    {t.label}
                  </div>
                  <div style={{ color: 'var(--editor-text-secondary, #888)', fontSize: 10 }}>
                    {t.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <p style={{ color: 'var(--editor-text-muted, #555)', fontSize: 10, textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
          Applied to both enter &amp; exit of this scene
        </p>
      </div>
    </div>
  );
}
