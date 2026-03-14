'use client';

import React, { useState, useRef, useCallback } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value, onChange, min, max, step = 1, unit, label, className,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const dragStartRef = useRef<{ x: number; value: number } | null>(null);

  const clamp = useCallback((v: number) => {
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return Math.round(v / step) * step;
  }, [min, max, step]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (editing) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, value };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      let multiplier = step;
      if (e.shiftKey) multiplier = step * 10;
      if (e.altKey) multiplier = step * 0.1;
      const newValue = clamp(dragStartRef.current.value + dx * multiplier);
      onChange(newValue);
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [editing, value, step, clamp, onChange]);

  const handleDoubleClick = () => {
    setEditing(true);
    setEditValue(String(value));
  };

  const commitEdit = () => {
    setEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  };

  return (
    <div
      className={`flex items-center gap-1 rounded px-2 py-1 select-none cursor-ew-resize ${className ?? ''}`}
      style={{
        backgroundColor: 'var(--editor-bg-elevated)',
        border: '1px solid var(--editor-border-default)',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {label && (
        <span
          className="text-xs w-4 shrink-0"
          style={{ color: 'var(--editor-text-muted)' }}
        >
          {label}
        </span>
      )}
      {editing ? (
        <input
          className="bg-transparent text-sm w-full outline-none"
          style={{ color: 'var(--editor-text-primary)' }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
          autoFocus
        />
      ) : (
        <span
          className="text-sm"
          style={{ color: 'var(--editor-text-primary)' }}
        >
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
      )}
      {unit && (
        <span
          className="text-xs ml-auto"
          style={{ color: 'var(--editor-text-muted)' }}
        >
          {unit}
        </span>
      )}
    </div>
  );
};
