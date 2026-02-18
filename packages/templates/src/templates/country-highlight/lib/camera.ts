import { interpolate, Easing } from 'remotion';

export interface CameraState {
  translateX: number;
  translateY: number;
  scale: number;
}

const WIDTH = 1080;
const HEIGHT = 1080;

/**
 * Smooth zoom: Scale 0.6→1.0 over frames 0–120 with cubic ease-in-out.
 * Centered on the viewport center.
 */
export function getSmoothZoomCamera(frame: number): CameraState {
  const scale = interpolate(frame, [0, 120], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const cameraX = WIDTH / 2;
  const cameraY = HEIGHT / 2;

  return {
    translateX: WIDTH / 2 - cameraX * scale,
    translateY: HEIGHT / 2 - cameraY * scale,
    scale,
  };
}

/**
 * Dramatic zoom: Scale 0.35→1.2 over frames 0–150 with exponential ease-out,
 * then settle 1.2→1.0 by frame 180.
 */
export function getDramaticZoomCamera(frame: number): CameraState {
  const zoomIn = interpolate(frame, [0, 150], [0.35, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.exp),
  });

  const settle = interpolate(frame, [150, 180], [1.2, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const scale = frame < 150 ? zoomIn : settle;

  const cameraX = WIDTH / 2;
  const cameraY = HEIGHT / 2;

  return {
    translateX: WIDTH / 2 - cameraX * scale,
    translateY: HEIGHT / 2 - cameraY * scale,
    scale,
  };
}

/**
 * Ken Burns: Static scale 1.08 with slow linear pan
 * (25px horizontal, 15px vertical over 360 frames).
 */
export function getKenBurnsCamera(frame: number): CameraState {
  const scale = 1.08;

  const panX = interpolate(frame, [0, 360], [0, 25], {
    extrapolateRight: 'clamp',
  });
  const panY = interpolate(frame, [0, 360], [0, 15], {
    extrapolateRight: 'clamp',
  });

  const cameraX = WIDTH / 2 + panX;
  const cameraY = HEIGHT / 2 + panY;

  return {
    translateX: WIDTH / 2 - cameraX * scale,
    translateY: HEIGHT / 2 - cameraY * scale,
    scale,
  };
}
