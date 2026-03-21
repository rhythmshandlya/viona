import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { MAGAZINE_COLORS } from '../../../magazine/constants';
import { magazineEasing } from '../../../magazine/animations';

// ── Tile math (standalone) ─────────────────────────────────────────────────

function lngToPixelX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom) * 256;
}

function latToPixelY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom) *
    256
  );
}

interface RoutePoint {
  lat: number;
  lng: number;
}

interface InkRouteProps {
  frame: number;
  startFrame: number;
  duration: number;
  routePoints: RoutePoint[];
  centerLat: number;
  centerLng: number;
  zoom: number;
  width?: number;
  height?: number;
  seed?: string;
}

/**
 * Animated route line drawn via stroke-dashoffset.
 * Small 8px dot markers fade in when the route reaches each point.
 */
export function InkRoute({
  frame,
  startFrame,
  duration,
  routePoints,
  centerLat,
  centerLng,
  zoom,
  width = 1080,
  height = 1920,
  seed = 'inkmap-route',
}: InkRouteProps) {
  const hasRoute = routePoints.length >= 2;

  const centerPx = lngToPixelX(centerLng, zoom);
  const centerPy = latToPixelY(centerLat, zoom);

  // Convert lat/lng points to screen coordinates
  const screenPoints = useMemo(() => {
    if (!hasRoute) return [];
    return routePoints.map((pt) => ({
      x: lngToPixelX(pt.lng, zoom) - centerPx + width / 2,
      y: latToPixelY(pt.lat, zoom) - centerPy + height / 2,
    }));
  }, [hasRoute, routePoints, zoom, centerPx, centerPy, width, height]);

  // Build SVG path string
  const pathD = useMemo(() => {
    if (screenPoints.length === 0) return '';
    return screenPoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
      .join(' ');
  }, [screenPoints]);

  // Approximate path length from point-to-point distances
  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < screenPoints.length; i++) {
      const dx = screenPoints[i].x - screenPoints[i - 1].x;
      const dy = screenPoints[i].y - screenPoints[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }, [screenPoints]);

  // Cumulative distances for each point (for dot fade-in timing)
  const cumulativeDistances = useMemo(() => {
    const dists = [0];
    for (let i = 1; i < screenPoints.length; i++) {
      const dx = screenPoints[i].x - screenPoints[i - 1].x;
      const dy = screenPoints[i].y - screenPoints[i - 1].y;
      dists.push(dists[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return dists;
  }, [screenPoints]);

  // Don't render anything if fewer than 2 route points
  if (!hasRoute) return null;

  const dashOffset = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [pathLength, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: magazineEasing,
    },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Route line */}
        <path
          d={pathD}
          fill="none"
          stroke={MAGAZINE_COLORS.secondary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />

        {/* Dot markers at each route point */}
        {screenPoints.map((pt, i) => {
          // Dot appears when the route has been drawn past this point
          const pointReachFraction =
            pathLength > 0 ? cumulativeDistances[i] / pathLength : 0;
          const pointReachFrame =
            startFrame + pointReachFraction * duration;

          const dotOpacity = interpolate(
            frame,
            [pointReachFrame, pointReachFrame + 5],
            [0, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            },
          );

          const dotScale = interpolate(
            frame,
            [pointReachFrame, pointReachFrame + 5],
            [0.3, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            },
          );

          return (
            <circle
              key={`${seed}-dot-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={MAGAZINE_COLORS.secondary}
              opacity={dotOpacity}
              style={{
                transform: `scale(${dotScale})`,
                transformOrigin: `${pt.x}px ${pt.y}px`,
                transformBox: 'fill-box',
              }}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
