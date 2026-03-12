/**
 * Renders visual scenes with overlapping Sequences for smooth transitions.
 *
 * When two adjacent scenes have transition config, their render windows
 * overlap by the transition duration. During the overlap, both scenes
 * render with transition effects (opacity, transform, etc.).
 */
import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { SceneItem, Rect, TransitionType } from './types';
import { computeTransitionStyle } from './transitions';
import { VisualsLayer } from './VisualsLayer';

interface SceneTransitionLayerProps {
  sceneItems: SceneItem[];
  renderScene: (sceneFile: string, frameOffset: number) => React.ReactNode;
  rect: Rect;
  opacity: number;
}

/**
 * Compute the overlap duration in frames between two adjacent scenes.
 * The overlap is determined by the max of scene1's exit and scene2's enter duration.
 */
function computeOverlapFrames(
  exitScene: SceneItem | undefined,
  enterScene: SceneItem | undefined,
  fps: number,
): number {
  if (!exitScene?.exit && !enterScene?.enter) return 0;

  const exitMs = exitScene?.exit?.durationMs ?? 0;
  const enterMs = enterScene?.enter?.durationMs ?? 0;
  const overlapMs = Math.max(exitMs, enterMs);

  if (overlapMs === 0) return 0;
  return Math.round((overlapMs / 1000) * fps);
}

interface RenderEntry {
  scene: SceneItem;
  effectiveStart: number;
  effectiveEnd: number;
  enterType: TransitionType;
  enterOverlapStart: number;
  enterOverlapEnd: number;
  hasEnterTransition: boolean;
  exitType: TransitionType;
  exitOverlapStart: number;
  exitOverlapEnd: number;
  hasExitTransition: boolean;
}

export const SceneTransitionLayer: React.FC<SceneTransitionLayerProps> = ({
  sceneItems,
  renderScene,
  rect,
  opacity,
}) => {
  const { fps } = useVideoConfig();

  if (sceneItems.length === 0) return null;

  // Sort scenes by startFrame
  const sorted = [...sceneItems].sort((a, b) => a.startFrame - b.startFrame);

  // Build render entries with extended windows for transitions
  const entries: RenderEntry[] = sorted.map((scene, idx) => {
    const prevScene = idx > 0 ? sorted[idx - 1] : undefined;
    const nextScene = idx < sorted.length - 1 ? sorted[idx + 1] : undefined;

    // Overlap with previous scene (this scene is entering)
    // Use floor+ceil split so enterHalf + exitHalf on the other scene = total overlap
    const enterOverlapFrames = computeOverlapFrames(prevScene, scene, fps);
    const enterHalf = Math.floor(enterOverlapFrames / 2);

    // Overlap with next scene (this scene is exiting)
    const exitOverlapFrames = computeOverlapFrames(scene, nextScene, fps);
    const exitHalf = Math.ceil(exitOverlapFrames / 2);

    // Extended render window
    const effectiveStart = scene.startFrame - enterHalf;
    const effectiveEnd = scene.endFrame + exitHalf;

    return {
      scene,
      effectiveStart,
      effectiveEnd,
      // Enter transition info
      enterType: scene.enter?.type ?? prevScene?.exit?.type ?? 'cut',
      enterOverlapStart: scene.startFrame - enterHalf,
      enterOverlapEnd: scene.startFrame + enterHalf,
      hasEnterTransition: enterOverlapFrames > 0,
      // Exit transition info
      exitType: scene.exit?.type ?? nextScene?.enter?.type ?? 'cut',
      exitOverlapStart: scene.endFrame - exitHalf,
      exitOverlapEnd: scene.endFrame + exitHalf,
      hasExitTransition: exitOverlapFrames > 0,
    };
  });

  return (
    <VisualsLayer rect={rect} opacity={opacity}>
      {entries.map((entry) => {
        const { scene, effectiveStart, effectiveEnd } = entry;
        const durationFrames = effectiveEnd - effectiveStart;

        if (durationFrames <= 0) return null;

        return (
          <Sequence
            key={scene.id}
            from={effectiveStart}
            durationInFrames={durationFrames}
            layout="none"
          >
            <SceneWithTransitions entry={entry} renderScene={renderScene} />
          </Sequence>
        );
      })}
    </VisualsLayer>
  );
};

/**
 * Inner component that applies enter/exit transitions.
 * Must be inside a <Sequence> so useCurrentFrame() is relative.
 */
const SceneWithTransitions: React.FC<{
  entry: RenderEntry;
  renderScene: (sceneFile: string, frameOffset: number) => React.ReactNode;
}> = ({ entry, renderScene }) => {
  const frame = useCurrentFrame();
  const { scene } = entry;

  // useCurrentFrame() is relative inside Sequence.
  // Reconstruct absolute frame for comparison with absolute overlap boundaries.
  const absFrame = entry.effectiveStart + frame;

  let style: React.CSSProperties = { position: 'absolute', inset: 0 };

  // Apply enter transition
  if (entry.hasEnterTransition && absFrame < entry.enterOverlapEnd) {
    const progress = interpolate(
      absFrame,
      [entry.enterOverlapStart, entry.enterOverlapEnd],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const transStyle = computeTransitionStyle(entry.enterType, progress, false);
    style = { ...style, ...transStyle };
  }

  // Apply exit transition
  if (entry.hasExitTransition && absFrame >= entry.exitOverlapStart) {
    const progress = interpolate(
      absFrame,
      [entry.exitOverlapStart, entry.exitOverlapEnd],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const transStyle = computeTransitionStyle(entry.exitType, progress, true);
    style = { ...style, ...transStyle };
  }

  return (
    <div style={style}>
      {renderScene(scene.sceneFile, scene.frameOffset ?? 0)}
    </div>
  );
};
