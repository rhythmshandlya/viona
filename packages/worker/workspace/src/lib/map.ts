/**
 * Shared map utilities — viewport math, camera systems, and map components.
 * Used by watercolor-map, country-highlight, and future map templates.
 */
import React from 'react';
import { Img, interpolate, Easing, useCurrentFrame } from 'remotion';

// ── Constants ───────────────────────────────────────────────────────────────

const TILE_SIZE = 256;

// ── Tile math ───────────────────────────────────────────────────────────────

export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

export function lngToPixelX(lng: number, zoom: number): number {
  return lngToTileX(lng, zoom) * TILE_SIZE;
}

export function latToPixelY(lat: number, zoom: number): number {
  return latToTileY(lat, zoom) * TILE_SIZE;
}

function fitZoom(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  width: number, height: number,
  padding: number,
): number {
  const ew = width - padding * 2;
  const eh = height - padding * 2;
  for (let z = 16; z >= 1; z--) {
    const dx = Math.abs(lngToPixelX(lng2, z) - lngToPixelX(lng1, z));
    const dy = Math.abs(latToPixelY(lat2, z) - latToPixelY(lat1, z));
    if (dx <= ew && dy <= eh) return z;
  }
  return 1;
}

// ── Viewport types ──────────────────────────────────────────────────────────

export interface Viewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  point1: { x: number; y: number };
  point2: { x: number; y: number };
}

export interface MultiPointViewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
  points: Array<{ x: number; y: number }>;
}

// ── Viewport computation ────────────────────────────────────────────────────

export function computeViewport(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  width: number, height: number,
  padding: number,
): Viewport {
  const zoom = fitZoom(lat1, lng1, lat2, lng2, width, height, padding);

  const px1 = lngToPixelX(lng1, zoom);
  const py1 = latToPixelY(lat1, zoom);
  const px2 = lngToPixelX(lng2, zoom);
  const py2 = latToPixelY(lat2, zoom);

  const centerX = (px1 + px2) / 2;
  const centerY = (py1 + py2) / 2;

  const offsetX = width / 2 - centerX;
  const offsetY = height / 2 - centerY;

  return {
    zoom,
    offsetX,
    offsetY,
    point1: { x: px1 + offsetX, y: py1 + offsetY },
    point2: { x: px2 + offsetX, y: py2 + offsetY },
  };
}

export function computeMultiPointViewport(
  coords: Array<{ lat: number; lng: number }>,
  width: number,
  height: number,
  padding: number,
): MultiPointViewport {
  if (coords.length < 2) {
    const c = coords[0] ?? { lat: 0, lng: 0 };
    const v = computeViewport(c.lat, c.lng, c.lat, c.lng, width, height, padding);
    return { zoom: v.zoom, offsetX: v.offsetX, offsetY: v.offsetY, points: [v.point1] };
  }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  const zoom = fitZoom(minLat, minLng, maxLat, maxLng, width, height, padding);

  const allPx = coords.map((c) => ({ px: lngToPixelX(c.lng, zoom), py: latToPixelY(c.lat, zoom) }));

  const centerX = (Math.min(...allPx.map((p) => p.px)) + Math.max(...allPx.map((p) => p.px))) / 2;
  const centerY = (Math.min(...allPx.map((p) => p.py)) + Math.max(...allPx.map((p) => p.py))) / 2;

  const offsetX = width / 2 - centerX;
  const offsetY = height / 2 - centerY;

  return {
    zoom,
    offsetX,
    offsetY,
    points: allPx.map((p) => ({ x: p.px + offsetX, y: p.py + offsetY })),
  };
}

// ── Bezier math ─────────────────────────────────────────────────────────────

export function computeBezierControl(
  x1: number, y1: number,
  x2: number, y2: number,
  curveIntensity: number,
): { cx: number; cy: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Perpendicular offset
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  return {
    cx: mx + nx * dist * curveIntensity,
    cy: my + ny * dist * curveIntensity,
  };
}

