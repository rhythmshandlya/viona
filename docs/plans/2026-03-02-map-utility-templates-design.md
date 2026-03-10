# Map Utility Templates Library — Design

**Date**: 2026-03-02
**Goal**: Build 9 new map templates focused on data visualization, location/business, and storytelling use cases — expanding beyond travel animations.

## Context

We already have 14 map animation templates (1 original + 13 travel-focused). The shared map library at `packages/templates/src/lib/map/` provides tile math, camera, distance, and reusable components. These 9 new templates reuse that infrastructure but serve different use cases: data viz, real estate, events, business coverage, and storytelling.

## Template Designs

### 1. `heatmap-pulse` — Animated Regional Heatmap

- **Visual**: Map with colored circles representing data intensity at locations. Green→yellow→red gradient based on value. Circles pulse with glow effect as they appear.
- **Map tiles**: `positron` (light background so colors pop)
- **Camera**: Static overview using `computeMultiPointViewport`
- **Data**: Array of `{ lat, lng, value, label }` points. Values normalized 0-1, mapped to color gradient.
- **Animation**: Points appear one-by-one with stagger (15 frames apart). Each radiates a CSS box-shadow glow pulse. Metric counter at top ticks up.
- **Duration**: 12s (360 frames)
- **Components**: HeatPoint (colored circle with blur), MetricCounter, GradientLegend
- **Schema**: points (array), title, metricLabel ("Sales"), colorScale (warm/cool/custom), showLegend, mapStyle, fontPair, colors

### 2. `choropleth-race` — Racing Bubble Chart Map

- **Visual**: Map with positioned bubbles that grow as their values increase. Ranked list sidebar shows current standings. Bubbles are labeled with city/region names.
- **Map tiles**: `positron`
- **Camera**: Static overview
- **Data**: Array of `{ lat, lng, label, values: number[] }` — values array represents the metric over time steps. Animation interpolates through time steps.
- **Animation**: All bubbles start small, grow at different rates over time. Sidebar ranking list re-sorts as values change. Date/step counter advances.
- **Duration**: 12s (360 frames)
- **Components**: GrowingBubble, RankingList, TimeStepCounter
- **Schema**: regions (array), title, metricLabel, bubbleColor, showRanking, mapStyle, fontPair, colors

### 3. `pin-drop-scatter` — Cascading Pin Drops

- **Visual**: Clean map with pins dropping from above one-by-one with bounce. Each has a label. Counter ticks up. Optional connection lines.
- **Map tiles**: `voyager` or `positron`
- **Camera**: Static overview using `computeMultiPointViewport`
- **Markers**: Use shared `LocationMarker` with `pinDrop` style
- **Animation**: Pins drop staggered 15-20 frames apart. Labels fade in 8 frames after pin lands. Counter at top increments per pin.
- **Duration**: 12s (360 frames)
- **Components**: PinCounter (top overlay), ConnectionLine (optional dashed lines between pins)
- **Schema**: locations (array of {lat, lng, label}), title, showConnections, showCounter, markerColor, mapStyle, staggerDelay, fontPair, colors

### 4. `property-spotlight` — Location Amenity Radius

- **Visual**: Satellite/street map centered on a property. Concentric radius rings expand outward. POI icons pop in within each ring.
- **Map tiles**: `satellite` or `voyager` at high zoom (mapPadding ~60 for tight view)
- **Camera**: Static, centered on the property coord
- **Radius rings**: SVG circles with animated stroke-dasharray reveal + scale, at 0.5km, 1km, 2km (converted to pixels via tile math)
- **POI icons**: Small category icons (school, park, transit, shop) positioned at their coords, spring pop-in grouped by radius distance
- **Duration**: 12s (360 frames)
- **Components**: RadiusRing (animated expanding circle), POIIcon (category icon with label), PropertyPin (central marker)
- **Schema**: propertyCoord, amenities (array of {lat, lng, label, category: 'school'|'park'|'transit'|'shop'|'restaurant'|'gym'}), radii ([500, 1000, 2000] in meters), title, mapStyle, fontPair, colors

### 5. `neighborhood-guide` — POI Category Map

