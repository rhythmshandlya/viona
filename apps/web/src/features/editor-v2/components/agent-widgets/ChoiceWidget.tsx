import React from 'react';
import { Check } from 'lucide-react';

interface ChoiceOption {
  label: string;
  value: string;
}

interface ChoiceWidgetProps {
  options: ChoiceOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  selectedValue?: string;
}

export function ChoiceWidget({ options, onSelect, disabled, selectedValue }: ChoiceWidgetProps) {
  if (selectedValue !== undefined) {
    const selected = options.find((o) => o.value === selectedValue);
    return (
      <div className="my-2 px-3 py-2 rounded-lg bg-[var(--editor-accent-soft)] border border-[var(--editor-accent)]/20 text-xs text-[var(--editor-accent)] flex items-center gap-1.5">
        <Check className="w-3 h-3" />
        {selected?.label || selectedValue}
      </div>
    );
  }

  return (
    <div className="my-2 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          disabled={disabled}
          className="px-4 py-2 rounded-lg border border-[var(--editor-border-subtle)]
                     bg-[var(--editor-bg-hover)] hover:border-[var(--editor-accent)]/50 hover:bg-[var(--editor-accent-soft)]
                     text-sm text-[var(--editor-text-primary)]
                     active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
