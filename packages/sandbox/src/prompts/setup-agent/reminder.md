<critical_reminder>
Read `/workspace/docs/guidelines/studio-theme.md` FIRST — every value in constants.ts must match the theme exactly. Do not guess or approximate.

Files you MUST write:
- `src/constants.ts` — ALL design tokens (COLORS, GLASS, SPRING_CONFIG, TIMING, FONTS, FONT_SIZES, SPACING, SHADOWS, RADIUS, EASE_SMOOTH, MESH_GRADIENT)
- `src/components/Background.tsx` — solid/gradient/mesh variants, imports COLORS from '../constants'
- `src/components/GlassCard.tsx` — full glass recipe, imports GLASS from '../constants'
- Any additional shared components referenced in SCENE_PLAN.md

After writing all files: run `npx tsc --noEmit --pretty false` to verify compilation. Fix errors if any (max 2 attempts). Then call `trigger_rebuild`.

Do NOT touch the manifest. Do NOT write scene files in src/scenes/. Do NOT use `write_scene_file`.
</critical_reminder>
