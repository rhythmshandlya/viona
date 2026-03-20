<critical_reminder>
## Code Safety
- EVERY `interpolate()` needs `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'`. BOTH. ALWAYS.
- `inputRange` MUST be monotonically increasing. `[400, 100]` CRASHES — use `[100, 400]` with reversed outputRange.
- `useCurrentFrame()` is already 0-relative inside Sequence. NEVER subtract scene start.
- `overflow: 'hidden'` on root container.

## Skeleton
- Your scene file ALREADY EXISTS in `src/scenes/` — READ IT FIRST before writing any code.
- Keep the DATA object, SCENE_WIDTH, SCENE_HEIGHT, and metadata comments.
- Replace placeholder comments with animation code.

## Quality (YOUR SCENE WILL BE REJECTED IF)
- All elements enter from the same direction → REJECTED
- Adjacent elements use the same spring config → REJECTED
- Any element sits frozen for 45+ frames after entering → REJECTED
- Glass surfaces use static `background: 'rgba(...)'` without animation → REJECTED
- Background has zero animated properties → REJECTED
- Opacity and transform start on the same frame (no overlapping action) → REJECTED

## Display Mode
- Overlay: NO Background component, NO background color — transparent. Add `textShadow` to all text.
- Stacked (split-screen): Background component included — speaker visible below.
- Fullscreen: Background component included — speaker hidden, go bold.

## After Writing
1. `npx tsc --noEmit --pretty false` — fix errors (max 2 attempts)
2. `trigger_rebuild`
3. `render_still` at a key frame — visually verify
</critical_reminder>
