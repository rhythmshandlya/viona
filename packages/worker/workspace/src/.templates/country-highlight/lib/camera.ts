import { interpolate, Easing } from 'remotion';

export interface CameraState {
  translateX: number;
  translateY: number;
  scale: number;
}

/**
 * Smooth zoom: Scale 0.6→1.0 over the first ~33% of duration.
 * Centered on the viewport center.
 */
export function getSmoothZoomCamera(
  frame: number,
  width: number,
  height: number,
  totalFrames: number,
): CameraState {
  const zoomEnd = Math.round(totalFrames * 0.33);

  const scale = interpolate(frame, [0, zoomEnd], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const cameraX = width / 2;
  const cameraY = height / 2;

  return {
    translateX: width / 2 - cameraX * scale,
    translateY: height / 2 - cameraY * scale,
    scale,
  };
}

/**
 * Dramatic zoom: Scale 0.35→1.2 over first ~42%, then settle 1.2→1.0 by ~50%.
 */
export function getDramaticZoomCamera(
  frame: number,
  width: number,
  height: number,
  totalFrames: number,
): CameraState {
  const zoomEnd = Math.round(totalFrames * 0.42);
  const settleEnd = Math.round(totalFrames * 0.50);

  const zoomIn = interpolate(frame, [0, zoomEnd], [0.35, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.exp),
  });

  const settle = interpolate(frame, [zoomEnd, settleEnd], [1.2, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const scale = frame < zoomEnd ? zoomIn : settle;

  const cameraX = width / 2;
  const cameraY = height / 2;

  return {
    translateX: width / 2 - cameraX * scale,
    translateY: height / 2 - cameraY * scale,
    scale,
  };
}

/**
 * Ken Burns: Static scale 1.08 with slow linear pan across the full duration.
 */
export function getKenBurnsCamera(
  frame: number,
  width: number,
  height: number,
  totalFrames: number,
): CameraState {
  const scale = 1.08;

  const panX = interpolate(frame, [0, totalFrames], [0, 25], {
    extrapolateRight: 'clamp',
  });
  const panY = interpolate(frame, [0, totalFrames], [0, 15], {
    extrapolateRight: 'clamp',
  });

  const cameraX = width / 2 + panX;
  const cameraY = height / 2 + panY;

  return {
    translateX: width / 2 - cameraX * scale,
    translateY: height / 2 - cameraY * scale,
    scale,
  };
}
