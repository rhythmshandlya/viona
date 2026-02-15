import React from 'react';

interface ConfirmationWidgetProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  confirmed?: boolean;
}

export function ConfirmationWidget({ message, onConfirm, onCancel, disabled, confirmed }: ConfirmationWidgetProps) {
  if (confirmed !== undefined) {
    return (
      <div className={`my-2 px-3 py-2 rounded-lg text-xs ${
        confirmed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
      }`}>
        {confirmed ? 'Confirmed' : 'Declined'}
      </div>
    );
  }

  return (
    <div className="my-2 p-3 border border-white/10 rounded-lg bg-white/5">
      <p className="text-sm text-white/80 mb-2">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
        >
          Yes
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="px-3 py-1.5 border border-white/20 hover:border-white/40 text-white/70 text-sm rounded-md transition-colors disabled:opacity-50"
        >
          No
        </button>
      </div>
    </div>
  );
}
