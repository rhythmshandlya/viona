# Map Animation Templates Library — Design

**Date**: 2026-03-02
**Goal**: Build 13 new map animation templates for the Viona template gallery, covering the most popular travel animation styles trending on social media (TikTok, Reels, YouTube).

## Context

The existing `watercolor-map` template (renamed "Travel Animation") supports 6 animation types via a single schema. We're expanding to **13 separate templates**, each with its own directory, schema, card, and components. All templates support all 3 aspect ratios (16:9, 9:16, 1:1). Each is a self-contained Remotion composition registered in `packages/templates/`.

## Shared Infrastructure

### Extracted Shared Library: `packages/templates/src/lib/map/`

To avoid duplicating 500+ lines of tile math, camera, and distance code across 14 templates (existing + 13 new), extract a shared library:

- `tile-math.ts` — viewport, tile computation, bezier curves, slippy math
- `camera.ts` — camera presets: followDraw, zoomReveal, kenBurns, static, orbit, flyover (extended)
- `distance.ts` — haversine distance calculation + formatting
- `types.ts` — shared Coord, Viewport, MapStyleConfig, MultiPointViewport types
- `map-styles.ts` — all tile provider URLs including new ones:
  - Existing: watercolor, satellite, toner, tonerLite, terrain, osm
  - New: `darkMatter` (CartoDB), `voyager` (CartoDB), `positron` (CartoDB)
- `components/MapTileGrid.tsx` — shared tile renderer
- `components/AnimatedPath.tsx` — shared path drawing (solid, dashed, dotted, glow variants)
- `components/LocationMarker.tsx` — shared markers (pulse, pinDrop, ripple, flag, numbered)
- `components/LocationLabel.tsx` — shared labels

The existing `watercolor-map` template will be refactored to import from this shared lib.

### New Dependencies

- `@remotion/three` + `three` — for globe-spin template (3D globe)

## Template Designs

### 1. `indiana-jones` — Vintage Red Line

