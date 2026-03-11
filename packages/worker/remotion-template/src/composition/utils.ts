import { interpolate } from 'remotion';
import type { Rect, DisplayMode, LayoutSegment, SplitSettings } from './types';

const TRANSITION_FRAMES = 12;

export function getRectsForMode(
  mode: DisplayMode,
  canvasWidth: number,
  canvasHeight: number,
  split: SplitSettings,
  overlayOpacity?: number,
): { videoRect: Rect; visualsRect: Rect; opacity: number } {
  const gap = split.gap || 0;
  const ratio = (split.ratio || 50) / 100;
  const visualsFirst = split.position === 'visuals-first';

  switch (mode) {
    case 'fullscreen':
      return {
        videoRect: { x: 0, y: canvasHeight, w: canvasWidth, h: 0 },
        visualsRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        opacity: 1.0,
      };
    case 'overlay':
      return {
        videoRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        visualsRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        opacity: overlayOpacity ?? 0.85,
      };
    case 'default':
    default: {
      const visualsH = Math.round((canvasHeight - gap) * ratio);
      const videoH = Math.round((canvasHeight - gap) * (1 - ratio));
      if (visualsFirst) {
        return {
          videoRect: { x: 0, y: visualsH + gap, w: canvasWidth, h: videoH },
          visualsRect: { x: 0, y: 0, w: canvasWidth, h: visualsH },
          opacity: 1.0,
        };
      } else {
        return {
          videoRect: { x: 0, y: 0, w: canvasWidth, h: videoH },
          visualsRect: { x: 0, y: videoH + gap, w: canvasWidth, h: visualsH },
          opacity: 1.0,
        };
      }
    }
  }
}

export function interpolateRect(from: Rect, to: Rect, frame: number, transStart: number, transEnd: number): Rect {
  const range = [transStart, transEnd] as [number, number];
  const opts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
  return {
    x: interpolate(frame, range, [from.x, to.x], opts),
    y: interpolate(frame, range, [from.y, to.y], opts),
    w: interpolate(frame, range, [from.w, to.w], opts),
    h: interpolate(frame, range, [from.h, to.h], opts),
  };
}

export function computeLayoutForFrame(
  frame: number,
  segments: LayoutSegment[],
  canvasWidth: number,
  canvasHeight: number,
  split: SplitSettings,
): { videoRect: Rect; visualsRect: Rect; visualsOpacity: number } {
  if (segments.length === 0) {
    const { videoRect, visualsRect, opacity } = getRectsForMode('default', canvasWidth, canvasHeight, split);
    return { videoRect, visualsRect, visualsOpacity: opacity };
  }

  // Find which segment contains the current frame.
  // Default to last segment for frames past the end.
  let segIdx = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    if (frame < segments[i].endFrame) {
      segIdx = i;
      break;
    }
  }

  const currentSeg = segments[segIdx];
  const currentRects = getRectsForMode(currentSeg.displayMode, canvasWidth, canvasHeight, split, currentSeg.overlayOpacity);

  if (segIdx > 0) {
    const prevSeg = segments[segIdx - 1];
    const transStart = currentSeg.startFrame;
    const transEnd = transStart + TRANSITION_FRAMES;

    if (frame < transEnd && prevSeg.displayMode !== currentSeg.displayMode) {
      const prevRects = getRectsForMode(prevSeg.displayMode, canvasWidth, canvasHeight, split, prevSeg.overlayOpacity);
      const videoRect = interpolateRect(prevRects.videoRect, currentRects.videoRect, frame, transStart, transEnd);
      const visualsRect = interpolateRect(prevRects.visualsRect, currentRects.visualsRect, frame, transStart, transEnd);
      const visualsOpacity = interpolate(
        frame,
        [transStart, transEnd],
        [prevRects.opacity, currentRects.opacity],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      return { videoRect, visualsRect, visualsOpacity };
    }
  }

  return {
    videoRect: currentRects.videoRect,
    visualsRect: currentRects.visualsRect,
    visualsOpacity: currentRects.opacity,
  };
}
