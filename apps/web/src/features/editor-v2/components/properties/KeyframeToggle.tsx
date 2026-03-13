'use client';

import React from 'react';

interface KeyframeToggleProps {
  active: boolean;
  hasKeyframes: boolean;
  onClick: () => void;
}

export const KeyframeToggle: React.FC<KeyframeToggleProps> = ({
  active, hasKeyframes, onClick,
}) => {
  return (
    <button
      className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-[var(--editor-accent-soft)]'
          : ''
      }`}
      style={{
        color: active
          ? 'var(--editor-accent)'
          : hasKeyframes
            ? 'var(--editor-accent-muted)'
            : 'var(--editor-text-muted)',
      }}
      onClick={onClick}
      title={active ? 'Keyframe mode active' : 'Enable keyframe mode'}
    >
      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
        <rect x="3" y="3" width="6" height="6" transform="rotate(45 6 6)" />
      </svg>
    </button>
  );
};