- **Visual**: Map centered on location with categorized icons animating in by category group. Category legend on the side highlights active group.
- **Map tiles**: `voyager` at medium-high zoom
- **Camera**: Static
- **Categories**: Each category (food, shopping, parks, transit) gets a unique icon and color. Groups animate in sequence.
- **Animation**: Center marker first (frame 20), then each category group animates in (frames 60-360), with stagger within each group. Category label on the side highlights when its group is active.
- **Duration**: 15s (450 frames)
- **Components**: CategoryIcon (SVG icon per type), CategoryLegend (side panel), CenterMarker
- **Schema**: centerCoord, pois (array of {lat, lng, label, category}), title, categories (array of category names), mapStyle, fontPair, colors

### 6. `event-locator` — Venue Pin with Details

- **Visual**: Map zooming into event venue. Large pin drops with info card sliding out showing event details. Direction lines from nearby landmarks.
- **Map tiles**: `voyager` at high zoom
- **Camera**: Animated zoom-in from overview to tight on venue (frames 0-90)
- **Info card**: Slides out from pin showing event name, date, time, address in a styled card
- **Direction lines**: Optional animated paths from 2-3 nearby transit/landmark points converging on venue
- **Duration**: 10s (300 frames)
- **Components**: VenuePin (large styled pin), EventCard (slide-out info panel), DirectionLine (converging path)
- **Schema**: venueCoord, eventName, eventDate, eventTime, address, nearbyLandmarks (array of {lat, lng, label}), showDirections, mapStyle, fontPair, colors

### 7. `coverage-map` — Expanding Service Area

- **Visual**: Map with expanding circular coverage area in semi-transparent brand color. Expands in 2-3 waves.
- **Map tiles**: `positron` or `voyager`
- **Camera**: Static overview or slight zoom-out as coverage expands
- **Coverage area**: SVG circles with animated scale from 0→full radius. Semi-transparent fill (0.2 opacity) with solid border. Multiple waves at different radii.
- **Stats**: "Covering X cities" or "X km² served" counter animates in after expansion
- **Duration**: 10s (300 frames)
- **Components**: CoverageWave (animated circle), CoverageStats (overlay counter), CenterMarker
- **Schema**: centerCoord, waves (array of {radius: number, label?: string}), title, coverageColor, showStats, mapStyle, fontPair, colors

### 8. `territory-timeline` — Sequential Region Fill

- **Visual**: Map with regions filling in chronologically. Date counter advances as new regions light up. Connection lines link sequential entries.
- **Map tiles**: `positron` with slight opacity
- **Camera**: Static overview
- **Regions**: Colored circles that scale in at their coordinate, labeled with name and date
- **Animation**: Date counter at top advances, regions fill in chronologically with spring. Optional connection lines draw between sequential regions.
- **Duration**: 12s (360 frames)
- **Components**: TerritoryRegion (colored circle with label), DateCounter (advancing date), ExpansionLine (connecting sequential points)
- **Schema**: territories (array of {lat, lng, label, date, radius?}), title, showConnections, showDates, regionColor, mapStyle, fontPair, colors

### 9. `comparison-split-map` — Side-by-Side Map Comparison

- **Visual**: Screen split with sliding divider. Each side shows same area with different map style or data overlay. Divider animates across to reveal comparison.
- **Map tiles**: Different style per panel (e.g., `voyager` vs `satellite`, `positron` vs `darkMatter`)
- **Camera**: Static, same viewport for both panels
- **Divider**: Vertical line with handle that slides from center-right to center-left (or vice versa), using CSS clip-path on each panel
- **Labels**: Each side labeled ("Before"/"After", "Day"/"Night", etc.)
- **Duration**: 10s (300 frames)
- **Components**: MapPanel (clipped map view), SlidingDivider, PanelLabel
- **Schema**: centerCoord, zoomLevel, leftMapStyle, rightMapStyle, leftLabel, rightLabel, leftDataPoints, rightDataPoints, dividerColor, fontPair, colors

## File Structure Per Template

Same as existing templates:
```
packages/templates/src/templates/<slug>/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    └── *.tsx
```

## Registration

Each template gets an import in `packages/templates/src/index.ts`.

## Non-Goals

- No GeoJSON polygon rendering (too complex for this round — use circles/bubbles instead)
- No real-time data fetching — all data is props
- No interactive maps — these are video compositions
