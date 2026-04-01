/** Normalized speaker bounding box (0-1 coordinates relative to canvas) */
export interface SpeakerBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixel-space speaker data */
export interface SpeakerData {
  bbox: SpeakerBbox;
  center: { x: number; y: number };
  bboxPx: { x: number; y: number; w: number; h: number };
  centerPx: { x: number; y: number };
}

/** Areas not occluded by the speaker (pixel-space) */
export interface VisibleZones {
  left: { x: number; y: number; w: number; h: number };
  right: { x: number; y: number; w: number; h: number };
  top: { x: number; y: number; w: number; h: number };
  bottom: { x: number; y: number; w: number; h: number };
}

export function computeSpeakerPx(
  bbox: SpeakerBbox,
  center: { x: number; y: number },
  canvasW: number,
  canvasH: number,
) {
  return {
    bboxPx: {
      x: Math.round(bbox.x * canvasW),
      y: Math.round(bbox.y * canvasH),
      w: Math.round(bbox.w * canvasW),
      h: Math.round(bbox.h * canvasH),
    },
    centerPx: {
      x: Math.round(center.x * canvasW),
      y: Math.round(center.y * canvasH),
    },
  };
}

export function computeVisibleZones(
  bboxPx: SpeakerData['bboxPx'],
  canvasW: number,
  canvasH: number,
): VisibleZones {
  return {
    left: { x: 0, y: 0, w: bboxPx.x, h: canvasH },
    right: {
      x: bboxPx.x + bboxPx.w,
      y: 0,
      w: canvasW - (bboxPx.x + bboxPx.w),
      h: canvasH,
    },
    top: { x: 0, y: 0, w: canvasW, h: bboxPx.y },
    bottom: {
      x: 0,
      y: bboxPx.y + bboxPx.h,
      w: canvasW,
      h: canvasH - (bboxPx.y + bboxPx.h),
    },
  };
}