- **Visual**: Parchment/aged paper background (CSS radial gradients + noise), bold red dashed line animating point-to-point, airplane icon following path with rotation, compass rose, aged vignette edges
- **Map tiles**: `terrain` or `tonerLite` with CSS `sepia(0.8) contrast(1.1)` filter
- **Camera**: Slow pan following the drawn line, slight zoom out at end
- **Overlays**: City names in serif font, compass rose, optional distance counter
- **Duration**: 10s (300 frames @ 30fps)
- **Components**: VintageOverlay (vignette + noise), SerifLabel
- **Schema**: startCoord, endCoord, waypoints, title, lineColor (#C0392B), showCompass, showDistance

### 2. `globe-spin` — 3D Globe with Arc

- **Visual**: Realistic 3D globe using `@remotion/three` + Three.js sphere with earth texture, glowing arc line between origin and destination, camera orbits and zooms to destination
- **Rendering**: `<ThreeCanvas>` from @remotion/three, SphereGeometry with earth texture, custom Line geometry for arc
- **Camera**: Start zoomed out showing full globe, rotate to origin, arc animates, camera follows to destination, zoom in
- **Overlays**: City labels as HTML overlays via 3D-to-2D projection, distance counter
- **Duration**: 12s (360 frames)
- **Components**: GlobeScene, ArcLine3D, ProjectedLabel
- **Schema**: startCoord, endCoord, globeStyle (realistic/wireframe/minimal), arcColor, showLabels, rotationSpeed

### 3. `neon-dark-map` — Neon Glow Dark Mode

- **Visual**: Dark map tiles (CartoDB dark-matter), neon-glow route line with bloom effect (CSS box-shadow stacking), pulsing markers with glow halos, futuristic sans-serif typography
- **Map tiles**: `darkMatter` (CartoDB)
- **Line**: Multiple layered SVG strokes — wide transparent glow + narrow bright core, animated dashoffset
- **Camera**: Smooth followDraw with slight zoom
- **Duration**: 10s (300 frames)
- **Components**: NeonPath, GlowMarker, NeonLabel
- **Schema**: startCoord, endCoord, neonColor (#00F5FF), glowIntensity, mapStyle (darkMatter/toner), showDistance, waypoints

### 4. `road-trip` — Street-Level Road Trip

- **Visual**: Higher zoom level showing streets, animated dashed line, vehicle icon (car/van/motorcycle) moving along path, mile counter ticking up
- **Map tiles**: `osm` or `voyager` at higher zoom for street detail
- **Camera**: followDraw at higher zoom, panning with vehicle
- **Vehicle**: SVG icon rotating with path tangent, slight bounce
- **Duration**: 12s (360 frames)
- **Components**: VehicleIcon (car/van/motorcycle/bicycle SVGs), SpeedCounter, MileCounter
- **Schema**: startCoord, endCoord, waypoints, vehicleType (car/van/motorcycle/bicycle), unit (miles/km), lineColor, showDistance, showSpeed

### 5. `multi-stop-journey` — Timeline Trip Recap

- **Visual**: Map with 3-6 numbered stops, path animates sequentially, numbered circle markers pop in, labels with city name and optional date
- **Map tiles**: `voyager` or `watercolor`
- **Camera**: Overview of all stops, optionally zooms to each briefly
- **Markers**: Numbered circles with spring pop-in animation
- **Duration**: 15s (450 frames)
- **Components**: NumberedMarker, StopLabel (with date), TripTitle
- **Schema**: stops (array of {coord, label, date?}), title, lineColor, markerColor, showDates, showTotalDistance, cameraMode (overview/followEach)

### 6. `elevation-profile` — Split View with Elevation

- **Visual**: Map on top 60%, animated elevation chart on bottom 40%, route draws on map while elevation profile fills in below
- **Map tiles**: `terrain`
- **Elevation chart**: SVG area chart with gradient fill, animated left-to-right synced with route drawing
- **Camera**: Slow pan following route on map portion
- **Duration**: 12s (360 frames)
- **Components**: ElevationChart (SVG area chart), AltitudeLabel, StatsBadge
- **Schema**: startCoord, endCoord, waypoints, elevationData (array of {distance, altitude}), unit (meters/feet), showPeakLabels, showStats, lineColor

### 7. `postcard-reveal` — Map to Postcard Transition

- **Visual**: Starts as map animation zooming into destination, midpoint 3D card-flip CSS transform into vintage postcard frame with stylized serif typography, stamp and postmark overlays
- **Map tiles**: `watercolor`
- **Camera**: Zoom into destination, hold, flip
- **Duration**: 10s (300 frames)
- **Components**: PostcardFrame, StampOverlay, PostmarkCircle, FlipTransition
- **Schema**: startCoord, endCoord, destinationName, greeting ("Greetings from"), stampColor, borderStyle (classic/modern/ornate), showPostmark

### 8. `satellite-flyover` — Cinematic Satellite Pan

- **Visual**: Satellite imagery, smooth cinematic camera pan following route, subtle cloud overlay layer (semi-transparent white shapes drifting), documentary-style lower-third labels
- **Map tiles**: `satellite`
- **Camera**: kenBurns-style slow drift combined with path-following, slight tilt via CSS perspective
- **Cloud layer**: 2-3 semi-transparent white blobs with slow drift animation
- **Duration**: 12s (360 frames)
- **Components**: CloudLayer, LowerThirdLabel, LensFlare
- **Schema**: startCoord, endCoord, waypoints, showClouds, labelStyle (lowerThird/minimal/none), showDistance, lineColor, lineOpacity

### 9. `minimalist-line` — Pure Line Art

- **Visual**: Pure white (or black) background, NO map tiles, single thin line drawing between labeled points, ultra-minimal editorial aesthetic
- **Rendering**: No tile grid — just SVG bezier paths on solid background
- **Camera**: Static or very subtle zoom out
- **Duration**: 8s (240 frames)
- **Components**: MinimalPath (SVG stroke-dashoffset animation), MinimalLabel
- **Schema**: startCoord, endCoord, waypoints, backgroundColor (white/black/custom), lineColor, lineWidth, fontFamily (inter/mono/serif), showDots, showLabels, title

### 10. `split-departure` — Departure / Arrival Split

- **Visual**: Screen split into two panels (side-by-side or top-bottom), left panel zoomed into origin, right panel zoomed into destination, animated arc connecting them, panels slide in from edges
- **Map tiles**: `voyager` or `osm` at high zoom
- **Camera**: Each panel has its own viewport, static within each
- **Duration**: 10s (300 frames)
- **Components**: SplitPanel, CenterArc, PanelLabel
- **Schema**: startCoord, endCoord, splitDirection (horizontal/vertical), mapStyle, lineColor, showDistance, showLabels

### 11. `compass-navigator` — Compass-Centric

- **Visual**: Large ornate compass rose as central focal element, needle spins to bearing direction, map reveals behind compass, route draws underneath, nautical aesthetic
- **Map tiles**: `terrain` or `watercolor` with slight desaturation
- **Compass**: SVG compass rose (N/S/E/W, ornate ring, animated needle), center 40% of frame
- **Animation**: Compass fades in with rotation, needle settles, map fades in behind, route draws, compass fades to corner
- **Duration**: 12s (360 frames)
- **Components**: CompassRoseEnhanced, AnimatedNeedle, BearingLabel
- **Schema**: startCoord, endCoord, compassStyle (classic/modern/nautical), showBearing, mapStyle, lineColor, showLabels

### 12. `hub-spoke-radial` — Radiating Destinations

- **Visual**: Central hub city with lines radiating outward to 3-8 destinations simultaneously, each spoke animates outward with distance labels
- **Map tiles**: `positron` or `tonerLite`
- **Camera**: Static overview
- **Animation**: Hub marker first, spokes radiate one-by-one with stagger, destination markers pop in, optional total counter
- **Duration**: 12s (360 frames)
- **Components**: SpokeAnimation, HubMarker, DestinationCounter
- **Schema**: hubCoord, destinations (array of {coord, label}), lineColor, spokeStyle (solid/dashed/dotted), showDistances, showTotalCount, title, staggerDelay

### 13. `timezone-traveler` — Time Zone Crossing

- **Visual**: World map with vertical time zone bands (alternating subtle tint), route animates across zones, clock display shows time changing as each zone boundary is crossed
- **Map tiles**: `positron` or `tonerLite` with time zone band overlays
- **Time zones**: Semi-transparent vertical bands, zone labels at top
- **Clock**: Digital or analog clock updating as route crosses zone boundaries
- **Duration**: 12s (360 frames)
- **Components**: TimeZoneBands, ClockDisplay (digital/analog), ZoneLabel
- **Schema**: startCoord, endCoord, startTimezone, endTimezone, clockStyle (digital/analog), showZoneBands, showLocalTimes, lineColor

## File Structure Per Template

```
packages/templates/src/templates/<slug>/
├── register.ts         # Registration with registry
├── meta.json           # Name, description, tags, category, aspect ratio
├── metadata.json       # Composition metadata (width, height, fps, frames)
├── schema.ts           # Zod schema + defaultProps
├── index.tsx           # Main Remotion composition component
├── constants.ts        # Colors, fonts, timing constants
└── components/         # Template-specific components
    └── *.tsx
```

## Registration

Each template gets an import in `packages/templates/src/index.ts`.

## Non-Goals

- No backend changes (no new API endpoints)
- No new routing in the templates web app (gallery auto-discovers via registry)
- No real-time GPS data — all coordinates are props
- No audio/music support
- No photo embedding (except postcard-reveal which uses decorative elements only)
