import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';

interface TypewriterPaperProps {
  translateY: number;
  lineCount: number;
  children: React.ReactNode;
}

/**
 * Paper background that scrolls upward as typing progresses.
 * Fresh white paper (age: 0.1) with horizontal rule lines every 60px.
 */
export function TypewriterPaper({ translateY, lineCount, children }: TypewriterPaperProps) {
  // Paper height needs to accommodate all lines with generous padding
  const paperHeight = Math.max(1920, lineCount * 200 + 600);
  const ruleLines: React.ReactNode[] = [];

  for (let y = 60; y < paperHeight; y += 60) {
    ruleLines.push(
      <div
        key={y}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: y,
          height: 1,
          backgroundColor: MAGAZINE_COLORS.accent,
          opacity: 0.1,
        }}
      />,
    );
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: paperHeight,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Fresh white paper texture */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          <PaperTexture age={0.1} opacity={1} seed="typewriter-paper" />
        </div>

        {/* Horizontal rule lines */}
        {ruleLines}

        {/* Content overlaid on paper */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
}
