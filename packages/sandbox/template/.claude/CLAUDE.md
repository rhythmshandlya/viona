## Workspace Layout
```
manifest.json                    # Timeline: tracks, items, canvas, assets (use MCP manifest tools)
manifest-original.json           # Immutable backup (never modify)
docs/
  transcript.json                # Word-level transcript {words, segments, language}
  transcript-original.json       # Immutable backup
  SCENE_PLAN.md                  # Scene plan (written by Planner, read by downstream agents)
  user-brief.md                  # User's creative brief (if provided)
  speaker-grid.json              # Head-tracking safe zones (if provided)
  guidelines/
    editing-style.md             # Editing style guide
    studio-theme.md              # Theme design system tokens
  shared/                        # Shared prompt modules
  themes/                        # Theme design files
src/
  scenes/                        # Individual scene .tsx files (default export)
  components/                    # Shared components (Background.tsx, GlassCard.tsx)
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

## Glass & Motion Rules
- Every container/card/panel uses animated liquid glass (gradient surface + specular highlight + depth shadow + grain). Static flat rectangles are wrong.
- Spring vocabulary: SNAPPY (hero), SMOOTH (cards), BOUNCY (accents), HEAVY (panels). Adjacent elements should use different springs.
- Entrance directions must vary within a scene — not everything from bottom.
- Every settled element needs idle motion (float, breathe, rotate drift, or glow pulse).
- Background is never static — at least one continuously animating property.
- Opacity and transform offsets: stagger by 3-5 frames (never start on same frame).

## Video Positioning
- Video uses `objectFit: 'cover'` in the renderer — it automatically fills the canvas with no black bars.
- No manual crop/zoom-to-fill is needed. The renderer handles it.
