# Map Utility Templates — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 9 new map templates for data visualization, location/business, and storytelling use cases.

**Architecture:** Each template is a self-contained Remotion composition under `packages/templates/src/templates/<slug>/` following the exact same pattern as the existing map templates (schema.ts, constants.ts, index.tsx, register.ts, meta.json, metadata.json, components/). All templates reuse the shared map library at `packages/templates/src/lib/map/` for tile rendering, camera, distance, and markers.

**Tech Stack:** Remotion 4.x, React, TypeScript, Zod, SVG for overlays/charts, CSS transforms for camera

---

## Reference Files

Before implementing any task, read these files to understand the exact patterns:

- **Shared map lib**: `packages/templates/src/lib/map/index.ts` (exports)
- **Template example**: `packages/templates/src/templates/hub-spoke-radial/` (closest pattern — multi-point, static camera, staggered markers)
- **Pin drop example**: `packages/templates/src/templates/multi-stop-journey/` (staggered marker pop-ins)
- **Schema pattern**: `packages/templates/src/templates/watercolor-map/schema.ts`
- **Register pattern**: `packages/templates/src/templates/watercolor-map/register.ts`
- **Constants pattern**: `packages/templates/src/templates/watercolor-map/constants.ts`
- **Types**: `packages/templates/src/types.ts` (TemplateMeta, CompositionMeta)
- **Registry**: `packages/templates/src/registry.ts`

## Code Style Rules (CRITICAL)

- Use `useCurrentFrame()` and `useVideoConfig()` for all animation timing
- Use `spring()` with SMOOTH: `{ damping: 26, stiffness: 120, mass: 1.0 }` or SNAPPY: `{ damping: 22, stiffness: 180, mass: 0.8 }`
- Use `interpolate()` with BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'` ALWAYS
- Stagger elements by 6+ frames minimum
- NEVER use damping < 20
- NEVER use `Math.sin/cos` on text positions
- All map templates must include `"map"` in their tags array in meta.json
- DO NOT COMMIT — just create files and verify TypeScript

---

### Task 1: Template — `heatmap-pulse` (Animated Regional Heatmap)

**Files to create:**
```
packages/templates/src/templates/heatmap-pulse/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── HeatPoint.tsx        # Colored circle with blur glow + pulse
    ├── MetricCounter.tsx    # Top overlay counting total metric
    └── GradientLegend.tsx   # Color scale legend (low→high)
```

**meta.json:**
```json
{
  "slug": "heatmap-pulse",
  "name": "Heatmap Pulse",
  "description": "Animated heatmap with pulsing data points showing intensity by location, with metric counter and color legend",
  "category": "corporate",
  "tags": ["map", "heatmap", "data", "visualization", "analytics", "metrics", "corporate", "statistics", "regions", "density"],
  "stylePreset": "modernTech",
  "aspectRatio": "16:9",
  "sceneCount": 1,
  "estimatedDuration": "12s",
  "thumbnail": "thumbnail.png"
}
```

**metadata.json:** `{ "compositionId": "heatmap-pulse", "durationInFrames": 360, "fps": 30, "width": 1920, "height": 1080 }`

**Schema props:**
- points: array of `{ lat, lng, value, label }`, default 8 sample cities with values 10-100
  ```
  [
    { lat: 40.7128, lng: -74.0060, value: 95, label: "New York" },
    { lat: 34.0522, lng: -118.2437, value: 78, label: "Los Angeles" },
    { lat: 51.5074, lng: -0.1278, value: 88, label: "London" },
    { lat: 35.6762, lng: 139.6503, value: 72, label: "Tokyo" },
    { lat: 48.8566, lng: 2.3522, value: 65, label: "Paris" },
    { lat: -33.8688, lng: 151.2093, value: 55, label: "Sydney" },
    { lat: 25.2048, lng: 55.2708, value: 45, label: "Dubai" },
    { lat: 1.3521, lng: 103.8198, value: 60, label: "Singapore" }
  ]
  ```
