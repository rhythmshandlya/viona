<critical_reminder>
## Code Safety
- EVERY `interpolate()` needs `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`. BOTH. ALWAYS.
- `inputRange` MUST be monotonically increasing. `[400, 100]` CRASHES — use `[100, 400]` with reversed outputRange.
- `useCurrentFrame()` is already 0-relative inside Sequence. NEVER subtract scene start.
- `overflow: 'hidden'` on root container.

## Skeleton & Templates
- Your scene file ALREADY EXISTS in `src/scenes/` — READ IT FIRST before writing any code.
- Templates are ALREADY FORKED by the Setup Agent to `src/components/templates/<slug>/`. Do NOT call `fork_template`.
- If the skeleton has `// Template: <slug>`, read the forked template's `index.tsx` and `magazine/` library for patterns and utilities. Import useful functions (textures, effects, animations, fonts) into your scene.
- Keep the DATA object, SCENE_WIDTH, SCENE_HEIGHT, and metadata comments.
- Replace placeholder comments with animation code.
- Use DRY clamping: `const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };` then pass `clamp` as the 4th argument to every interpolate call.

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

## Display Mode
- Overlay: NO Background component, NO background color — transparent. Surface styling follows theme.md. Add `textShadow` to all text.
- Stacked (split-screen): Background component included — speaker visible below.
- Fullscreen: Background component included — speaker hidden, go bold.

## After Writing
1. `npx tsc --noEmit --pretty false` — fix errors (max 2 attempts)
2. `trigger_rebuild`
3. `render_still` at a key frame — visually verify
- ALWAYS use `render_still` MCP tool to render frames — NEVER use Bash to call remotion directly (it produces black frames)
</critical_reminder>
