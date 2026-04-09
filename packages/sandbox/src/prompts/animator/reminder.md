<critical_reminder>
## Code Safety
- `overflow: 'hidden'` on root container.

## Skeleton & Templates
- Your scene file ALREADY EXISTS in `src/scenes/` — READ IT FIRST for DATA, dimensions, and display mode.
- Templates are ALREADY FORKED by the Setup Agent to `src/components/templates/<slug>/`. Do NOT call `fork_template`.
- If the skeleton has `// Template: <slug>`, your working file is `src/components/templates/<slug>/index.tsx` — **EDIT it, do NOT delete and rewrite**:
  - Hardcode the scene's DATA, replace dimensions, adapt layout and choreography.
  - **KEEP ALL sub-components** from the template's `components/` dir — use them, don't replace with inline code.
  - **KEEP ALL texture/effect/typography components** — removing them produces flat slideshow results.
  - **KEEP ALL shared library imports** (`./magazine/*`) — do NOT strip any.
  - The scene file re-exports the template: `export { default } from '../components/templates/<slug>';`
  - **Size check:** If your file is 2x+ longer than the original, you are rewriting not adapting → REJECTED.
- If no template (Template: none), write animation code directly in the skeleton file.

## Layout & Responsive Sizing (YOUR SCENE WILL BE REJECTED IF)
- Content elements use `position: absolute` with `left`/`top` for layout → REJECTED. Use flexbox (`display: flex`, `gap`, `alignItems: center`, `justifyContent: center`) for content layout. Only use absolute positioning for decorative overlays.
- Content is not centered in the scene canvas → REJECTED. Root container must use flex centering with padding.
- Elements overlap each other due to manual pixel positioning → REJECTED. Use `gap` and `margin` for spacing.
- Animation uses `left`/`top` instead of `transform: translate()` → REJECTED. Layout = flexbox, animation = transforms.
- Raw pixel values like `fontSize: 24` or `gap: 16` → REJECTED. Every value must use the width-based `s()` scale helper:
  `const s = (px: number) => Math.round((px / 1080) * SCENE_WIDTH);`
  This includes font sizes, gaps, padding, margins, border-radius, translate amplitudes, idle motion amplitudes. Vertical distribution uses flex layout (`gap`, `justifyContent`), not pixel math.

## Quality (YOUR SCENE WILL BE REJECTED IF)
- All elements enter from the same direction → REJECTED
- Adjacent elements use the same spring config → REJECTED
- Any element sits frozen for 45+ frames after entering → REJECTED
- Surfaces use static `background: 'rgba(...)'` without animation → REJECTED
- Background has zero animated properties → REJECTED
- Opacity and transform start on the same frame (no overlapping action) → REJECTED
- Uses SVG stroke-based visuals (strokeDasharray, strokeDashoffset, strokeWidth, `<line>`, `<path>` outlines) → REJECTED. Use solid filled shapes, boxShadow for depth, clip-path for reveals, animated width/height for bars.
- Wireframe/outlined elements instead of solid filled surfaces → REJECTED. Edges come from shadow and glow, not stroked borders.
- Thin `1px` borders as visual structure → REJECTED. Use boxShadow or inset shadows for edge definition.

## Display Mode — Adapt Your Approach
- **Overlay**: NO Background, NO background color — transparent canvas over speaker. `textShadow` on all text. Simpler composition (1–3 elements), snappy timing, single focal point. The speaker is the star — your graphic supports them.
- **Stacked**: Background included — speaker visible below. Self-explanatory visual (3–5 elements). Extra bottom padding near split boundary. The animation illustrates what the speaker explains.
- **Fullscreen**: Background included with rich variant — speaker hidden. Immersive environment, cinematic pacing, go bold. The animation IS the content, speaker narrates.

## Depth Layers (Overlay Only)
- Overlay skeletons have `SPEAKER`, `VISIBLE_ZONES` constants and BehindSpeaker/InFrontOfSpeaker layer comments.
- Place elements per the animation brief: "behind" / "emerge-behind" → BehindSpeaker layer. "in front" / "lower third" → InFrontOfSpeaker layer.
- Behind-speaker elements should PEEK from edges of SPEAKER.bboxPx — the full body silhouette, not just the face.
- If the brief doesn't mention depth, put everything in InFrontOfSpeaker (standard overlay behavior).
- Stacked/Fullscreen scenes do NOT have SPEAKER constants or depth layers.

## After Writing
1. `npx tsc --noEmit --pretty false` — fix errors (max 2 attempts)
2. `trigger_rebuild`
- Do NOT call `render_still` — visual verification is handled by the orchestrator after all animators finish.
</critical_reminder>
