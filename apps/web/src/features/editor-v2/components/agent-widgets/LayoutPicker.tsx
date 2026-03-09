import React from 'react';

const layouts = [
  {
    id: 'pip',
    label: 'Picture-in-Picture',
    description: 'Visuals fill screen, video as overlay',
    icon: (
      <div className="w-12 h-16 border border-[var(--editor-border-default)] rounded relative bg-[var(--editor-bg-hover)]">
        <div className="absolute bottom-1 right-1 w-4 h-4 bg-[var(--editor-text-muted)] rounded-sm" />
      </div>
    ),
  },
  {
    id: 'stacked',
    label: 'Stacked',
    description: 'Video and visuals above/below',
    icon: (
      <div className="w-12 h-16 border border-[var(--editor-border-default)] rounded flex flex-col overflow-hidden">
        <div className="h-1/2 bg-[var(--editor-text-muted)]/30" />
        <div className="h-1/2 bg-[var(--editor-bg-hover)]" />
      </div>
    ),
  },
];

interface LayoutPickerProps {
  onSelect: (layoutId: string) => void;
  disabled?: boolean;
  selectedValue?: string;
}

export function LayoutPicker({ onSelect, disabled, selectedValue }: LayoutPickerProps) {
  return (
    <div className="flex gap-2 my-2">
      {layouts.map(layout => (
        <button
          key={layout.id}
          onClick={() => !disabled && onSelect(layout.id)}
          disabled={disabled}
          className={`flex-1 p-3 rounded-lg border text-center transition-all ${
            selectedValue === layout.id
              ? 'border-[var(--editor-accent)] bg-[var(--editor-accent-soft)]'
              : 'border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)] bg-[var(--editor-bg-hover)]'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex justify-center mb-2">{layout.icon}</div>
          <div className="text-xs font-medium text-[var(--editor-text-primary)]">{layout.label}</div>
        </button>
      ))}
    </div>
  );
}
