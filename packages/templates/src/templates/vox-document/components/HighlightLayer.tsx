import React from 'react';
import { useCurrentFrame } from 'remotion';
import { HighlighterMark } from '../../../vox/effects';
import { highlighterSweep } from '../../../vox/animations';
import { VOX_COLORS } from '../../../vox/constants';
import type { BBox } from './usePdfTextMap';

interface HighlightLayerProps {
  /** Array of highlight groups — each group is an array of BBoxes (one per line) */
  highlightGroups: BBox[][];
  /** Frame at which the first highlight starts sweeping */
  startFrame: number;
  /** Frames between each highlight group */
  groupStagger: number;
  /** Frames between lines within a group */
  lineStagger: number;
  /** Paper dimensions in pixels (for converting percentage BBoxes to px) */
  paperWidth: number;
  paperHeight: number;
}

export const HighlightLayer: React.FC<HighlightLayerProps> = ({
  highlightGroups,
  startFrame,
  groupStagger,
  lineStagger,
  paperWidth,
  paperHeight,
}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
      {highlightGroups.map((lines, groupIdx) =>
        lines.map((bbox, lineIdx) => {
          const sweepStart = startFrame + groupIdx * groupStagger + lineIdx * lineStagger;
          const sweep = highlighterSweep(frame, sweepStart);

          if (sweep.widthPercent <= 0) return null;

          const left = (bbox.x / 100) * paperWidth;
          const top = (bbox.y / 100) * paperHeight;
          const width = (bbox.w / 100) * paperWidth;
          const height = (bbox.h / 100) * paperHeight;

          return (
            <div
              key={`${groupIdx}-${lineIdx}`}
              style={{
                position: 'absolute',
                left,
                top: top - height * 0.15,
                width,
                height: height * 1.3,
              }}
            >
              <HighlighterMark
                widthPercent={sweep.widthPercent}
                height={height * 1.3}
                rotation={0.4 + groupIdx * 0.15}
                yOffset={0}
                color={VOX_COLORS.highlight}
                opacity={0.85}
              />
            </div>
          );
        }),
      )}
    </div>
  );
};
