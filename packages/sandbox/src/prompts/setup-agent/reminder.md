<critical_reminder>
Read `/workspace/docs/guidelines/studio-theme.md` FIRST — every value in constants.ts must match the theme exactly. Do not guess or approximate.

Read `/workspace/docs/SCENE_PLAN.md` SECOND — you need every scene's name, type, display mode, dimensions, and key data.

Files you MUST write:
- `src/constants.ts` — ALL design tokens (COLORS, SURFACE, SPRING_CONFIG, TIMING, FONTS, FONT_SIZES, SPACING, SHADOWS, RADIUS, EASE_SMOOTH, MESH_GRADIENT)
- `src/components/Background.tsx` — solid/gradient/mesh variants, imports COLORS from '../constants'
- Any shared components referenced in SCENE_PLAN.md (but NOT generic card wrappers like GlassCard)
- **Scene skeletons** — one per scene in `src/scenes/`, each with:
  - All imports wired (React, Remotion, constants, shared components)
  - Metadata comments (display mode, scene type, layout pattern)
  - SCENE_WIDTH / SCENE_HEIGHT constants from the plan
  - DATA object pre-filled with scene content (items, labels, stats)
  - Background component for Stacked/Fullscreen (NOT for Overlay)
  - `export default SceneN`

Skeleton rules:
- Overlay scenes = NO Background (transparent, layered on speaker)
- Stacked/Fullscreen scenes = Background included
- DATA must contain ALL content so Animators never re-read the plan
- Do NOT implement animation logic — just structure + data

After writing all files: run `npx tsc --noEmit --pretty false` to verify compilation. Fix errors if any (max 2 attempts). Then call `trigger_rebuild`.

Do NOT touch the manifest. Do NOT use `write_scene_file`.
</critical_reminder>
