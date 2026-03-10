# Map Animation Templates Library — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 13 new map animation templates plus a shared map utilities library, expanding the Viona template gallery with the most popular travel animation styles.

**Architecture:** Extract shared map utilities (tile math, camera, distance, components) from the existing `watercolor-map` template into `packages/templates/src/lib/map/`. Each of the 13 new templates gets its own directory under `packages/templates/src/templates/<slug>/` with schema, constants, components, and registration. All templates follow the existing pattern: Zod schema, meta.json, metadata.json, register.ts, index.tsx.

**Tech Stack:** Remotion 4.x, React, TypeScript, Zod, Three.js + @remotion/three (globe-spin only), SVG for paths/overlays, CSS transforms for camera

---

## Reference Files

Before implementing any task, read these files to understand the existing patterns:

- **Template structure**: `packages/templates/src/templates/watercolor-map/` (schema.ts, register.ts, meta.json, metadata.json, constants.ts, index.tsx)
- **Registry**: `packages/templates/src/registry.ts` + `packages/templates/src/index.ts`
- **Tile math**: `packages/templates/src/templates/watercolor-map/lib/tile-math.ts`
- **Camera system**: `packages/templates/src/templates/watercolor-map/lib/camera.ts`
- **Distance utils**: `packages/templates/src/templates/watercolor-map/lib/distance.ts`
- **Components**: `packages/templates/src/templates/watercolor-map/components/*.tsx`
- **Fonts**: `packages/templates/src/fonts.ts`
- **Types**: `packages/templates/src/types.ts`
- **Scale hook**: `packages/templates/src/use-scale.ts`

---

### Task 1: Extract Shared Map Library

**Goal:** Move reusable map utilities from `watercolor-map/lib/` and `watercolor-map/components/` into a shared library at `packages/templates/src/lib/map/`. Refactor the existing `watercolor-map` template to import from the shared lib. Add new map tile styles.

**Files:**
- Create: `packages/templates/src/lib/map/tile-math.ts` (copy from watercolor-map/lib/tile-math.ts)
- Create: `packages/templates/src/lib/map/camera.ts` (copy from watercolor-map/lib/camera.ts)
- Create: `packages/templates/src/lib/map/distance.ts` (copy from watercolor-map/lib/distance.ts)
- Create: `packages/templates/src/lib/map/types.ts` (shared Coord, Viewport types)
- Create: `packages/templates/src/lib/map/map-styles.ts` (MAP_STYLES + new tile providers)
- Create: `packages/templates/src/lib/map/index.ts` (barrel export)
- Create: `packages/templates/src/lib/map/components/MapTileGrid.tsx` (copy from watercolor-map)
- Create: `packages/templates/src/lib/map/components/AnimatedPath.tsx` (copy + extend with glow/dotted)
- Create: `packages/templates/src/lib/map/components/LocationMarker.tsx` (copy + extend with flag/numbered)
- Create: `packages/templates/src/lib/map/components/LocationLabel.tsx` (copy from watercolor-map)
- Modify: `packages/templates/src/templates/watercolor-map/index.tsx` (update imports to shared lib)
- Modify: `packages/templates/src/templates/watercolor-map/constants.ts` (update imports if needed)
- Delete: `packages/templates/src/templates/watercolor-map/lib/` (after migration)
- Delete: `packages/templates/src/templates/watercolor-map/components/MapTileGrid.tsx`, `AnimatedPath.tsx`, `LocationMarker.tsx`, `LocationLabel.tsx` (moved to shared)

**Steps:**

1. Read all files in `watercolor-map/lib/` and `watercolor-map/components/` to understand the full code
2. Create `packages/templates/src/lib/map/types.ts` extracting `Coord`, `Viewport`, `MultiPointViewport`, `TileInfo`, `MapStyle`, `MapStyleConfig` types
3. Create `packages/templates/src/lib/map/map-styles.ts` with the existing `MAP_STYLES` object + add these new providers:
   ```typescript
   darkMatter: {
     urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
     background: '#0e0e0e',
     darkMap: true,
   },
   voyager: {
     urlTemplate: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
     background: '#F2EFE9',
     darkMap: false,
   },
   positron: {
     urlTemplate: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
     background: '#F2F2F2',
     darkMap: false,
   },
   ```
