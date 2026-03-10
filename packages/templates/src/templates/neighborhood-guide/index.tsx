import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants } from './constants';
import type { NeighborhoodGuideProps } from './schema';
import type { POICategory } from './schema';
import {
  computeMultiPointViewport,
  MAP_STYLES,
  getStaticCamera,
  MapTileGrid,
} from '../../lib/map';
import type { Viewport, MultiPointViewport } from '../../lib/map';
import CenterMarker from './components/CenterMarker';
import CategoryIcon, { CATEGORY_COLORS } from './components/CategoryIcon';
import CategoryLegend from './components/CategoryLegend';

/**
 * Neighborhood Guide template.
 *
 * Layout (1080x1920 — 9:16 vertical):
 *   Top 75%  (0–1440px):  Map with POI icons
 *   Bottom 25% (1440–1920px): Category legend panel
 *
 * Timeline (450 frames / 15s @ 30fps):
 *   0-20:    Map tiles fade in
 *   20:      Center marker enters
 *   10:      Title springs in
 *   60-120:  food POIs pop in (staggered 8f apart)
 *   120-180: shopping POIs
 *   180-240: parks POIs
 *   240-300: transit POIs
 *   300-360: nightlife POIs
 *   360-400: culture POIs
 *   430-450: global fade out
 */

const CATEGORY_ORDER: POICategory[] = [
  'food',
  'shopping',
  'parks',
  'transit',
  'nightlife',
  'culture',
];

interface CategoryRange {
  category: POICategory;
  start: number;
  end: number;
}

const CATEGORY_RANGES: CategoryRange[] = [
  { category: 'food', start: 60, end: 120 },
  { category: 'shopping', start: 120, end: 180 },
  { category: 'parks', start: 180, end: 240 },
  { category: 'transit', start: 240, end: 300 },
  { category: 'nightlife', start: 300, end: 360 },
  { category: 'culture', start: 360, end: 400 },
];

const FADEOUT_START = 430;
const FADEOUT_END = 450;

