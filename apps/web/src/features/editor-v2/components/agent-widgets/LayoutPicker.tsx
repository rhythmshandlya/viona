import React from 'react';

const layouts = [
  {
    id: 'pip',
    label: 'Picture-in-Picture',
    description: 'Visuals fullscreen, video as overlay',
    icon: (
      <div className="w-12 h-16 border border-white/30 rounded relative">
        <div className="absolute bottom-1 right-1 w-4 h-4 bg-white/40 rounded-sm" />
      </div>
    ),
  },
  {
    id: 'split-horizontal',
    label: 'Side by Side',
    description: 'Video and visuals next to each other',
    icon: (
      <div className="w-12 h-16 border border-white/30 rounded flex">
        <div className="w-1/2 bg-white/20" />
        <div className="w-1/2 bg-white/10" />
      </div>
    ),
  },
  {
    id: 'split-vertical',
    label: 'Stacked',
    description: 'Video and visuals above/below',
    icon: (
      <div className="w-12 h-16 border border-white/30 rounded flex flex-col">
        <div className="h-1/2 bg-white/20" />
        <div className="h-1/2 bg-white/10" />
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
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 hover:border-white/20 bg-white/5'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex justify-center mb-2">{layout.icon}</div>
          <div className="text-xs font-medium text-white">{layout.label}</div>
        </button>
      ))}
    </div>
  );
}