4. Copy `tile-math.ts`, `camera.ts`, `distance.ts` to `lib/map/`, updating type imports to use local `types.ts` and `map-styles.ts`
5. Copy shared components (`MapTileGrid.tsx`, `AnimatedPath.tsx`, `LocationMarker.tsx`, `LocationLabel.tsx`) to `lib/map/components/`, updating imports
6. Extend `AnimatedPath.tsx` to support `lineStyle: 'solid' | 'dashed' | 'dotted' | 'glow'` — for `dotted` use small dasharray, for `glow` render an extra wide semi-transparent stroke underneath
7. Extend `LocationMarker.tsx` to support `markerStyle: 'pulse' | 'pinDrop' | 'ripple' | 'flag' | 'numbered'` — `flag` is a small flag SVG, `numbered` shows a circled number
8. Create `lib/map/index.ts` barrel export for everything
9. Update `watercolor-map/index.tsx` to import from `../../lib/map` instead of `./lib/*` and `./components/*`
10. Keep `watercolor-map/components/AirplaneIcon.tsx`, `DistanceCounter.tsx`, `ProgressBar.tsx`, `CompassRose.tsx` in the template (template-specific, not shared)
11. Delete the old `watercolor-map/lib/` files and the 4 migrated component files
12. Update `watercolor-map/register.ts` fileNames list to remove the deleted lib/ files
13. Run: `cd packages/templates && npx tsc --noEmit` — verify no errors
14. Commit: `refactor: extract shared map library from watercolor-map template`

---

### Task 2: Template — `indiana-jones` (Vintage Red Line)

**Files to create:**
```
packages/templates/src/templates/indiana-jones/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── VintageOverlay.tsx    # Parchment texture + vignette via CSS gradients
    ├── SerifLabel.tsx        # Serif font city label
    └── AirplaneTrail.tsx     # Airplane icon following dashed path
```

**meta.json:**
```json
{
  "slug": "indiana-jones",
  "name": "Indiana Jones Trail",
  "description": "Classic vintage red dashed line tracing a route across a parchment-style map with airplane icon and compass",
  "category": "entertainment",
  "tags": ["adventure", "vintage", "classic", "travel", "retro", "parchment", "map", "journey", "explorer", "cinematic"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "16:9",
  "sceneCount": 1,
  "estimatedDuration": "10s",
  "thumbnail": "thumbnail.png"
}
```

**metadata.json:** `{ "compositionId": "indiana-jones", "durationInFrames": 300, "fps": 30, "width": 1920, "height": 1080 }`

