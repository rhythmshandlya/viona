'use client';

import React, { useState, useCallback } from 'react';
import { NumberInput } from './NumberInput';
import { KeyframeToggle } from './KeyframeToggle';
import { useEditorStore } from '../../store/use-editor-store';
import type { TimelineItem, Transform, Keyframe } from '../../store/types';

interface TransformTabProps {
  item: TimelineItem;
}

const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  width: '100%',
  height: '100%',
  rotation: 0,
  opacity: 1,
};

type TransformKey = keyof Transform;

/** Parse a number value that might be a string like "100%" */
function numVal(v: number | string): number {
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

export const TransformTab: React.FC<TransformTabProps> = ({ item }) => {
  const store = useEditorStore();
  const transform = item.transform ?? DEFAULT_TRANSFORM;
  const keyframes = item.keyframes ?? [];

  // Track which properties have keyframe mode active
  const [keyframeModes, setKeyframeModes] = useState<Record<string, boolean>>({});

  const toggleKeyframeMode = useCallback((prop: string) => {
    setKeyframeModes((prev) => ({ ...prev, [prop]: !prev[prop] }));
  }, []);

  const hasKeyframesForProp = useCallback(
    (prop: TransformKey) => keyframes.some((kf) => prop in (kf.props ?? {})),
    [keyframes],
  );

  const handleChange = useCallback(
    (prop: TransformKey, value: number) => {
      if (keyframeModes[prop]) {
        store.addKeyframeAtTime(item.id, store.currentTimeMs, { [prop]: value });
      } else {
        store.updateTransform(item.id, { [prop]: value });
      }
    },
    [store, item.id, keyframeModes],
  );

  const renderRow = (label: string, prop: TransformKey, opts: { min?: number; max?: number; step?: number; unit?: string }) => (
    <div className="flex items-center gap-2">
      <span
        className="text-xs w-16 shrink-0"
        style={{ color: 'var(--editor-text-muted)' }}
      >
        {label}
      </span>
      <NumberInput
        value={prop === 'opacity' ? numVal(transform[prop]) * 100 : numVal(transform[prop])}
        onChange={(v) => handleChange(prop, prop === 'opacity' ? v / 100 : v)}
        min={opts.min}
        max={opts.max}
        step={opts.step ?? 1}
        unit={opts.unit}
        className="flex-1"
      />
      <KeyframeToggle
        active={!!keyframeModes[prop]}
        hasKeyframes={hasKeyframesForProp(prop)}
        onClick={() => toggleKeyframeMode(prop)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Section: Position */}
      <div>
        <h4
          className="text-xs font-semibold mb-2"
          style={{ color: 'var(--editor-text-secondary)' }}
        >
          Position
        </h4>
        <div className="flex flex-col gap-1.5">
          {renderRow('X', 'x', { unit: 'px' })}
          {renderRow('Y', 'y', { unit: 'px' })}
        </div>
      </div>

      {/* Section: Size */}
      <div>
        <h4
          className="text-xs font-semibold mb-2"
          style={{ color: 'var(--editor-text-secondary)' }}
        >
          Size
        </h4>
        <div className="flex flex-col gap-1.5">
          {renderRow('Width', 'width', { min: 0, unit: 'px' })}
          {renderRow('Height', 'height', { min: 0, unit: 'px' })}
        </div>
      </div>

      {/* Section: Rotation & Opacity */}
      <div>
        <h4
          className="text-xs font-semibold mb-2"
          style={{ color: 'var(--editor-text-secondary)' }}
        >
          Appearance
        </h4>
        <div className="flex flex-col gap-1.5">
          {renderRow('Rotation', 'rotation', { min: -360, max: 360, unit: '\u00B0' })}
          {renderRow('Opacity', 'opacity', { min: 0, max: 100, unit: '%' })}
        </div>
      </div>

      {/* Keyframe count indicator */}
      {keyframes.length > 0 && (
        <div
          className="text-xs px-2 py-1 rounded"
          style={{
            color: 'var(--editor-accent)',
            backgroundColor: 'var(--editor-accent-soft)',
          }}
        >
          {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
