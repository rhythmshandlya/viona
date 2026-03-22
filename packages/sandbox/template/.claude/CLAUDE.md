## Workspace Layout
```
manifest.json                    # Timeline: tracks, items, canvas, assets (use MCP manifest tools)
manifest-original.json           # Immutable backup (never modify)
docs/
  transcript.json                # Word-level transcript {words, segments, language}
  transcript-original.json       # Immutable backup
  SCENE_PLAN.md                  # Scene plan (written by Planner, read by downstream agents)
  user-brief.md                  # User's creative brief (if provided)
  speaker-grid.json              # Head-tracking data (access via get_speaker_position tool, not directly)
  shot-boundaries.json           # Camera cut points with transcript context (use get_shot_boundaries tool)
  guidelines/
    editing-style.md             # Editing style guide
    studio-theme.md              # Theme design system tokens
  shared/                        # Shared prompt modules
  themes/                        # Theme design files
src/
  scenes/                        # Individual scene .tsx files (default export)
  components/                    # Shared components (Background.tsx, plan-specific components)
  constants.ts                   # COLORS, TIMING, SPRINGS
  scene-registry.ts              # Auto-generated scene imports
public/
  source.mp4                     # Source video
  audio.aac                      # Extracted audio track
  manifest.json                  # Symlink to /workspace/manifest.json
```

## Manifest Access
Read and modify the manifest via MCP tools (`read_manifest`, `add_item`, `update_item`, etc.), NOT by editing the file directly.

## Critical Manifest Rules
- `split_item` operates on ONE item. When splitting video, ALSO split its paired audio item at the same timestamp.
- Audio items MUST have `data.startFrom` set (milliseconds into the source file). Without it, audio plays from 0ms regardless of timeline position.
- Keyframes MUST use `{timeMs, props: {...}}` format. Example: `{"timeMs": 0, "props": {"opacity": 0}}`. NEVER flat `{"timeMs": 0, "opacity": 0}`.
- **Scene item keyframes must ONLY animate `opacity`** (fade in/out). NEVER include `x`, `y`, `width`, `height`, or `rotation` in scene keyframes — they override the base transform and break positioning. All spatial animation happens inside the scene component's React code.
- Scene items MUST have `data.displayMode` set (`fullscreen`, `split-screen`, or `overlay`). Note: `split-screen` is the API value for what the Planner calls "Stacked".
- `data.sceneFile` should include `.tsx` extension (e.g., `Scene1.tsx` not `Scene1`).
- transcript.json syncs automatically after manifest changes. Use post-sync timestamps (not source timestamps) for scene planning.

## Import Pattern
```tsx
import { COLORS, SPRINGS } from '../constants';
import { Background } from '../components/Background';
```

## Scene Export Convention
Scene files use `export default` for the component.
Example: `const MyScene: React.FC = () => { ... }; export default MyScene;`

## interpolate() Rules — CRITICAL
- `inputRange` MUST be strictly monotonically increasing: `[0, 100]` is valid, `[400, 100]` CRASHES.
- If you need "higher input = lower output", swap both ranges: `interpolate(x, [100, 400], [0.4, 0])` not `interpolate(x, [400, 100], [0, 0.4])`.
- ALWAYS include `extrapolateLeft: 'clamp', extrapolateRight: 'clamp'` to prevent runaway values.

## Surface & Motion Rules
- Every container/surface needs at least TWO animated treatments (gradient shift, depth shadow, shimmer, blur). Static flat rectangles are forbidden.
- Spring vocabulary: SNAPPY (hero), SMOOTH (panels), BOUNCY (accents), HEAVY (large surfaces). Adjacent elements should use different springs.
- Entrance directions must vary within a scene — not everything from bottom.
- Every settled element needs idle motion (float, breathe, rotate drift, or glow pulse).
- Background is never static — at least one continuously animating property.
- Opacity and transform offsets: stagger by 3-5 frames (never start on same frame).

## Anti-Slideshow Rules
- Do NOT default to card/rectangle layouts. Prefer drawn SVG paths, animated charts, kinetic typography, visual metaphors.
- Cards are acceptable ONLY when content genuinely calls for them (checklists, comparison tables) — and even then, connect them with drawn lines/arrows.
- If your scene could be a static PowerPoint slide, redesign it. The viewer should feel motion and visual relationships, not layout.
- No generic card wrapper components (GlassCard, DataCard). Build scene-specific visuals.

## Video Positioning
- Video uses `objectFit: 'cover'` with optional `crop` settings (`objectPosition` + `scale`).
- `auto_center_speaker` sets optimal crop values to center the speaker's face (called by Layout Editor).
- `get_speaker_position` returns the speaker's exact canvas-space coordinates for a time range. Use this when placing overlay elements — it accounts for the cover crop transform and returns concrete `safePlacements` rects.
- Do NOT read `speaker-grid.json` directly — use the tool instead.
