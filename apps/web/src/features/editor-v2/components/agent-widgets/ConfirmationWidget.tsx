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
        confirmed ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'
      }`}>
        {confirmed ? 'Confirmed' : 'Declined'}
      </div>
    );
  }

  return (
    <div className="my-2 p-3 border border-[var(--editor-border-subtle)] rounded-lg bg-[var(--editor-bg-hover)]">
      <p className="text-sm text-[var(--editor-text-primary)] mb-2">{message}</p>
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
          className="px-3 py-1.5 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)] text-[var(--editor-text-secondary)] text-sm rounded-md transition-colors disabled:opacity-50"
        >
          No
        </button>
      </div>
    </div>
  );
}