- title ("Regional Performance")
- metricLabel ("Sales")
- colorScale: enum 'warm' | 'cool' | 'green' (default 'warm') — warm=#FF0000→#FFFF00→#00FF00, cool=#0000FF→#00FFFF→#FFFFFF, green=#00FF00→#FFFF00→#FF0000
- showLegend (true)
- showLabels (true)
- staggerDelay (15)
- mapStyle (default 'positron')
- mapPadding (120)
- fontPair (modernTech)
- colors (primary: #FF6B35, secondary: #1a1a2e, accent: #00D4FF, background: #F2F2F2, text: #2C3E50)

**Visual design:**
- **HeatPoint**: SVG circle with `filter: blur()` for soft edge. Size proportional to value (20-60px radius). Color from colorScale based on normalized value. CSS `box-shadow` multi-layer glow that pulses (opacity oscillates via `interpolate(frame % 40)`). Spring pop-in entrance.
- **MetricCounter**: Top-center overlay showing title + sum of visible points' values, ticking up as points appear.
- **GradientLegend**: Bottom-right overlay, small horizontal bar with gradient + "Low"/"High" labels.
- **Camera**: Static overview via `computeMultiPointViewport` + `getStaticCamera`.
- **Timeline**: Map fades in (0-30), points appear one-by-one with stagger (40-300), legend appears (280), counter shows final value (300-330), fade out (330-360).

**Steps:**
1. Read shared lib and hub-spoke-radial template for pattern reference
2. Create all files following established patterns
3. Import from `../../lib/map`: computeMultiPointViewport, MapTileGrid, getStaticCamera, MAP_STYLES, getTilesForViewport
4. Register in `packages/templates/src/index.ts`
5. Run: `cd packages/templates && npx tsc --noEmit --pretty false`

---

### Task 2: Template — `choropleth-race` (Racing Bubble Chart Map)

**Files to create:**
```
packages/templates/src/templates/choropleth-race/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── GrowingBubble.tsx    # Circle that grows based on value over time
    ├── RankingList.tsx      # Sidebar ranking list that re-sorts
    └── TimeStepCounter.tsx  # Date/step counter at top
```

**meta.json:** slug `choropleth-race`, name "Choropleth Race", category "corporate", aspectRatio "16:9", duration "12s", tags: map, choropleth, race, data, ranking, visualization, growth, statistics, comparison, animated

**metadata.json:** 360 frames, 30fps, 1920x1080

**Schema props:**
- regions: array of `{ lat, lng, label, values: number[] }`, default 6 cities with 5 time steps each showing growth
  ```
  [
    { lat: 40.7128, lng: -74.0060, label: "New York", values: [10, 25, 45, 70, 95] },
    { lat: 34.0522, lng: -118.2437, label: "Los Angeles", values: [8, 20, 35, 55, 78] },
    { lat: 51.5074, lng: -0.1278, label: "London", values: [12, 30, 50, 65, 88] },
    { lat: 35.6762, lng: 139.6503, label: "Tokyo", values: [5, 15, 40, 60, 72] },
    { lat: 48.8566, lng: 2.3522, label: "Paris", values: [7, 18, 30, 50, 65] },
    { lat: -33.8688, lng: 151.2093, label: "Sydney", values: [3, 10, 25, 40, 55] }
  ]
  ```
- title ("Market Growth")
- metricLabel ("Revenue ($M)")
- timeLabels: array of strings (default ["2022", "2023", "2024", "2025", "2026"])
- bubbleColor (#7C3AED)
- showRanking (true)
- mapStyle (default 'positron')
- mapPadding (200) — extra padding for sidebar
- fontPair (modernTech)
- colors (primary: #7C3AED, secondary: #1a1a2e, accent: #00D4FF, background: #F2F2F2, text: #2C3E50)

**Visual design:**
- **Layout**: Map takes left 70%, RankingList takes right 30%.
- **GrowingBubble**: Circle at each coordinate. Size = current interpolated value mapped to 15-80px radius. Semi-transparent fill (0.3 opacity) with solid border. Label below. Smooth size transition using `interpolate` with `Easing.inOut`.
- **RankingList**: Sorted list of regions by current value. Bars with animated width. Items smoothly re-order using translateY when rankings change.
- **TimeStepCounter**: Top-center showing current time label (e.g., "2024"). Interpolate through timeLabels based on frame progress.
- **Camera**: Static overview.
- **Timeline**: Map + bubbles appear (0-40), time progresses through all steps (40-300), hold final state (300-330), fade out (330-360).

**Steps:** Create all files, register, tsc verify.

---

### Task 3: Template — `pin-drop-scatter` (Cascading Pin Drops)

**Files to create:**
```
packages/templates/src/templates/pin-drop-scatter/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── PinCounter.tsx       # Top overlay with incrementing count
    └── ConnectionLine.tsx   # Optional dashed lines between pins
```

**meta.json:** slug `pin-drop-scatter`, name "Pin Drop Scatter", category "social", aspectRatio "1:1", duration "12s", tags: map, pins, locations, scatter, stores, team, franchise, offices, global, markers

**metadata.json:** 360 frames, 30fps, 1080x1080

**Schema props:**
- locations: array of `{ lat, lng, label }`, default 8 world cities
- title ("Our Locations")
- showConnections (false)
- showCounter (true)
- markerColor (#E74C3C)
- markerSize (18)
- staggerDelay (20)
- mapStyle (default 'voyager')
- mapPadding (120)
- fontPair (boldImpact)
- colors (primary: #E74C3C, secondary: #2C3E50, accent: #3498DB, background: #F5F0EB, text: #2C3E50)

**Visual design:**
- **Markers**: Use shared `LocationMarker` with `pinDrop` style. Each drops at `40 + i * staggerDelay`.
- **Labels**: Use shared `LocationLabel`, appear 8 frames after each pin drops.
- **PinCounter**: Top-center pill showing "3 / 8 locations" — numerator increments as pins land.
- **ConnectionLine**: If showConnections, SVG dashed lines connect pins in order. Each line draws after both endpoint pins have landed.
- **Camera**: Static overview via `computeMultiPointViewport`.
- **Timeline**: Map fades in (0-30), title appears (10), pins drop with stagger (40-300), counter updates, hold (300-330), fade out (330-360).

**Steps:** Create all files, reuse shared LocationMarker/LocationLabel, register, tsc verify.

---

### Task 4: Template — `property-spotlight` (Location Amenity Radius)

**Files to create:**
```
packages/templates/src/templates/property-spotlight/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── RadiusRing.tsx       # Animated expanding concentric circle
    ├── POIIcon.tsx          # Category icon (school/park/transit/shop/restaurant/gym)
    └── PropertyPin.tsx      # Central property marker (larger, distinct)
```

**meta.json:** slug `property-spotlight`, name "Property Spotlight", category "corporate", aspectRatio "1:1", duration "12s", tags: map, property, real-estate, amenities, radius, location, neighborhood, spotlight, listing, proximity

**metadata.json:** 360 frames, 30fps, 1080x1080

**Schema props:**
- propertyCoord: `{ lat, lng, label }` (default: { lat: 40.7580, lng: -73.9855, label: "123 Main St" } — Times Square area)
- amenities: array of `{ lat, lng, label, category: 'school'|'park'|'transit'|'shop'|'restaurant'|'gym' }`, default 8-10 POIs around Times Square
- radii: array of numbers in meters (default [500, 1000, 2000])
- title ("Nearby Amenities")
- mapStyle (default 'voyager')
- mapPadding (60) — tight zoom
- fontPair (cleanMinimal)
- colors (primary: #7C3AED, secondary: #2C3E50, accent: #00D4FF, background: #F5F0EB, text: #2C3E50)

**Visual design:**
- **PropertyPin**: Large central marker (double ring, 1.5x size), spring pop-in at frame 20.
- **RadiusRing**: SVG circle with animated scale (0→1) and stroke-dasharray reveal. Semi-transparent fill. Each ring appears sequentially: ring 1 at frame 60, ring 2 at frame 120, ring 3 at frame 180. Label showing "500m", "1km", "2km" appears at edge of each ring.
- **POIIcon**: Small inline SVG per category type (graduation cap for school, tree for park, train for transit, bag for shop, utensils for restaurant, dumbbell for gym). Position at coord with spring pop-in. Icons pop in after their enclosing radius ring has expanded. Color-coded by category.
- **Radius to pixels**: Use `haversineDistance` to determine what map zoom shows the largest radius, then convert radius in meters to pixel distance at that zoom level.
- **Camera**: Static, single-point viewport centered on property at a zoom that fits the largest radius.
- **Timeline**: Map fades in (0-20), property pin drops (20-40), first radius ring expands (60-90) + its POIs pop in (90-120), second ring (120-150) + POIs (150-180), third ring (180-210) + POIs (210-240), title + summary appear (260), hold (280-330), fade out (330-360).

**Steps:** Create all files, register, tsc verify.

---

### Task 5: Template — `neighborhood-guide` (POI Category Map)

**Files to create:**
```
packages/templates/src/templates/neighborhood-guide/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── CategoryIcon.tsx     # SVG icon per POI type with color
    ├── CategoryLegend.tsx   # Side panel showing categories with highlight
    └── CenterMarker.tsx     # Central "You are here" marker
```

**meta.json:** slug `neighborhood-guide`, name "Neighborhood Guide", category "social", aspectRatio "9:16", duration "15s", tags: map, neighborhood, guide, pois, local, city, explore, categories, food, shopping

**metadata.json:** 450 frames, 30fps, 1080x1920

**Schema props:**
- centerCoord: `{ lat, lng, label }` (default: { lat: 40.7282, lng: -73.7949, label: "East Village, NYC" })
- pois: array of `{ lat, lng, label, category: 'food'|'shopping'|'parks'|'transit'|'nightlife'|'culture' }`, default 12-15 POIs
- title ("Neighborhood Guide")
- mapStyle (default 'voyager')
- mapPadding (80)
- fontPair (friendlyTech)
- colors (primary: #E74C3C, secondary: #2C3E50, accent: #3498DB, background: #F5F0EB, text: #2C3E50)

**Visual design:**
- **Layout**: Map takes top 75%, CategoryLegend takes bottom 25% (for 9:16 vertical).
- **CategoryIcon**: Small colored SVG icon per category. Food=fork/knife (red), Shopping=bag (purple), Parks=tree (green), Transit=train (blue), Nightlife=moon (amber), Culture=museum (teal). Spring pop-in.
- **CategoryLegend**: Horizontal row of category pills at bottom. Each pill has icon + label + count. Active category pill highlights (scale 1.1 + border) when its group is animating in.
- **CenterMarker**: "You are here" style — pulsing dot with ring, positioned at centerCoord.
- **Camera**: Static, centered on centerCoord.
- **Animation**: Each category gets ~60 frames. Within each category, POIs pop in staggered 8 frames apart. Legend pill highlights during its category's turn.
- **Timeline**: Map + center marker (0-40), Food group (60-120), Shopping (120-180), Parks (180-240), Transit (240-300), Nightlife (300-360), Culture (360-400), hold (400-430), fade out (430-450).

**Steps:** Create all files, register, tsc verify.

---

### Task 6: Template — `event-locator` (Venue Pin with Details)

**Files to create:**
```
packages/templates/src/templates/event-locator/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── VenuePin.tsx         # Large styled map pin
    ├── EventCard.tsx        # Slide-out info panel with event details
    └── DirectionLine.tsx    # Animated path from landmark to venue
```

**meta.json:** slug `event-locator`, name "Event Locator", category "entertainment", aspectRatio "1:1", duration "10s", tags: map, event, venue, location, invitation, conference, party, directions, address, meetup

**metadata.json:** 300 frames, 30fps, 1080x1080

**Schema props:**
- venueCoord: `{ lat, lng, label }` (default: { lat: 40.7128, lng: -74.0060, label: "The Grand Hall" })
- eventName ("Annual Conference 2026")
- eventDate ("March 15, 2026")
- eventTime ("7:00 PM")
- address ("123 Broadway, New York, NY")
- nearbyLandmarks: array of `{ lat, lng, label }` (default 3 nearby transit/landmarks)
- showDirections (true)
- mapStyle (default 'voyager')
- mapPadding (100)
- fontPair (elegantEditorial)
- colors (primary: #7C3AED, secondary: #2C3E50, accent: #D4A962, background: #F5F0EB, text: #2C3E50)

**Visual design:**
- **Camera**: Animated zoom-in from overview to tight on venue. Use `interpolate` on a custom camera: frames 0-90 zoom from scale 0.6 to 2.0 centered on venue.
- **VenuePin**: Large pin (2x normal) with accent-colored head and drop shadow. Spring drop at frame 90.
- **EventCard**: Slides out to the right of pin at frame 120. Rounded card with: event name (bold, large), date + time, address, separator line. Spring translateX entrance.
- **DirectionLine**: If showDirections, animated dashed lines draw from each landmark to the venue (frames 180-260). Small landmark markers appear at source points. Use shared AnimatedPath with `lineStyle='dashed'`.
- **Timeline**: Wide map (0-90 with zoom-in), pin drops (90-120), event card slides out (120-180), direction lines draw (180-260), hold (260-280), fade out (280-300).

**Steps:** Create all files, register, tsc verify.

---

### Task 7: Template — `coverage-map` (Expanding Service Area)

**Files to create:**
```
packages/templates/src/templates/coverage-map/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── CoverageWave.tsx     # Animated expanding circle
    ├── CoverageStats.tsx    # Stats overlay (cities covered, area)
    └── CenterMarker.tsx     # HQ/origin marker
```

**meta.json:** slug `coverage-map`, name "Coverage Map", category "corporate", aspectRatio "16:9", duration "10s", tags: map, coverage, service-area, delivery, expansion, radius, zone, business, growth, reach

**metadata.json:** 300 frames, 30fps, 1920x1080

**Schema props:**
- centerCoord: `{ lat, lng, label }` (default: { lat: 40.7128, lng: -74.0060, label: "HQ - New York" })
- waves: array of `{ radius: number, label?: string }` in meters (default: [{ radius: 50000, label: "Phase 1" }, { radius: 150000, label: "Phase 2" }, { radius: 300000, label: "Phase 3" }])
- title ("Service Coverage")
- coverageColor (#7C3AED)
- showStats (true)
- mapStyle (default 'positron')
- mapPadding (100)
- fontPair (modernTech)
- colors (primary: #7C3AED, secondary: #1a1a2e, accent: #00D4FF, background: #F2F2F2, text: #2C3E50)

**Visual design:**
- **CoverageWave**: SVG circle with animated scale (0→1). Semi-transparent fill (opacity 0.15). Solid border (2px). Each wave has eased scale animation over 60 frames. Optional wave label at the edge.
- **CenterMarker**: Double-ring marker at center, spring pop-in at frame 20. "HQ" label.
- **CoverageStats**: Bottom overlay showing stats that update per wave: "Phase 1 — 50 km radius", then "Phase 2 — 150 km radius", etc. Spring entrance.
- **Radius to pixels**: Convert meters to pixels — use the ratio: at zoom Z, 1 pixel ≈ `(40075016.686 * Math.cos(lat * Math.PI / 180)) / (256 * Math.pow(2, Z))` meters. Or simply use `haversineDistance` between center and a point at radius distance to calibrate.
- **Camera**: Static overview, zoom level computed to fit the largest radius.
- **Timeline**: Map fades in (0-20), center marker (20-40), wave 1 expands (60-120), wave 2 (130-190), wave 3 (200-260), stats finalize (260-280), fade out (280-300).

**Steps:** Create all files, register, tsc verify.

---

### Task 8: Template — `territory-timeline` (Sequential Region Fill)

**Files to create:**
```
packages/templates/src/templates/territory-timeline/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── TerritoryRegion.tsx  # Colored circle with label + date
    ├── DateCounter.tsx      # Advancing date display at top
    └── ExpansionLine.tsx    # Connecting line between sequential points
```

**meta.json:** slug `territory-timeline`, name "Territory Timeline", category "corporate", aspectRatio "16:9", duration "12s", tags: map, territory, timeline, expansion, growth, history, milestones, chronology, markets, rollout

**metadata.json:** 360 frames, 30fps, 1920x1080

**Schema props:**
- territories: array of `{ lat, lng, label, date, radius? }` (default 6 expansion milestones)
  ```
  [
    { lat: 40.7128, lng: -74.0060, label: "New York", date: "2020" },
    { lat: 34.0522, lng: -118.2437, label: "Los Angeles", date: "2021" },
    { lat: 41.8781, lng: -87.6298, label: "Chicago", date: "2022" },
    { lat: 51.5074, lng: -0.1278, label: "London", date: "2023" },
    { lat: 48.8566, lng: 2.3522, label: "Paris", date: "2024" },
    { lat: 35.6762, lng: 139.6503, label: "Tokyo", date: "2025" }
  ]
  ```
- title ("Our Expansion")
- showConnections (true)
- showDates (true)
- regionColor (#3498DB)
- mapStyle (default 'positron')
- mapPadding (120)
- fontPair (strongReadable)
- colors (primary: #3498DB, secondary: #2C3E50, accent: #E74C3C, background: #F2F2F2, text: #2C3E50)

**Visual design:**
- **TerritoryRegion**: Colored circle (radius 30-50px or from `radius` prop) at coordinate. Semi-transparent fill with solid border. Label text below. Date badge above. Spring scale entrance.
- **DateCounter**: Top-center overlay showing current date. Text updates as timeline advances through territory dates. Large, bold.
- **ExpansionLine**: If showConnections, dashed SVG line draws from previous territory to current one as each new territory appears. Use stroke-dashoffset animation.
- **Camera**: Static overview via `computeMultiPointViewport`.
- **Timeline**: Map fades in (0-30), date counter appears (20). Each territory gets `(280 - 40) / N` frames. Territory N starts at `40 + N * framesPerTerritory`. Connection line draws first, then region circle pops in, then label appears. Fade out (330-360).

**Steps:** Create all files, register, tsc verify.

---

### Task 9: Template — `comparison-split-map` (Side-by-Side Map Comparison)

**Files to create:**
```
packages/templates/src/templates/comparison-split-map/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── MapPanel.tsx         # Clipped map view for one side
    ├── SlidingDivider.tsx   # Animated vertical divider with handle
    └── PanelLabel.tsx       # "Before"/"After" label for each side
```

**meta.json:** slug `comparison-split-map`, name "Comparison Split Map", category "corporate", aspectRatio "16:9", duration "10s", tags: map, comparison, split, before-after, versus, day-night, contrast, dual, overlay, change

**metadata.json:** 300 frames, 30fps, 1920x1080

**Schema props:**
- centerCoord: `{ lat, lng, label }` (default: { lat: 40.7128, lng: -74.0060, label: "New York" })
- leftMapStyle (default 'voyager')
- rightMapStyle (default 'satellite')
- leftLabel ("Before")
- rightLabel ("After")
- showLabels (true)
- dividerColor (#FFFFFF)
- mapPadding (150)
- fontPair (cleanMinimal)
- colors (primary: #7C3AED, secondary: #1a1a2e, accent: #FFFFFF, background: #1a1a1a, text: #FFFFFF)

**Visual design:**
- **Layout**: Full-bleed map, split by a vertical divider. Left side shows one map style, right side shows another. Both render the same viewport/coordinates.
- **MapPanel**: Each panel renders its own MapTileGrid. Use CSS `clip-path: inset(0 <right>% 0 <left>%)` to clip each panel based on divider position.
- **SlidingDivider**: Vertical white line (3px) with a diamond or circle handle in the center. Animates from right edge (100%) to 50% position (frames 30-100), then slowly slides to 30% (frames 100-250) to reveal more of the right panel.
- **PanelLabel**: Large text centered on each panel side. Semi-transparent dark background pill. Spring entrance after divider settles.
- **Camera**: Static, same viewport for both panels. Use `computeViewport` with centerCoord for start AND end (single point, medium zoom).
- **Timeline**: Both maps render (0-20), divider slides in from right (30-100), labels appear (110-140), divider slowly drifts left (100-250) to reveal more of right side, hold (250-280), fade out (280-300).

**Steps:** Create all files, register, tsc verify.

---

### Task 10: Register All & Verify

**Goal:** Add all 9 new template imports to `packages/templates/src/index.ts`, verify TypeScript, rebuild.

**Steps:**

1. Add these imports to `packages/templates/src/index.ts`:
   ```typescript
   import './templates/heatmap-pulse/register';
   import './templates/choropleth-race/register';
   import './templates/pin-drop-scatter/register';
   import './templates/property-spotlight/register';
   import './templates/neighborhood-guide/register';
   import './templates/event-locator/register';
   import './templates/coverage-map/register';
   import './templates/territory-timeline/register';
   import './templates/comparison-split-map/register';
   ```
2. Run: `cd packages/templates && npx tsc --noEmit --pretty false` — only pre-existing errors should appear
3. Run: `cd packages/templates && npx tsup` — must build successfully
4. Verify all 9 appear in dist output
