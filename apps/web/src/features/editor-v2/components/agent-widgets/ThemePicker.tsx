import React from 'react';

const themes = [
  { id: 'minimal', label: 'Minimal', description: 'Clean, geometric, monochrome', colors: ['#1a1a2e', '#e2e8f0', '#94a3b8'] },
  { id: 'modern', label: 'Modern', description: 'Vibrant gradients, purple-blue', colors: ['#0f0f23', '#8b5cf6', '#3b82f6'] },
  { id: 'playful', label: 'Playful', description: 'Bright, bouncy, energetic', colors: ['#fef3c7', '#f59e0b', '#ec4899'] },
  { id: 'bold', label: 'Bold', description: 'High contrast, impactful', colors: ['#0f172a', '#ef4444', '#f8fafc'] },
  { id: 'classic', label: 'Classic', description: 'Muted, elegant, professional', colors: ['#1e293b', '#d4c5a9', '#8b9dc3'] },
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
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 hover:border-white/20 bg-white/5'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex gap-1 mb-1.5">
            {theme.colors.map((color, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="text-sm font-medium text-white">{theme.label}</div>
          <div className="text-xs text-white/50">{theme.description}</div>
        </button>
      ))}
    </div>
  );
}
