import { interpolate, Easing } from 'remotion';

export interface CameraState {
  translateX: number;
  translateY: number;
  scale: number;
}

const WIDTH = 1080;
const HEIGHT = 1080;

/**
 * Follow-draw camera: zooms in at 2x following the drawing tip,
 * then zooms out to show the full route.
 */
export function getFollowDrawCamera(
  frame: number,
  tip: { x: number; y: number },
  routeCenter: { x: number; y: number },
  zoomOutT: number
): CameraState {
  const CAMERA_ZOOM = 2;

  const cameraX = interpolate(zoomOutT, [0, 1], [tip.x, routeCenter.x]);
  const cameraY = interpolate(zoomOutT, [0, 1], [tip.y, routeCenter.y]);
  const scale = interpolate(zoomOutT, [0, 1], [CAMERA_ZOOM, 1]);

  return {
    translateX: WIDTH / 2 - cameraX * scale,
    translateY: HEIGHT / 2 - cameraY * scale,
    scale,
  };
}

/**
 * Zoom-reveal camera: starts zoomed out at 0.45x, zooms to 1x over frames 0–90,
 * then stays static.
 */
export function getZoomRevealCamera(frame: number): CameraState {
  const scale = interpolate(frame, [0, 90], [0.45, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Center the camera on the viewport center
  const cameraX = WIDTH / 2;
  const cameraY = HEIGHT / 2;

  return {
    translateX: WIDTH / 2 - cameraX * scale,
    translateY: HEIGHT / 2 - cameraY * scale,
    scale,
  };
}

/**
 * Ken Burns camera: slow drift with slight zoom.
 * Scale stays at 1.12, panX/panY interpolate over 360 frames.
 */
export function getKenBurnsCamera(frame: number): CameraState {
  const scale = 1.12;

  const panX = interpolate(frame, [0, 360], [0, 30], {
    extrapolateRight: 'clamp',
  });
  const panY = interpolate(frame, [0, 360], [0, 20], {
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

/**
 * Static camera: no zoom or pan. Used by hubAndSpoke.
 */
export function getStaticCamera(): CameraState {
  return { translateX: 0, translateY: 0, scale: 1 };
}