const NeighborhoodGuide: React.FC<NeighborhoodGuideProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const MAP_HEIGHT = Math.round(height * 0.75);
  const LEGEND_HEIGHT = height - MAP_HEIGHT;
  const styleConfig = MAP_STYLES[props.mapStyle];

  const pois = props.pois;

  // ── Viewport ──────────────────────────────────────────────────────
  // Include center coord + all POI coords. Use MAP_HEIGHT for map portion.
  const allCoords = [
    { lat: props.centerCoord.lat, lng: props.centerCoord.lng },
    ...pois.map((p) => ({ lat: p.lat, lng: p.lng })),
  ];

  const multiViewport: MultiPointViewport = computeMultiPointViewport(
    allCoords,
    width,
    MAP_HEIGHT,
    props.mapPadding
  );

  // Build a 2-point Viewport for MapTileGrid (uses point1/point2 for tile range)
  const viewport: Viewport = {
    zoom: multiViewport.zoom,
    offsetX: multiViewport.offsetX,
    offsetY: multiViewport.offsetY,
    point1: multiViewport.points[0],
    point2: multiViewport.points[multiViewport.points.length - 1],
  };

  // ── Camera (static) ───────────────────────────────────────────────
  const camera = getStaticCamera();

  // ── Map tiles fade in ─────────────────────────────────────────────
  const mapOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Global fade out ───────────────────────────────────────────────
  const fadeOut = interpolate(frame, [FADEOUT_START, FADEOUT_END], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Title spring entrance ─────────────────────────────────────────
  const TITLE_ENTER = 10;
  const titleScale = spring({
    frame: Math.max(0, frame - TITLE_ENTER),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });
  const titleOpacity = interpolate(frame, [TITLE_ENTER, TITLE_ENTER + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Active category for legend ────────────────────────────────────
  let activeCategory: POICategory | null = null;
  for (const range of CATEGORY_RANGES) {
    if (frame >= range.start && frame < range.end + 30) {
      activeCategory = range.category;
      break;
    }
  }

  // ── Per-POI enter frames ──────────────────────────────────────────
  function getPoiEnterFrame(poiIndex: number): number {
    const poi = pois[poiIndex];
    const range = CATEGORY_RANGES.find((r) => r.category === poi.category);
    if (!range) return 999;

    // Collect all POIs in this category and find the index within the group
    const groupPois = pois.filter((p) => p.category === poi.category);
    const indexInGroup = groupPois.findIndex(
      (p) => p.lat === poi.lat && p.lng === poi.lng && p.label === poi.label
    );

    return range.start + indexInGroup * 8;
  }

  // ── Category summary for legend ───────────────────────────────────
  const categoryEntries = CATEGORY_ORDER.map((cat) => ({
    name: cat,
    color: CATEGORY_COLORS[cat],
    count: pois.filter((p) => p.category === cat).length,
  })).filter((e) => e.count > 0);

  // ── Center marker screen position ─────────────────────────────────
  // Point index 0 is the center coord (first in allCoords)
  const centerPoint = multiViewport.points[0];

  // ── Render POI icons ──────────────────────────────────────────────
  function renderPOIs() {
    return pois.map((poi, i) => {
      // Point index is i+1 because index 0 is center coord
      const pt = multiViewport.points[i + 1];
      return (
        <CategoryIcon
          key={`poi-${i}`}
          x={pt.x}
          y={pt.y}
          label={poi.label}
          category={poi.category}
          frame={frame}
          enterFrame={getPoiEnterFrame(i)}
          fps={fps}
          darkMap={styleConfig.darkMap}
        />
      );
    });
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.background,
        opacity: fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* ── Top 75%: Map ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height: MAP_HEIGHT,
          overflow: 'hidden',
        }}
      >
        {/* Camera-transformed world */}
        <div
          style={{
            transform: `translate(${camera.translateX}px, ${camera.translateY}px) scale(${camera.scale})`,
            transformOrigin: '0 0',
            width,
            height: MAP_HEIGHT,
            position: 'absolute',
          }}
        >
          {/* Map tiles */}
          <div style={{ opacity: mapOpacity, position: 'absolute', inset: 0 }}>
            <MapTileGrid
              viewport={viewport}
              width={width}
              height={MAP_HEIGHT}
              mapStyle={props.mapStyle}
              margin={0}
            />
          </div>

          {/* Center marker */}
          <CenterMarker
            x={centerPoint.x}
            y={centerPoint.y}
            frame={frame}
            enterFrame={20}
            fps={fps}
            color={COLORS.primary}
          />

          {/* POI category icons */}
          {renderPOIs()}
        </div>

        {/* Title overlay (fixed over map, outside camera transform) */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: '50%',
            transform: `translateX(-50%) scale(${titleScale})`,
            transformOrigin: 'center top',
            opacity: titleOpacity,
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: 14,
              padding: '10px 28px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              borderLeft: `5px solid ${COLORS.primary}`,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.headline,
                fontSize: 38,
                fontWeight: 700,
                color: COLORS.secondary,
                whiteSpace: 'nowrap',
                lineHeight: 1.15,
              }}
            >
              {props.title}
            </div>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 20,
                fontWeight: 400,
                color: COLORS.text,
                opacity: 0.75,
                marginTop: 2,
                whiteSpace: 'nowrap',
              }}
            >
              {props.centerCoord.label}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom 25%: Category Legend ── */}
      <div
        style={{
          position: 'absolute',
          top: MAP_HEIGHT,
          left: 0,
          width,
          height: LEGEND_HEIGHT,
          overflow: 'hidden',
        }}
      >
        <CategoryLegend
          categories={categoryEntries}
          activeCategory={activeCategory}
          frame={frame}
          fps={fps}
          font={FONTS.headline}
          colors={COLORS}
        />
      </div>
    </AbsoluteFill>
  );
};

export default NeighborhoodGuide;
