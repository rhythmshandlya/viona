'use client';

import React, { useCallback } from 'react';
import { NumberInput } from './NumberInput';
import { useEditorStore } from '../../store/use-editor-store';
import type { TimelineItem, Filters } from '../../store/types';

interface FiltersTabProps {
  item: TimelineItem;
}

interface FilterConfig {
  key: keyof Filters;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** Convert store value to UI display value */
  toDisplay: (v: number) => number;
  /** Convert UI display value to store value */
  toStore: (v: number) => number;
}

const FILTER_CONFIGS: FilterConfig[] = [
  {
    key: 'brightness', label: 'Brightness', unit: '%',
    min: 0, max: 200, step: 1, defaultValue: 1,
    toDisplay: (v) => v * 100, toStore: (v) => v / 100,
  },
  {
    key: 'contrast', label: 'Contrast', unit: '%',
    min: 0, max: 200, step: 1, defaultValue: 1,
    toDisplay: (v) => v * 100, toStore: (v) => v / 100,
  },
  {
    key: 'saturation', label: 'Saturation', unit: '%',
    min: 0, max: 200, step: 1, defaultValue: 1,
    toDisplay: (v) => v * 100, toStore: (v) => v / 100,
  },
  {
    key: 'blur', label: 'Blur', unit: 'px',
    min: 0, max: 50, step: 0.5, defaultValue: 0,
    toDisplay: (v) => v, toStore: (v) => v,
  },
  {
    key: 'hue', label: 'Hue Rotate', unit: '\u00B0',
    min: -180, max: 180, step: 1, defaultValue: 0,
    toDisplay: (v) => v, toStore: (v) => v,
  },
  {
    key: 'grayscale', label: 'Grayscale', unit: '%',
    min: 0, max: 100, step: 1, defaultValue: 0,
    toDisplay: (v) => v * 100, toStore: (v) => v / 100,
  },
  {
    key: 'sepia', label: 'Sepia', unit: '%',
    min: 0, max: 100, step: 1, defaultValue: 0,
    toDisplay: (v) => v * 100, toStore: (v) => v / 100,
  },
];

export const FiltersTab: React.FC<FiltersTabProps> = ({ item }) => {
  const store = useEditorStore();
  const filters = item.filters ?? {};

  const handleChange = useCallback(
    (key: keyof Filters, storeValue: number) => {
      store.updateFilters(item.id, { [key]: storeValue });
    },
    [store, item.id],
  );

  const handleReset = useCallback(
    (config: FilterConfig) => {
      store.updateFilters(item.id, { [config.key]: config.defaultValue });
    },
    [store, item.id],
  );

  const handleResetAll = useCallback(() => {
    const resetObj: Partial<Filters> = {};
    for (const cfg of FILTER_CONFIGS) {
      resetObj[cfg.key] = cfg.defaultValue;
    }
    store.updateFilters(item.id, resetObj);
  }, [store, item.id]);

  const hasAnyNonDefault = FILTER_CONFIGS.some(
    (cfg) => filters[cfg.key] !== undefined && filters[cfg.key] !== cfg.defaultValue,
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Reset All button */}
      {hasAnyNonDefault && (
        <button
          className="text-xs px-2 py-1 rounded self-end transition-colors"
          style={{
            color: 'var(--editor-accent)',
            backgroundColor: 'var(--editor-accent-soft)',
          }}
          onClick={handleResetAll}
        >
          Reset All Filters
        </button>
      )}

      {FILTER_CONFIGS.map((cfg) => {
        const storeVal = filters[cfg.key] ?? cfg.defaultValue;
        const displayVal = cfg.toDisplay(storeVal);
        const isNonDefault = storeVal !== cfg.defaultValue;

        return (
          <div key={cfg.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span
                className="text-xs"
                style={{ color: 'var(--editor-text-muted)' }}
              >
                {cfg.label}
              </span>
              {isNonDefault && (
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    color: 'var(--editor-text-muted)',
                    backgroundColor: 'var(--editor-bg-elevated)',
                  }}
                  onClick={() => handleReset(cfg)}
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={displayVal}
                onChange={(e) => handleChange(cfg.key, cfg.toStore(parseFloat(e.target.value)))}
                className="flex-1 h-1 rounded appearance-none cursor-pointer"
                style={{
                  accentColor: 'var(--editor-accent)',
                  backgroundColor: 'var(--editor-border-default)',
                }}
              />
              <NumberInput
                value={Math.round(displayVal * 10) / 10}
                onChange={(v) => handleChange(cfg.key, cfg.toStore(v))}
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                unit={cfg.unit}
                className="w-20 shrink-0"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
