import React from 'react';

const themes = [
  { id: 'studio-dark', label: 'Studio Dark', description: 'Polished cards, dot-grid, dark navy', colors: ['#0B0F1A', '#6366F1', '#EC4899'] },
  { id: 'studio-light', label: 'Studio Light', description: 'Same card system on light background', colors: ['#F8F9FB', '#6366F1', '#EC4899'] },
];

interface ThemePickerProps {
  onSelect: (themeId: string) => void;
  disabled?: boolean;
  selectedValue?: string;
}

export function ThemePicker({ onSelect, disabled, selectedValue }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 my-2">
      {themes.map(theme => (
        <button
          key={theme.id}
          onClick={() => !disabled && onSelect(theme.id)}
          disabled={disabled}
          className={`p-3 rounded-lg border text-left transition-all ${
            selectedValue === theme.id
              ? 'border-[var(--editor-accent)] bg-[var(--editor-accent-soft)]'
              : 'border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)] bg-[var(--editor-bg-hover)]'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex gap-1 mb-1.5">
            {theme.colors.map((color, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border border-black/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="text-sm font-normal text-[var(--editor-text-primary)]">{theme.label}</div>
          <div className="text-xs text-[var(--editor-text-muted)]">{theme.description}</div>
        </button>
      ))}
    </div>
  );
}
