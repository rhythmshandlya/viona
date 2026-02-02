import React from 'react';
import { useVideoConfig } from 'remotion';

interface SafeZoneProps {
  /** Additional padding multiplier (default: 1) */
  padding?: number;
  /** Children to render in the safe zone */
  children: React.ReactNode;
  /** Background color (optional) */
  background?: string;
  /** Flex direction (default: 'column') */
  direction?: 'row' | 'column';
  /** Horizontal alignment */
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  /** Vertical alignment */
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  /** Gap between children as percentage of minDim */
  gap?: number;
}

/**
 * SafeZone - Container that respects subtitle safe zone
 *
 * Automatically reserves bottom 15% for subtitles and adds safe margins.
 * Use this for ALL main content to ensure nothing overlaps subtitles.
 *
 * @example
 * <SafeZone>
 *   <Title>My Video</Title>
 *   <Diagram />
 * </SafeZone>
 *
 * @example
 * <SafeZone direction="row" gap={3}>
 *   <LeftPanel />
 *   <RightPanel />
 * </SafeZone>
 */
export const SafeZone: React.FC<SafeZoneProps> = ({
  padding = 1,
  children,
  background,
  direction = 'column',
  alignItems = 'center',
  justifyContent = 'flex-start',
  gap = 2,
}) => {
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Safe margins
  const sidePadding = minDim * 0.04 * padding;
  const topPadding = minDim * 0.04 * padding;
  const bottomPadding = height * 0.15; // 15% for subtitles

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        paddingTop: topPadding,
        paddingLeft: sidePadding,
        paddingRight: sidePadding,
        paddingBottom: bottomPadding,
        display: 'flex',
        flexDirection: direction,
        alignItems,
        justifyContent,
        gap: minDim * (gap / 100),
        background,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

export default SafeZone;