export function getPointOnQuadBezier(
  x1: number, y1: number,
  cx: number, cy: number,
  x2: number, y2: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

// ── Haversine distance ──────────────────────────────────────────────────────

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Map styles ──────────────────────────────────────────────────────────────

export interface MapStyleConfig {
  urlTemplate: string;
  background: string;
  darkMap: boolean;
}

export const MAP_STYLES: Record<string, MapStyleConfig> = {
  satellite: {
    urlTemplate: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    background: '#1a1a2e',
    darkMap: true,
  },
  watercolor: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    background: '#F5F0EB',
    darkMap: false,
  },
  toner: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    background: '#000000',
    darkMap: true,
  },
  tonerLite: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png',
    background: '#FFFFFF',
    darkMap: false,
  },
  terrain: {
    urlTemplate: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
    background: '#F4F0E8',
    darkMap: false,
  },
  osm: {
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    background: '#E8E0D8',
    darkMap: false,
  },
  darkMatter: {
    urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    background: '#1a1a2e',
    darkMap: true,
  },
  voyager: {
    urlTemplate: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    background: '#F2EFE9',
    darkMap: false,
  },
  positron: {
    urlTemplate: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    background: '#E6E5E3',
    darkMap: false,
  },
};

function getTileUrl(tileX: number, tileY: number, zoom: number, style: string): string {
  const cfg = MAP_STYLES[style] ?? MAP_STYLES.osm;
  return cfg.urlTemplate.replace('{z}', String(zoom)).replace('{x}', String(tileX)).replace('{y}', String(tileY));
}

function getTilesForViewport(viewport: { zoom: number; offsetX: number; offsetY: number }, width: number, height: number, margin: number) {
  const { zoom, offsetX, offsetY } = viewport;
  const worldLeft = -offsetX - margin;
  const worldTop = -offsetY - margin;
  const worldRight = worldLeft + width + margin * 2;
  const worldBottom = worldTop + height + margin * 2;

  const tileXMin = Math.floor(worldLeft / TILE_SIZE);
  const tileXMax = Math.floor(worldRight / TILE_SIZE);
  const tileYMin = Math.floor(worldTop / TILE_SIZE);
  const tileYMax = Math.floor(worldBottom / TILE_SIZE);
  const maxTile = Math.pow(2, zoom) - 1;

  const tiles: Array<{ tileX: number; tileY: number; screenX: number; screenY: number }> = [];
  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      if (ty < 0 || ty > maxTile) continue;
      const wrappedX = ((tx % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
      tiles.push({ tileX: wrappedX, tileY: ty, screenX: tx * TILE_SIZE + offsetX, screenY: ty * TILE_SIZE + offsetY });
    }
  }
  return tiles;
}

// ── Camera systems ──────────────────────────────────────────────────────────

interface CameraState {
  translateX: number;
  translateY: number;
  scale: number;
}

export function getFollowDrawCamera(
  frame: number,
  tip: { x: number; y: number },
  center: { x: number; y: number },
  zoomOutT: number,
  width: number,
  height: number,
): CameraState {
  const followScale = 1.6;
  const overviewScale = 1.0;
  const scale = followScale + (overviewScale - followScale) * zoomOutT;

  const focusX = tip.x + (center.x - tip.x) * zoomOutT;
  const focusY = tip.y + (center.y - tip.y) * zoomOutT;

  return {
    translateX: width / 2 - focusX * scale,
    translateY: height / 2 - focusY * scale,
    scale,
  };
}

