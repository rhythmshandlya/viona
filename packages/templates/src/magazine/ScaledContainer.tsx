import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

/**
 * Wraps template content and applies uniform CSS scaling so templates
 * designed for a fixed canvas (e.g. 1080x1920) render correctly at any size.
 *
 * At the designed resolution, ratio = 1 (no-op, zero visual change).
 * At smaller sizes, content scales proportionally instead of clipping.
 */
export function ScaledContainer({
  baseWidth,
  baseHeight,
  children,
}: {
  baseWidth: number;
  baseHeight: number;
  children: React.ReactNode;
}) {
  const { width, height } = useVideoConfig();

  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;
  const ratio = Math.min(scaleX, scaleY);

  const offsetX = (width - baseWidth * ratio) / 2;
  const offsetY = (height - baseHeight * ratio) / 2;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${ratio})`,
          transformOrigin: '0 0',
          position: 'absolute',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}
