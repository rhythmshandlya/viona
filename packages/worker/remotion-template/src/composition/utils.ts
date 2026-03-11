import { interpolate } from 'remotion';
import type { Rect, DisplayMode, LayoutSegment, SplitSettings } from './types';

const TRANSITION_FRAMES = 12;

export function getRectsForMode(
  mode: DisplayMode,
  canvasWidth: number,
  canvasHeight: number,
  split: SplitSettings,
): { videoRect: Rect; visualsRect: Rect; opacity: number } {
  const gap = split.gap || 0;
  const ratio = (split.ratio || 50) / 100;
  const visualsFirst = split.position === 'visuals-first';

  // Pre-compute the stacked video anchor point so fullscreen transitions
  // collapse the video in-place at the split boundary (not off-canvas).
  const visualsH = Math.round((canvasHeight - gap) * ratio);
  const videoAnchorY = visualsFirst ? visualsH + gap : 0;

  switch (mode) {
    case 'fullscreen':
      return {
        // Video at canvas bottom so stacked ↔ fullscreen transitions
        // slide the video down off-screen while visuals expand from top.
        videoRect: { x: 0, y: canvasHeight, w: canvasWidth, h: 0 },
        visualsRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        opacity: 1.0,
      };
    case 'overlay':
      return {
        videoRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        visualsRect: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
        opacity: 1.0,
      };
    case 'default':
    default: {
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
  const currentRects = getRectsForMode(currentSeg.displayMode, canvasWidth, canvasHeight, split);

  if (segIdx > 0) {
    const prevSeg = segments[segIdx - 1];
    const transStart = currentSeg.startFrame;
    const transEnd = transStart + TRANSITION_FRAMES;

    if (frame < transEnd && prevSeg.displayMode !== currentSeg.displayMode) {
      const prevRects = getRectsForMode(prevSeg.displayMode, canvasWidth, canvasHeight, split);
      const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

      // Classify the transition pair
      const prev = prevSeg.displayMode;
      const curr = currentSeg.displayMode;

      let videoRect: Rect;
      let visualsRect: Rect;
      let visualsOpacity: number;

      if (prev === 'overlay' && curr === 'default') {
        // Overlay → Stacked: split-line sweeps from top.
        // Visuals grow from h=0, video shrinks — edges always touch, no overlap.
        const fromVideo = { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
        const fromVisuals = { x: 0, y: 0, w: canvasWidth, h: 0 };
        videoRect = interpolateRect(fromVideo, currentRects.videoRect, frame, transStart, transEnd);
        visualsRect = interpolateRect(fromVisuals, currentRects.visualsRect, frame, transStart, transEnd);
        visualsOpacity = 1.0;
      } else if (prev === 'default' && curr === 'overlay') {
        // Stacked → Overlay: reverse split-line — visuals shrink to h=0, video expands.
        const toVideo = { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
        const toVisuals = { x: 0, y: 0, w: canvasWidth, h: 0 };
        videoRect = interpolateRect(prevRects.videoRect, toVideo, frame, transStart, transEnd);
        visualsRect = interpolateRect(prevRects.visualsRect, toVisuals, frame, transStart, transEnd);
        visualsOpacity = 1.0;
      } else if ((prev === 'overlay' && curr === 'fullscreen') || (prev === 'fullscreen' && curr === 'overlay')) {
        // Overlay ↔ Fullscreen: both have fullscreen visuals at opacity 1.0.
        // Slide video off/on screen while visuals stay fullscreen.
        videoRect = interpolateRect(prevRects.videoRect, currentRects.videoRect, frame, transStart, transEnd);
        visualsRect = { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
        visualsOpacity = 1.0;
      } else if (prev === 'default' && curr === 'fullscreen') {
        // Stacked → Fullscreen: visuals expand, video slides down off-screen.
        // Use split-line approach — edges always touch.
        const t = interpolate(frame, [transStart, transEnd], [0, 1], clampOpts);
        const splitY = prevRects.visualsRect.y + prevRects.visualsRect.h +
          t * (canvasHeight - prevRects.visualsRect.y - prevRects.visualsRect.h);
        visualsRect = { x: 0, y: 0, w: canvasWidth, h: splitY };
        videoRect = { x: 0, y: splitY, w: canvasWidth, h: canvasHeight - splitY };
        visualsOpacity = 1.0;
      } else if (prev === 'fullscreen' && curr === 'default') {
        // Fullscreen → Stacked: visuals shrink, video slides up from bottom.
        const t = interpolate(frame, [transStart, transEnd], [0, 1], clampOpts);
        const targetSplitY = currentRects.visualsRect.y + currentRects.visualsRect.h;
        const splitY = canvasHeight + t * (targetSplitY - canvasHeight);
        visualsRect = { x: 0, y: 0, w: canvasWidth, h: splitY };
        videoRect = { x: 0, y: splitY, w: canvasWidth, h: canvasHeight - splitY };
        visualsOpacity = 1.0;
      } else {
        // Fallback for any other combination
        videoRect = interpolateRect(prevRects.videoRect, currentRects.videoRect, frame, transStart, transEnd);
        visualsRect = interpolateRect(prevRects.visualsRect, currentRects.visualsRect, frame, transStart, transEnd);
        visualsOpacity = interpolate(
          frame,
          [transStart, transEnd],
          [prevRects.opacity, currentRects.opacity],
          clampOpts,
        );
      }

      return { videoRect, visualsRect, visualsOpacity };
    }
  }

  return {
    videoRect: currentRects.videoRect,
    visualsRect: currentRects.visualsRect,
    visualsOpacity: currentRects.opacity,
  };
}

/**
 * For PiP mode, compute visibility flags per-frame.
 * Spatial layout is handled by PiPVideo; this decides what's shown/hidden.
 */
export function computePiPLayoutForFrame(
  frame: number,
  segments: LayoutSegment[],
): { showVideo: boolean; showVisuals: boolean; isOverlay: boolean } {
  if (segments.length === 0) {
    return { showVideo: true, showVisuals: true, isOverlay: false };
  }

  let segIdx = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    if (frame < segments[i].endFrame) {
      segIdx = i;
      break;
    }
  }

  const mode = segments[segIdx].displayMode;

  switch (mode) {
    case 'fullscreen':
      return { showVideo: false, showVisuals: true, isOverlay: false };
    case 'overlay':
      return { showVideo: true, showVisuals: true, isOverlay: true };
    case 'default':
    default:
      return { showVideo: true, showVisuals: true, isOverlay: false };
  }
}
