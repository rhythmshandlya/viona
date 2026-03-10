import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { PropertySpotlightProps } from './schema';
import {
  computeMultiPointViewport,
  lngToPixelX,
  latToPixelY,
  MAP_STYLES,
  getStaticCamera,
  haversineDistance,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport } from '../../lib/map';
import RadiusRing from './components/RadiusRing';
import POIIcon from './components/POIIcon';
import PropertyPin from './components/PropertyPin';

/**
 * Compute meters-per-pixel at a given zoom level and latitude.
 * Standard slippy-map formula.
 */
function metersPerPixel(lat: number, zoom: number): number {
  const earthCircumference = 40075016.686; // meters
  return (earthCircumference * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom));
}

const PropertySpotlight: React.FC<PropertySpotlightProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  const styleConfig = MAP_STYLES[props.mapStyle];

  const { propertyCoord, amenities, radii, title } = props;

  // ── Viewport ────────────────────────────────────────────────────
  // Use all coords (property + amenities) to compute the bounding viewport
  const allCoords = [propertyCoord, ...amenities];
  const multiViewport = computeMultiPointViewport(allCoords, width, height, props.mapPadding);

  // Build a Viewport-compatible object for MapTileGrid
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  const camera = getStaticCamera();

  // ── Screen position of property ─────────────────────────────────
  const propPixelX = lngToPixelX(propertyCoord.lng, multiViewport.zoom) + multiViewport.offsetX;
  const propPixelY = latToPixelY(propertyCoord.lat, multiViewport.zoom) + multiViewport.offsetY;

  // ── Meters-to-pixels at current zoom ────────────────────────────
  const mpp = metersPerPixel(propertyCoord.lat, multiViewport.zoom);

  // ── Sorted radii ascending ───────────────────────────────────────
  const sortedRadii = [...radii].sort((a, b) => a - b);

  // ── Group amenities by which radius ring they fall within ────────
  // Each amenity belongs to the smallest radius that contains it
  const amenityGroups: (typeof amenities)[] = sortedRadii.map(() => []);
  const unassigned: typeof amenities = [];

  for (const amenity of amenities) {
    const distKm = haversineDistance(
      propertyCoord.lat,
      propertyCoord.lng,
      amenity.lat,
      amenity.lng
    );
    const distM = distKm * 1000;

    let assigned = false;
    for (let i = 0; i < sortedRadii.length; i++) {
      if (distM <= sortedRadii[i]) {
        amenityGroups[i].push(amenity);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      unassigned.push(amenity);
    }
  }

  // ── Timeline ────────────────────────────────────────────────────
  // Map fades in 0-20
  // Property pin enters at 20
  // Ring 0 expands 60-90, its POIs pop in from 90 (staggered)
  // Ring 1 expands 120-150, its POIs pop in from 150
  // Ring 2 expands 180-210, its POIs pop in from 210
  // Title enters at 260
  // Hold 280-330
  // Fade out 330-360

  const ringEnterFrames = [60, 120, 180];
  const poiGroupStartFrames = [90, 150, 210];

  // ── Global fade out ──────────────────────────────────────────────
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Map fade in ──────────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Title ────────────────────────────────────────────────────────
  const titleProgress = spring({
    frame: frame - 260,
    fps: 30,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const titleScale = interpolate(titleProgress, [0, 1], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleOpacity = interpolate(titleProgress, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Ring label helper ────────────────────────────────────────────
  function formatRadius(m: number): string {
    if (m >= 1000) return `${m / 1000}km`;
    return `${m}m`;
  }

  // ── Ring color — use primary for first, then variations ──────────
  const ringColors = [COLORS.primary, COLORS.accent, COLORS.secondary];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Camera-transformed world */}
      <div
        style={{
          transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
          transformOrigin: '0 0',
          width,
          height,
          position: 'absolute',
        }}
      >
        {/* Map tiles */}
        <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
          <MapTileGrid
            viewport={viewport}
            width={width}
            height={height}
            mapStyle={props.mapStyle}
            margin={0}
          />
        </div>

        {/* Radius rings (bottom-up so smaller rings render on top) */}
        {sortedRadii.map((radius, i) => {
          const radiusPixels = radius / mpp;
          const enterFrame = ringEnterFrames[i] ?? 180 + i * 60;
          const ringColor = ringColors[i % ringColors.length];
          return (
            <RadiusRing
              key={`ring-${i}`}
              cx={propPixelX}
              cy={propPixelY}
              radiusPixels={radiusPixels}
              label={formatRadius(radius)}
              frame={frame}
              enterFrame={enterFrame}
              fps={30}
              color={ringColor}
            />
          );
        })}

        {/* POI icons grouped by ring */}
        {amenityGroups.map((group, ringIdx) => {
          const groupStartFrame = poiGroupStartFrames[ringIdx] ?? 210 + ringIdx * 60;
          return group.map((amenity, amenityIdx) => {
            const px = lngToPixelX(amenity.lng, multiViewport.zoom) + multiViewport.offsetX;
            const py = latToPixelY(amenity.lat, multiViewport.zoom) + multiViewport.offsetY;
            const enterFrame = groupStartFrame + amenityIdx * 6;
            return (
              <POIIcon
                key={`poi-${ringIdx}-${amenityIdx}`}
                x={px}
                y={py}
                label={amenity.label}
                category={amenity.category}
                frame={frame}
                enterFrame={enterFrame}
                fps={30}
                darkMap={styleConfig.darkMap}
              />
            );
          });
        })}

        {/* Unassigned POIs (beyond all radii) — appear with last group */}
        {unassigned.map((amenity, i) => {
          const px = lngToPixelX(amenity.lng, multiViewport.zoom) + multiViewport.offsetX;
          const py = latToPixelY(amenity.lat, multiViewport.zoom) + multiViewport.offsetY;
          const enterFrame = (poiGroupStartFrames[poiGroupStartFrames.length - 1] ?? 210) + i * 6;
          return (
            <POIIcon
              key={`poi-unassigned-${i}`}
              x={px}
              y={py}
              label={amenity.label}
              category={amenity.category}
              frame={frame}
              enterFrame={enterFrame}
              fps={30}
              darkMap={styleConfig.darkMap}
            />
          );
        })}

        {/* Property pin (center marker, on top) */}
        <PropertyPin
          x={propPixelX}
          y={propPixelY}
          frame={frame}
          enterFrame={20}
          fps={30}
          color={COLORS.primary}
          size={s(22)}
        />
      </div>

      {/* Fixed overlay — Title bar */}
      <div
        style={{
          position: 'absolute',
          bottom: s(40),
          left: s(40),
          right: s(40),
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderRadius: s(14),
            paddingTop: s(14),
            paddingBottom: s(14),
            paddingLeft: s(20),
            paddingRight: s(20),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
          }}
        >
          {/* Property label + title */}
          <div>
            <div
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(22),
                fontWeight: 700,
                color: COLORS.text,
                lineHeight: 1.2,
              }}
            >
              {propertyCoord.label}
            </div>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: s(13),
                fontWeight: 400,
                color: COLORS.secondary,
                opacity: 0.75,
                marginTop: s(2),
              }}
            >
              {title}
            </div>
          </div>

          {/* Radius legend */}
          <div style={{ display: 'flex', gap: s(10), alignItems: 'center' }}>
            {sortedRadii.map((radius, i) => (
              <div
                key={`legend-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: s(4),
                }}
              >
                <div
                  style={{
                    width: s(10),
                    height: s(10),
                    borderRadius: '50%',
                    backgroundColor: ringColors[i % ringColors.length],
                    opacity: 0.8,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: s(11),
                    color: COLORS.text,
                    fontWeight: 500,
                  }}
                >
                  {formatRadius(radius)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default PropertySpotlight;
