'use client';

import React, { useCallback } from 'react';
import { useSingleSelectedItem, useEditorStore } from '../store/use-editor-store';
import type { Transform } from '../store/types';

const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  width: '100%',
  height: '100%',
  rotation: 0,
  opacity: 1,
};

const NON_SPATIAL_TYPES = new Set(['audio', 'caption']);

/** Resolve a transform value (number or "100%") to a number for display */
function resolveValue(v: number | string, canvasSize: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.endsWith('%')) {
    return Math.round((parseFloat(v) / 100) * canvasSize);
  }
  return parseFloat(v) || 0;
}

interface FieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

function Field({ label, value, onChange, min, max, step = 1, unit }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-normal text-zinc-400 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white
                     focus:outline-none focus:border-purple-500 [appearance:textfield]
                     [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit && (
          <span className="text-[10px] text-zinc-500 shrink-0">{unit}</span>
        )}
      </div>
    </div>
  );
}

/**
 * ItemPropertiesPanel — standalone panel for editing the spatial transform
 * of a selected timeline item. Shows a 2-column grid of number inputs.
 */
export function ItemPropertiesPanel() {
  const item = useSingleSelectedItem();
  const store = useEditorStore();

  const canvasWidth = store.project?.videoSettings?.canvasWidth ?? 1080;
  const canvasHeight = store.project?.videoSettings?.canvasHeight ?? 1920;

  const handleChange = useCallback(
    (prop: keyof Transform, value: number) => {
      if (!item) return;
      store.updateTransform(item.id, { [prop]: value });
    },
    [store, item],
  );

  if (!item) {
    return (
      <div className="flex items-center justify-center h-32 px-4">
        <p className="text-xs text-zinc-500 text-center">
          Select an item to edit its properties
        </p>
      </div>
    );
  }

  if (NON_SPATIAL_TYPES.has(item.type)) {
    return (
      <div className="flex items-center justify-center h-32 px-4">
        <p className="text-xs text-zinc-500 text-center">
          This item type does not have spatial properties
        </p>
      </div>
    );
  }

  const transform = item.transform ?? DEFAULT_TRANSFORM;
  const x = resolveValue(transform.x, canvasWidth);
  const y = resolveValue(transform.y, canvasHeight);
  const w = resolveValue(transform.width, canvasWidth);
  const h = resolveValue(transform.height, canvasHeight);
  const rotation = typeof transform.rotation === 'number' ? transform.rotation : 0;
  const opacity = typeof transform.opacity === 'number' ? transform.opacity : 1;

  return (
    <div className="p-3 flex flex-col gap-3">
      <h4 className="text-xs font-normal text-zinc-300">Transform</h4>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X" value={x} onChange={(v) => handleChange('x', v)} unit="px" />
        <Field label="Y" value={y} onChange={(v) => handleChange('y', v)} unit="px" />
        <Field label="Width" value={w} onChange={(v) => handleChange('width', v)} min={0} unit="px" />
        <Field label="Height" value={h} onChange={(v) => handleChange('height', v)} min={0} unit="px" />
        <Field label="Rotation" value={rotation} onChange={(v) => handleChange('rotation', v)} min={-360} max={360} unit="deg" />
        <Field label="Opacity" value={opacity * 100} onChange={(v) => handleChange('opacity', v / 100)} min={0} max={100} unit="%" />
      </div>
    </div>
  );
}