**Schema props:** startCoord (default Paris), endCoord (default Cairo), waypoints, title (string, default "The Journey Begins"), lineColor (#C0392B), lineWidth (5), showCompass (true), showDistance (true), fontPair (elegantEditorial), colors (primary: #C0392B, secondary: #2C3E50, accent: #D4A962, background: #F5E6C8, text: #2C3E50)

**Visual design:**
- **VintageOverlay**: CSS radial-gradient creating parchment effect + vignette with `box-shadow: inset 0 0 150px rgba(0,0,0,0.3)` + subtle noise via SVG feTurbulence filter
- **Map tiles**: Use `terrain` with CSS filter: `sepia(0.7) contrast(1.1) brightness(1.05)`
- **Line**: Red dashed (dasharray: `lineWidth*4 lineWidth*3`), animated with stroke-dashoffset mask
- **AirplaneTrail**: Small airplane SVG following bezier path tip, rotated to tangent angle
- **Camera**: `followDraw` camera from shared lib, drawStartFrame=40, drawEndFrame=220, slow zoom out 220-280
- **Title**: Serif font (from fontPair) displayed top-center, fades in frames 0-30
- **Labels**: SerifLabel component with slight drop shadow, appear at frame 240

**Steps:**
1. Read the shared lib at `packages/templates/src/lib/map/` to understand available utilities
2. Create all files following the pattern in `watercolor-map/`
3. Import camera, tile math, AnimatedPath, LocationMarker, LocationLabel from shared lib
4. Create template-specific components (VintageOverlay, SerifLabel, AirplaneTrail)
5. Register in `packages/templates/src/index.ts`: add `import './templates/indiana-jones/register';`
6. Run: `cd packages/templates && npx tsc --noEmit`
7. Commit: `feat: add indiana-jones vintage red line map template`

---

### Task 3: Template — `globe-spin` (3D Globe with Arc)

**Files to create:**
```
packages/templates/src/templates/globe-spin/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── GlobeScene.tsx       # Three.js sphere + earth texture
    ├── ArcLine3D.tsx        # 3D great circle arc between points
    └── ProjectedLabel.tsx   # HTML label positioned via 3D-to-2D projection
```

**Prerequisites:** Install `@remotion/three` and `three` + `@types/three` in `packages/templates/`.

**meta.json:**
```json
{
  "slug": "globe-spin",
  "name": "Globe Spin",
  "description": "3D rotating globe with a glowing arc connecting two cities, cinematic camera orbit and zoom",
  "category": "social",
  "tags": ["3d", "globe", "world", "international", "flight", "arc", "cinematic", "travel", "earth", "animation"],
  "stylePreset": "modernTech",
  "aspectRatio": "1:1",
  "sceneCount": 1,
  "estimatedDuration": "12s",
  "thumbnail": "thumbnail.png"
}
```

**metadata.json:** `{ "compositionId": "globe-spin", "durationInFrames": 360, "fps": 30, "width": 1080, "height": 1080 }`

**Schema props:** startCoord (default New York), endCoord (default London), globeStyle (realistic/wireframe/minimal), arcColor (#FF6B35), arcWidth (3), showLabels (true), rotationSpeed (0.5), backgroundColor (#0a0a1a), showStars (true)

**Visual design:**
- **GlobeScene**: Use `<ThreeCanvas>` from @remotion/three. SphereGeometry with a procedurally-generated earth texture (use a free equirectangular earth image URL or generate from colored continents). Ambient + directional light for shading.
- **ArcLine3D**: Great circle arc computed from lat/lng, rendered as TubeGeometry or Line2 with glow material. Arc draws progressively using `setDrawRange`.
- **Camera**: useThree camera — start zoomed out, rotate to show start point (frames 0-90), hold while arc draws (90-270), zoom to destination (270-360)
- **Stars background**: Small white dots on dark background if showStars=true
- **ProjectedLabel**: Convert 3D sphere surface point to 2D screen via camera.project(), render as absolutely-positioned HTML div

**Steps:**
1. Run: `cd packages/templates && npm install @remotion/three three @types/three`
2. Read @remotion/three docs (use `<ThreeCanvas>` with `width`/`height` from Remotion)
3. Create all files — note this template does NOT use the shared tile map lib (it's pure 3D)
4. For earth texture: use a publicly available equirectangular image or create a simple procedural texture with continent shapes in a canvas
5. For the great circle arc: compute intermediate points using spherical interpolation (slerp) between lat/lng coords converted to 3D xyz on unit sphere
6. Register in index.ts
7. Run: `cd packages/templates && npx tsc --noEmit`
8. Commit: `feat: add globe-spin 3D globe template`

---

### Task 4: Template — `neon-dark-map` (Neon Glow Dark Mode)

**Files to create:**
```
packages/templates/src/templates/neon-dark-map/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── NeonPath.tsx         # Multi-layered glow path (wide blur + narrow core)
    ├── GlowMarker.tsx       # Marker with neon glow halo
    └── NeonLabel.tsx        # Neon-colored text with subtle glow
```

**meta.json:**
```json
{
  "slug": "neon-dark-map",
  "name": "Neon Dark Map",
  "description": "Futuristic dark map with neon-glow route line, pulsing markers, and cyberpunk-style typography",
  "category": "social",
  "tags": ["neon", "dark", "cyberpunk", "futuristic", "glow", "nightlife", "travel", "map", "modern", "trendy"],
  "stylePreset": "modernTech",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "10s",
  "thumbnail": "thumbnail.png"
}
```

**metadata.json:** `{ "compositionId": "neon-dark-map", "durationInFrames": 300, "fps": 30, "width": 1080, "height": 1920 }`

**Schema props:** startCoord (default Tokyo), endCoord (default Seoul), waypoints, neonColor (#00F5FF), glowIntensity (1.0), lineWidth (3), showDistance (true), showLabels (true), fontPair (modernTech), colors (primary: #00F5FF, secondary: #FF00FF, accent: #00FF88, background: #0e0e0e, text: #FFFFFF)

**Visual design:**
- **Map tiles**: `darkMatter` from shared map-styles
- **NeonPath**: SVG with 3 layered strokes — outer glow (wide, blurred, 20% opacity), mid glow (medium, 40%), core line (narrow, 100%). Animated stroke-dashoffset. CSS filter `blur()` on outer layers.
- **GlowMarker**: Dot with CSS `box-shadow: 0 0 20px <neonColor>, 0 0 40px <neonColor>` for glow halo, pulsing opacity animation
- **NeonLabel**: Text with `text-shadow` multi-layer glow effect
- **Camera**: followDraw from shared lib
- Uses shared lib for: tile-math, camera, MapTileGrid, distance

**Steps:**
1. Create all files using shared map lib for tiles/camera/viewport
2. NeonPath renders 3 SVG `<path>` elements stacked with decreasing width and increasing opacity
3. Register in index.ts
4. Run tsc, commit: `feat: add neon-dark-map template`

---

### Task 5: Template — `road-trip` (Street-Level Road Trip)

**Files to create:**
```
packages/templates/src/templates/road-trip/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── VehicleIcon.tsx      # SVG car/van/motorcycle/bicycle with rotation
    ├── MileCounter.tsx      # Ticking distance counter overlay
    └── WaypointPopup.tsx    # City name popup at waypoints
```

**meta.json:** slug `road-trip`, name "Road Trip", category "social", aspectRatio "16:9", duration "12s", tags: road-trip, driving, car, van, journey, highway, adventure, travel, route, distance

**metadata.json:** `{ "compositionId": "road-trip", "durationInFrames": 360, "fps": 30, "width": 1920, "height": 1080 }`

**Schema props:** startCoord (default LA), endCoord (default Las Vegas), waypoints, vehicleType (car/van/motorcycle/bicycle, default car), unit (miles/km, default miles), lineColor (#3498DB), lineWidth (4), lineStyle (dashed), showDistance (true), showLabels (true), mapStyle (osm), mapPadding (120), curveIntensity (0.15), fontPair (friendlyTech), colors

**Visual design:**
- **Map tiles**: `osm` or `voyager` — use mapPadding 120 for tighter zoom showing street detail
- **VehicleIcon**: 4 SVG icons (car, van, motorcycle, bicycle). Position at path tip, rotate to tangent angle. Slight vertical bounce (2px sin wave at 4fps).
- **MileCounter**: Bottom-center overlay, monospace font, counts up from 0 to totalDistance, synced with drawProgress
- **Camera**: followDraw at slightly higher base zoom than watercolor-map
- Uses shared lib

**Steps:**
1. Create all files, import shared map lib
2. VehicleIcon.tsx contains inline SVGs for each vehicle type, switched by prop
3. Register, tsc, commit: `feat: add road-trip template`

---

### Task 6: Template — `multi-stop-journey` (Timeline Trip Recap)

**Files to create:**
```
packages/templates/src/templates/multi-stop-journey/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── NumberedMarker.tsx    # Circled number marker with spring pop-in
    ├── StopLabel.tsx         # City name + optional date label
    └── TripTitle.tsx         # Title overlay at top
```

**meta.json:** slug `multi-stop-journey`, name "Multi-Stop Journey", category "social", aspectRatio "1:1", duration "15s"

**metadata.json:** 450 frames, 30fps, 1080x1080

**Schema props:** stops (array of {lat, lng, label, date?}, default: 4 European cities), title ("My Trip 2026"), lineColor (#E74C3C), markerColor (#E74C3C), showDates (true), showTotalDistance (true), cameraMode (overview/followEach, default overview), mapStyle (voyager), fontPair

**Visual design:**
- **NumberedMarker**: Circle with number inside (1, 2, 3...), spring pop-in when path reaches that stop. White circle, colored border and number.
- **Path**: Use shared AnimatedPath, draw between each consecutive pair of stops with staggered timing (divide total draw frames by segment count)
- **StopLabel**: City name in bold + date in smaller muted text, appears with fade after marker lands
- **TripTitle**: Displayed top-center, fades in frames 0-30
- **Camera**: `overview` = static showing all stops; `followEach` = brief zoom to each stop as it's reached
- Uses shared lib (computeMultiPointViewport)

**Steps:** Create files, register, tsc, commit: `feat: add multi-stop-journey template`

---

### Task 7: Template — `elevation-profile` (Split View with Elevation)

**Files to create:**
```
packages/templates/src/templates/elevation-profile/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── ElevationChart.tsx    # SVG area chart with gradient fill
    ├── AltitudeLabel.tsx     # Peak altitude marker
    └── StatsBadge.tsx        # Total ascent/descent overlay
```

**meta.json:** slug `elevation-profile`, name "Elevation Profile", category "social", aspectRatio "16:9", duration "12s", tags: hiking, cycling, elevation, altitude, terrain, adventure, mountain, trail, sports, outdoor

**metadata.json:** 360 frames, 30fps, 1920x1080

**Schema props:** startCoord, endCoord, waypoints, elevationData (array of {distance: number, altitude: number}, default: sample mountain hike), unit (meters/feet, default meters), showPeakLabels (true), showStats (true), lineColor (#27AE60), mapStyle (terrain), fontPair (strongReadable), colors

**Visual design:**
- **Layout**: Top 60% = map with route; Bottom 40% = elevation chart. Separated by a thin line.
- **ElevationChart**: SVG `<path>` area chart filled with gradient (green→transparent). X-axis = distance, Y-axis = altitude. Animated by clipping from left to right synced with route drawProgress. Grid lines for altitude reference.
- **Map section**: Standard shared lib map with terrain tiles, route draws using AnimatedPath
- **AltitudeLabel**: Small badge at highest point showing altitude value
- **StatsBadge**: Bottom-right overlay showing total ascent ↑ and descent ↓

**Steps:** Create files, register, tsc, commit: `feat: add elevation-profile template`

---

### Task 8: Template — `postcard-reveal` (Map to Postcard Transition)

**Files to create:**
```
packages/templates/src/templates/postcard-reveal/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── PostcardFrame.tsx     # Vintage postcard border + typography
    ├── StampOverlay.tsx      # Faux postage stamp
    └── PostmarkCircle.tsx    # Circular postmark overlay
```

**meta.json:** slug `postcard-reveal`, name "Postcard Reveal", category "social", aspectRatio "1:1", duration "10s"

**metadata.json:** 300 frames, 30fps, 1080x1080

**Schema props:** startCoord, endCoord, destinationName ("Rome"), greeting ("Greetings from"), stampColor (#C0392B), borderStyle (classic/modern/ornate, default classic), showPostmark (true), mapStyle (watercolor), fontPair (elegantEditorial), colors

**Visual design:**
- **Phase 1 (0-150)**: Map with route drawing from start to end, camera zooming into destination
- **Phase 2 (150-180)**: 3D card flip transition using CSS `rotateY` with perspective
- **Phase 3 (180-300)**: Postcard face — cream background, decorative border, large serif "Greetings from" + destination name, stamp in top-right corner (colored rectangle with wavy edge border), circular postmark over stamp
- **Flip**: Use CSS `transform: perspective(1000px) rotateY()` interpolated 0→180 degrees, show map front on 0-90deg, postcard back on 90-180deg with `backface-visibility: hidden`

**Steps:** Create files, register, tsc, commit: `feat: add postcard-reveal template`

---

### Task 9: Template — `satellite-flyover` (Cinematic Satellite Pan)

**Files to create:**
```
packages/templates/src/templates/satellite-flyover/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── CloudLayer.tsx       # Semi-transparent drifting cloud blobs
    └── LowerThirdLabel.tsx  # Documentary-style label bar
```

**meta.json:** slug `satellite-flyover`, name "Satellite Flyover", category "social", aspectRatio "16:9", duration "12s", tags: satellite, aerial, cinematic, documentary, flyover, earth, landscape, travel, nature, drone

**metadata.json:** 360 frames, 30fps, 1920x1080

**Schema props:** startCoord, endCoord, waypoints, showClouds (true), labelStyle (lowerThird/minimal/none, default lowerThird), showDistance (false), lineColor (rgba(255,255,255,0.6)), lineWidth (3), mapStyle (satellite), fontPair (cleanMinimal), colors

**Visual design:**
- **Map tiles**: `satellite` (ArcGIS imagery)
- **Camera**: kenBurns-style from shared lib, slow drift following route
- **CloudLayer**: 2-3 semi-transparent white SVG blobs with slow X-axis drift animation (translate), opacity oscillating 0.1-0.3
- **LowerThirdLabel**: Semi-transparent dark bar (bg black/60) at bottom-left with white text showing city name, fades in/out at start/end
- **Line**: Semi-transparent white, thin, uses shared AnimatedPath

**Steps:** Create files, register, tsc, commit: `feat: add satellite-flyover template`

---

### Task 10: Template — `minimalist-line` (Pure Line Art)

**Files to create:**
```
packages/templates/src/templates/minimalist-line/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── MinimalPath.tsx      # SVG stroke-dashoffset animated line
    └── MinimalLabel.tsx     # Clean sans-serif label
```

**meta.json:** slug `minimalist-line`, name "Minimalist Line", category "corporate", aspectRatio "16:9", duration "8s", tags: minimal, clean, editorial, line-art, abstract, modern, corporate, simple, elegant, design

**metadata.json:** 240 frames, 30fps, 1920x1080

**Schema props:** startCoord (default London), endCoord (default Paris), waypoints, backgroundColor (#FFFFFF), lineColor (#1a1a1a), lineWidth (2), showDots (true), showLabels (true), title (""), fontPair (cleanMinimal)

**Visual design:**
- **NO map tiles** — pure solid background color
- **MinimalPath**: SVG bezier from point A to B (use shared bezier math to compute positions, but position points as % of viewport width/height rather than tile pixels). Animated stroke-dashoffset.
- **Dots**: Small circles at start/end/waypoints, fade in with path progress
- **MinimalLabel**: City name in Inter/clean sans-serif, positioned below dots, fade in after path reaches point
- **Camera**: Static, no movement. Points positioned evenly across viewport width.
- Note: This template computes point positions differently — not from tile math but as evenly-spaced layout positions. Use the haversine bearing to determine relative left-right positioning.

**Steps:** Create files, register, tsc, commit: `feat: add minimalist-line template`

---

### Task 11: Template — `split-departure` (Departure / Arrival Split)

**Files to create:**
```
packages/templates/src/templates/split-departure/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── SplitPanel.tsx       # One half of the split view with its own map viewport
    ├── CenterArc.tsx        # Animated arc in the center gap
    └── PanelLabel.tsx       # City label overlay for each panel
```

**meta.json:** slug `split-departure`, name "Split Departure", category "social", aspectRatio "9:16", duration "10s", tags: departure, arrival, split, moving, relocation, travel, city, versus, comparison, journey

**metadata.json:** 300 frames, 30fps, 1080x1920

**Schema props:** startCoord, endCoord, splitDirection (horizontal/vertical, default vertical for 9:16), mapStyle (voyager), lineColor (#7C3AED), showDistance (true), showLabels (true), fontPair (modernTech), colors

**Visual design:**
- **Layout**: Screen split into 2 panels with a small gap (8px). For vertical: top=origin, bottom=destination. For horizontal: left=origin, right=destination.
- **SplitPanel**: Each panel renders its own MapTileGrid at higher zoom (single-point viewport centered on that city), using shared lib.
- **Animation**: Panels slide in from edges (translateX or translateY) frames 0-40 with spring. Arc draws in center gap frames 60-200. Labels appear frames 220+.
- **CenterArc**: SVG curved line connecting the two panels, animated stroke-dashoffset
- **PanelLabel**: City name overlaid on each panel, semi-transparent background

**Steps:** Create files, register, tsc, commit: `feat: add split-departure template`

---

### Task 12: Template — `compass-navigator` (Compass-Centric)

**Files to create:**
```
packages/templates/src/templates/compass-navigator/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── CompassRoseEnhanced.tsx  # Large ornate compass with N/S/E/W
    ├── AnimatedNeedle.tsx       # Needle that spins to bearing
    └── BearingLabel.tsx         # Shows bearing degrees
```

**meta.json:** slug `compass-navigator`, name "Compass Navigator", category "entertainment", aspectRatio "1:1", duration "12s", tags: compass, nautical, explorer, navigation, bearing, direction, travel, maritime, adventure, vintage

**metadata.json:** 360 frames, 30fps, 1080x1080

**Schema props:** startCoord, endCoord, compassStyle (classic/modern/nautical, default classic), showBearing (true), mapStyle (terrain), lineColor (#2C3E50), showLabels (true), fontPair (elegantEditorial), colors

**Visual design:**
- **Phase 1 (0-90)**: Compass rose fades in center-screen, large (takes up 40% of frame), needle spins settling on bearing direction. Bearing computed via atan2 of lat/lng difference.
- **Phase 2 (90-180)**: Map tiles fade in behind compass (opacity 0→1), compass shrinks and moves to bottom-right corner (scale + translate animation)
- **Phase 3 (180-330)**: Route draws on map using shared AnimatedPath, markers appear
- **Phase 4 (330-360)**: Fade out
- **CompassRoseEnhanced**: SVG compass with circle, cardinal directions (N/S/E/W), degree markings, decorative ring. Style variants change colors and ornamentation level.
- **AnimatedNeedle**: Red/dark needle SVG, rotated via CSS transform to target bearing with spring animation

**Steps:** Create files, register, tsc, commit: `feat: add compass-navigator template`

---

### Task 13: Template — `hub-spoke-radial` (Radiating Destinations)

**Files to create:**
```
packages/templates/src/templates/hub-spoke-radial/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── HubMarker.tsx           # Central hub marker (larger, different style)
    ├── SpokeAnimation.tsx      # Individual spoke line with staggered animation
    └── DestinationCounter.tsx   # Total destinations/distance counter
```

**meta.json:** slug `hub-spoke-radial`, name "Hub & Spoke", category "social", aspectRatio "1:1", duration "12s", tags: hub, spoke, radial, destinations, yearly-recap, travel-recap, multiple, cities, visited, summary

**metadata.json:** 360 frames, 30fps, 1080x1080

**Schema props:** hubCoord (default NYC {lat: 40.7128, lng: -74.0060, label: "New York"}), destinations (array of {lat, lng, label}, default: 5 cities), lineColor (#E74C3C), spokeStyle (solid/dashed/dotted, default solid), showDistances (true), showTotalCount (true), title ("Places I Visited"), staggerDelay (15), mapStyle (positron), fontPair (boldImpact), colors

**Visual design:**
- **Map tiles**: positron or tonerLite (light, clean)
- **Camera**: Static overview (use computeMultiPointViewport with hub + all destinations)
- **HubMarker**: Larger marker at center (1.5x size), distinct style (double ring)
- **SpokeAnimation**: Each spoke draws from hub to destination with staggered timing. Spoke N starts at frame `60 + N*staggerDelay`. Each spoke takes 90 frames to draw.
- **Destination markers**: Pop in (spring) when spoke reaches them
- **DestinationCounter**: Top overlay showing "5 destinations" or "12,450 km total", counts up as spokes complete
- Uses shared lib (computeMultiPointViewport, MapTileGrid, AnimatedPath)

**Steps:** Create files, register, tsc, commit: `feat: add hub-spoke-radial template`

---

### Task 14: Template — `timezone-traveler` (Time Zone Crossing)

**Files to create:**
```
packages/templates/src/templates/timezone-traveler/
├── register.ts
├── meta.json
├── metadata.json
├── schema.ts
├── constants.ts
├── index.tsx
└── components/
    ├── TimeZoneBands.tsx    # Vertical semi-transparent timezone bands
    ├── ClockDisplay.tsx     # Digital or analog clock
    └── ZoneLabel.tsx        # UTC offset label at top of each band
```

**meta.json:** slug `timezone-traveler`, name "Timezone Traveler", category "social", aspectRatio "16:9", duration "12s", tags: timezone, time, clock, international, long-haul, flight, jet-lag, world, global, crossing

**metadata.json:** 360 frames, 30fps, 1920x1080

**Schema props:** startCoord (default NYC), endCoord (default Tokyo), startTimezone ("UTC-5"), endTimezone ("UTC+9"), clockStyle (digital/analog, default digital), showZoneBands (true), showLocalTimes (true), lineColor (#3498DB), mapStyle (positron), fontPair (modernTech), colors

**Visual design:**
- **Map tiles**: positron (light, so timezone bands are visible)
- **TimeZoneBands**: Vertical bands at each 15-degree longitude interval (360/24=15deg per timezone). Alternating semi-transparent tints (rgba(0,0,0,0.03) and rgba(0,0,0,0.06)). Zone labels ("UTC-5", "UTC+0", etc.) at top.
- **ClockDisplay**: Digital = monospace HH:MM with blinking colon; Analog = circular clock face with hour/minute hands. Positioned top-right. Time interpolates from start timezone to end timezone as route progress advances.
- **Route**: Standard animated path from shared lib
- **Camera**: Slow pan following route (followDraw), wider zoom to show timezone transitions

**Steps:** Create files, register, tsc, commit: `feat: add timezone-traveler template`

---

### Task 15: Register All Templates & Verify

**Goal:** Add all 13 new template imports to `packages/templates/src/index.ts`, verify TypeScript compilation, and ensure the templates app gallery renders all new templates.

**Files:**
- Modify: `packages/templates/src/index.ts` — add 13 import lines

**Steps:**

1. Add these imports to `packages/templates/src/index.ts` after the existing watercolor-map import:
   ```typescript
   import './templates/indiana-jones/register';
   import './templates/globe-spin/register';
   import './templates/neon-dark-map/register';
   import './templates/road-trip/register';
   import './templates/multi-stop-journey/register';
   import './templates/elevation-profile/register';
   import './templates/postcard-reveal/register';
   import './templates/satellite-flyover/register';
   import './templates/minimalist-line/register';
   import './templates/split-departure/register';
   import './templates/compass-navigator/register';
   import './templates/hub-spoke-radial/register';
   import './templates/timezone-traveler/register';
   ```
2. Run: `cd packages/templates && npx tsc --noEmit` — must pass clean
3. Run: `cd apps/templates && npx next build` — must build successfully
4. Verify template count: the gallery header should show the previous count + 13
5. Commit: `feat: register all 13 new map animation templates`
