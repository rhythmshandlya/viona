'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '../../store/use-editor-store';

interface CurveEditorProps {
  itemId: string;
  keyframeIndex: number;
  currentEasing: string;
}

type BezierPoints = [number, number, number, number];

const PRESETS: Record<string, BezierPoints> = {
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  spring: [0.25, 0.46, 0.45, 0.94],
};

/** Parse a bezier string into control points. Falls back to linear. */
function parseBezier(easing: string): BezierPoints {
  // Check presets first
  if (easing in PRESETS) return PRESETS[easing];

  // Parse cubic-bezier(x1, y1, x2, y2)
  const match = easing.match(
    /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
  );
  if (match) {
    return [
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
      parseFloat(match[4]),
    ];
  }

  return PRESETS.linear;
}

/** Convert control points to cubic-bezier string. */
function toBezierString(pts: BezierPoints): string {
  // Check if it matches a named preset
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (
      Math.abs(pts[0] - preset[0]) < 0.01 &&
      Math.abs(pts[1] - preset[1]) < 0.01 &&
      Math.abs(pts[2] - preset[2]) < 0.01 &&
      Math.abs(pts[3] - preset[3]) < 0.01
    ) {
      return name;
    }
  }
  return `cubic-bezier(${pts[0].toFixed(2)}, ${pts[1].toFixed(2)}, ${pts[2].toFixed(2)}, ${pts[3].toFixed(2)})`;
}

/** Build the SVG path `d` for a cubic bezier curve. */
function buildCurvePath(pts: BezierPoints): string {
  // SVG coordinate space: x 0-100, y 0-100 (y inverted: 0=top=value 1)
  const x1 = pts[0] * 100;
  const y1 = (1 - pts[1]) * 100;
  const x2 = pts[2] * 100;
  const y2 = (1 - pts[3]) * 100;
  return `M 0 100 C ${x1} ${y1}, ${x2} ${y2}, 100 0`;
}

export const CurveEditor: React.FC<CurveEditorProps> = ({
  itemId,
  keyframeIndex,
  currentEasing,
}) => {
  const updateKeyframeEasing = useEditorStore((s) => s.updateKeyframeEasing);
  const svgRef = useRef<SVGSVGElement>(null);

  const [points, setPoints] = useState<BezierPoints>(() =>
    parseBezier(currentEasing),
  );

  // Sync when prop changes externally
  const prevEasingRef = useRef(currentEasing);
  if (currentEasing !== prevEasingRef.current) {
    prevEasingRef.current = currentEasing;
    setPoints(parseBezier(currentEasing));
  }

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const handleDrag = useCallback(
    (cpIndex: 0 | 1, e: React.MouseEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const onMove = (ev: MouseEvent) => {
        const rect = svg.getBoundingClientRect();
        const x = clamp01((ev.clientX - rect.left) / rect.width);
        // y is inverted (SVG top = value 1)
        const y = clamp01(1 - (ev.clientY - rect.top) / rect.height);

        setPoints((prev) => {
          const next: BezierPoints = [...prev];
          if (cpIndex === 0) {
            next[0] = Math.round(x * 100) / 100;
            next[1] = Math.round(y * 100) / 100;
          } else {
            next[2] = Math.round(x * 100) / 100;
            next[3] = Math.round(y * 100) / 100;
          }
          return next;
        });
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        // Commit to store
        setPoints((current) => {
          const easingStr = toBezierString(current);
          updateKeyframeEasing(itemId, keyframeIndex, easingStr);
          return current;
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [itemId, keyframeIndex, updateKeyframeEasing],
  );

  const applyPreset = useCallback(
    (name: string) => {
      const pts = PRESETS[name];
      if (!pts) return;
      setPoints(pts);
      updateKeyframeEasing(itemId, keyframeIndex, name);
    },
    [itemId, keyframeIndex, updateKeyframeEasing],
  );

  // SVG positions (y inverted)
  const cp1x = points[0] * 100;
  const cp1y = (1 - points[1]) * 100;
  const cp2x = points[2] * 100;
  const cp2y = (1 - points[3]) * 100;

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        backgroundColor: 'var(--editor-bg-elevated)',
        border: '1px solid var(--editor-border-default)',
      }}
    >
      {/* SVG curve */}
      <div className="p-2">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="w-full aspect-square"
          style={{ backgroundColor: 'var(--editor-bg-elevated)' }}
        >
          {/* Grid lines */}
          <line
            x1="0" y1="50" x2="100" y2="50"
            stroke="var(--editor-border-default)"
            strokeWidth="0.5"
          />
          <line
            x1="50" y1="0" x2="50" y2="100"
            stroke="var(--editor-border-default)"
            strokeWidth="0.5"
          />

          {/* Diagonal reference (linear) */}
          <line
            x1="0" y1="100" x2="100" y2="0"
            stroke="var(--editor-border-default)"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />

          {/* Bezier curve */}
          <path
            d={buildCurvePath(points)}
            fill="none"
            stroke="var(--editor-accent)"
            strokeWidth="2"
          />

          {/* Control point 1 handle line */}
          <line
            x1="0" y1="100" x2={cp1x} y2={cp1y}
            stroke="var(--editor-accent-muted)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />

          {/* Control point 2 handle line */}
          <line
            x1="100" y1="0" x2={cp2x} y2={cp2y}
            stroke="var(--editor-accent-muted)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />

          {/* Endpoint dots */}
          <circle cx="0" cy="100" r="3" fill="var(--editor-text-muted)" />
          <circle cx="100" cy="0" r="3" fill="var(--editor-text-muted)" />

          {/* Draggable control point 1 */}
          <circle
            cx={cp1x}
            cy={cp1y}
            r="5"
            fill="var(--editor-accent)"
            stroke="var(--editor-bg-elevated)"
            strokeWidth="1.5"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleDrag(0, e)}
          />

          {/* Draggable control point 2 */}
          <circle
            cx={cp2x}
            cy={cp2y}
            r="5"
            fill="var(--editor-accent)"
            stroke="var(--editor-bg-elevated)"
            strokeWidth="1.5"
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleDrag(1, e)}
          />
        </svg>
      </div>

      {/* Preset buttons */}
      <div
        className="flex flex-wrap gap-1 px-2 pb-2"
      >
        {Object.keys(PRESETS).map((name) => {
          const isActive = toBezierString(points) === name;
          return (
            <button
              key={name}
              className="text-[10px] px-2 py-0.5 rounded transition-colors capitalize"
              style={{
                backgroundColor: isActive
                  ? 'var(--editor-accent-soft)'
                  : 'transparent',
                color: isActive
                  ? 'var(--editor-accent)'
                  : 'var(--editor-text-muted)',
                border: `1px solid ${isActive ? 'var(--editor-accent-muted)' : 'var(--editor-border-default)'}`,
              }}
              onClick={() => applyPreset(name)}
            >
              {name.replace('-', ' ')}
            </button>
          );
        })}
      </div>

      {/* Current value display */}
      <div
        className="px-2 pb-2 text-[10px] select-none"
        style={{ color: 'var(--editor-text-muted)' }}
      >
        {toBezierString(points)}
      </div>
    </div>
  );
};