export function getZoomRevealCamera(
  frame: number,
  width: number,
  height: number,
): CameraState {
  const scale = interpolate(frame, [0, 100, 280, 340], [3.0, 1.8, 1.8, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return {
    translateX: width / 2 - (width / 2) * scale,
    translateY: height / 2 - (height / 2) * scale,
    scale,
  };
}

export function getKenBurnsCamera(
  frame: number,
  width: number,
  height: number,
): CameraState {
  const scale = 1.15;
  const panX = interpolate(frame, [0, 360], [20, -20], { extrapolateRight: 'clamp' });
  const panY = interpolate(frame, [0, 360], [10, -10], { extrapolateRight: 'clamp' });
  const cameraX = width / 2 + panX;
  const cameraY = height / 2 + panY;
  return {
    translateX: width / 2 - cameraX * scale,
    translateY: height / 2 - cameraY * scale,
    scale,
  };
}

export function getStaticCamera(): CameraState {
  return { translateX: 0, translateY: 0, scale: 1 };
}

// ── React Components ────────────────────────────────────────────────────────

// MapTileGrid
export const MapTileGrid: React.FC<{
  viewport: { zoom: number; offsetX: number; offsetY: number };
  width: number;
  height: number;
  mapStyle: string;
  margin?: number;
}> = ({ viewport, width, height, mapStyle, margin = 0 }) => {
  const tiles = getTilesForViewport(viewport, width, height, margin);
  return React.createElement(
    React.Fragment,
    null,
    ...tiles.map((tile) =>
      React.createElement(Img, {
        key: `${tile.tileX}-${tile.tileY}`,
        src: getTileUrl(tile.tileX, tile.tileY, viewport.zoom, mapStyle),
        maxRetries: 3,
        onError: (e: any) => { e.currentTarget.style.display = 'none'; },
        style: { position: 'absolute', left: tile.screenX, top: tile.screenY, width: 256, height: 256 },
      }),
    ),
  );
};

// AnimatedPath
export const AnimatedPath: React.FC<{
  x1: number; y1: number;
  x2: number; y2: number;
  frame: number;
  startFrame: number;
  endFrame: number;
  lineColor: string;
  lineWidth: number;
  lineStyle: string;
  curveIntensity: number;
  width: number;
  height: number;
  maskId?: string;
}> = ({ x1, y1, x2, y2, frame, startFrame, endFrame, lineColor, lineWidth, lineStyle, curveIntensity, width, height, maskId }) => {
  const { cx, cy } = computeBezierControl(x1, y1, x2, y2, curveIntensity);
  const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Estimate path length for dashoffset animation
  const dx = x2 - x1;
  const dy = y2 - y1;
  const pathLength = Math.sqrt(dx * dx + dy * dy) * 1.3; // rough bezier estimate

  const id = maskId ?? `path-${x1}-${y1}`;

  return React.createElement(
    'svg',
    {
      width, height,
      style: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
    },
    React.createElement('path', {
      d: pathD,
      fill: 'none',
      stroke: lineColor,
      strokeWidth: lineWidth,
      strokeDasharray: lineStyle === 'dashed' ? `${lineWidth * 3} ${lineWidth * 2}` : `${pathLength}`,
      strokeDashoffset: lineStyle === 'dashed' ? 0 : pathLength * (1 - progress),
      strokeLinecap: 'round',
      opacity: progress > 0 ? 1 : 0,
    }),
  );
};

// LocationMarker
export const LocationMarker: React.FC<{
  x: number; y: number;
  frame: number;
  enterFrame: number;
  color: string;
  size: number;
  markerStyle: string;
}> = ({ x, y, frame, enterFrame, color, size, markerStyle }) => {
  if (frame < enterFrame) return null;

  const age = frame - enterFrame;
  const popIn = interpolate(age, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = interpolate(popIn, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const children: React.ReactNode[] = [];

  // Pulse ring for 'pulse' style
  if (markerStyle === 'pulse' || markerStyle === 'ripple') {
    const pulseScale = interpolate(age % 40, [0, 40], [1, 2.5], { extrapolateRight: 'clamp' });
    const pulseOpacity = interpolate(age % 40, [0, 40], [0.6, 0], { extrapolateRight: 'clamp' });
    children.push(
      React.createElement('div', {
        key: 'pulse',
        style: {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          transform: `translate(-50%, -50%) scale(${pulseScale})`,
          opacity: pulseOpacity,
        },
      }),
    );
  }

  // Main dot
  children.push(
    React.createElement('div', {
      key: 'dot',
      style: {
        position: 'absolute',
        width: size * 0.6,
        height: size * 0.6,
        borderRadius: '50%',
        background: color,
        border: '2px solid white',
        transform: `translate(-50%, -50%) scale(${scale})`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      },
    }),
  );

  // Pin drop shape
  if (markerStyle === 'pinDrop') {
    children.push(
      React.createElement('div', {
        key: 'pin',
        style: {
          position: 'absolute',
          width: 0,
          height: 0,
          borderLeft: `${size * 0.2}px solid transparent`,
          borderRight: `${size * 0.2}px solid transparent`,
          borderTop: `${size * 0.4}px solid ${color}`,
          transform: `translate(-50%, ${size * 0.2}px) scale(${scale})`,
        },
      }),
    );
  }

  return React.createElement('div', {
    style: { position: 'absolute', left: x, top: y, pointerEvents: 'none' },
  }, ...children);
};

// LocationLabel
export const LocationLabel: React.FC<{
  x: number; y: number;
  label: string;
  frame: number;
  enterFrame: number;
  font: string;
  color: string;
  viewportWidth: number;
  darkMap: boolean;
}> = ({ x, y, label, frame, enterFrame, font, color, darkMap }) => {
  if (frame < enterFrame) return null;

  const age = frame - enterFrame;
  const opacity = interpolate(age, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const slideY = interpolate(age, [0, 15], [8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: x,
      top: y + 20,
      transform: `translate(-50%, ${slideY}px)`,
      opacity,
      fontFamily: font,
      fontSize: 16,
      fontWeight: 700,
      color,
      textShadow: darkMap
        ? '0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)'
        : '0 1px 3px rgba(255,255,255,0.9)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      letterSpacing: '0.03em',
    },
  }, label);
};
