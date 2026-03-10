# Prompt Optimization Design — Motion Design Quality + Architecture Cleanup

## Goal
Rewrite all prompts in `packages/worker/src/prompts/` to produce true motion graphics output (not developer animations), while eliminating ~40% token waste from duplication and slop.

## Architecture
Hybrid approach: motion design thinking for creative quality, hard constraints for technical correctness, deduplicated shared modules underneath. Eliminates `animator/base.md` (1,822 lines of duplication).

## Key Decisions
- **Priority**: Output quality (motion graphics), with architecture cleanup done simultaneously
- **Approach**: Hybrid — motion design vocabulary for creative sections, hard rules for technical
- **Scope**: All agents equally (Director, Animator, Assistant Director) — systemic issues
- **Core problem**: Lack of true motion graphics — no professional MoGraph techniques, no purposeful motion, no complexity/layering

---

## New Architecture

```
packages/worker/src/prompts/
├── shared/                              # NEW — cross-agent modules
│   ├── motion-design-principles.md      # Motion designer thinking + Disney's 12 principles
│   ├── technical-rules.md               # Remotion gotchas, interpolate clamping, springs
│   ├── quality-checklist.md             # Self-verification for all agents
│   └── vocabulary.md                    # Shared animation vocabulary + archetypes
├── director/
│   ├── system.md                        # REWRITTEN — role + scene planning
│   ├── studio-style-template.md         # Existing, minor trim
│   └── display-mode-table.md            # Existing, unchanged
├── animator/
│   ├── system.md                        # REWRITTEN — ~800 lines max (from 2,117)
│   ├── base.md                          # DELETED — merged into system.md
│   ├── setup.md                         # Existing, minor trim
│   ├── fix-template.md                  # Existing, unchanged
│   ├── verify.md                        # Existing, unchanged
│   ├── scene-verify.md                  # Existing, unchanged
│   ├── composition-verify.md            # Existing, unchanged
│   ├── scene-template.md               # Existing, unchanged
│   ├── overlay-rules.md                 # REWRITTEN — extract from system.md overlay section
│   ├── fullscreen-rules.md             # Existing, minor trim
│   ├── video-overlay-section.md        # Existing, unchanged
│   ├── youtube-clip-section.md         # Existing, unchanged
│   └── studio-design-system.md         # Existing, minor trim
├── assistant-director/
│   └── system.md                        # REWRITTEN — add motion design awareness
├── generate-visuals/                    # Existing, trim for consistency
├── references/                          # Existing, unchanged
├── loader.ts                            # UPDATED — compose shared/ + role-specific
└── loader.py                            # UPDATED — compose shared/ + role-specific
```

### What Gets Deleted
- `animator/base.md` (1,822 lines) — 100% duplicate, merged into system.md

### What Moves to shared/
Content currently duplicated across prompts:
- Spring configs + easing guide → `shared/technical-rules.md`
- Animation vocabulary + archetypes → `shared/vocabulary.md`
- Quality checklists → `shared/quality-checklist.md`
- Disney's 12 principles + choreography → `shared/motion-design-principles.md`

---

## shared/motion-design-principles.md (~400 tokens)

### The Motion Designer's Mindset
- Every movement communicates. No decorative motion.
- Three questions before animating: (1) What's this element's role? (2) What should the viewer feel? (3) Where should they look next?

### Three Simultaneous Layers (MANDATORY)
1. **Primary** — Main element moving. One per beat.
2. **Secondary** — Supporting elements reacting. 2-3 per beat.
3. **Ambient** — Background texture that never stops.

Amateur work has layer 1 only. Professional work has all three.

### Disney's 5 That Matter for Short-Form Video
1. **Anticipation** — Wind up before main action
2. **Follow-Through** — Secondary elements overshoot then settle
3. **Staging** — Blur/dim background to focus attention on hero
4. **Exaggeration** — Low damping + high stiffness for dramatic reveals
5. **Arcs** — Natural curved motion paths, never straight lines

### Choreography Phases
```
Phase 1 (frame 0):       AMBIENT    — Background begins (gradient, particles, grid)
Phase 2 (frame 0):       PRIMARY    — Hero element enters (title, main visual)
Phase 3 (keySync):       SETTLE     — Hero settles + secondary content appears
Phase 4 (keySync+8..):   STAGGER    — Details cascade in (8-12 frame intervals)
Phase 5 (last 15 frames): EXIT      — Elements depart in reverse hierarchy
```

### Visual Hierarchy (60-30-10 Rule)
- 60% dominant (background) — never static
- 30% secondary (containers, shapes) — consistent easing
- 10% accent (highlights, data points) — springs + overshoot

### Few-Shot: Developer vs Motion Designer
```
BAD (developer):
- Title fades in at frame 0
- Subtitle fades in at frame 10
- Icon fades in at frame 20
- Same easing, same duration, static background

GOOD (motion designer):
- Gradient rotation starts (ambient, continuous)
- Floating particles drift upward (ambient, continuous)
- Title scales 1.1→1.0 with SMOOTH spring + opacity (primary, frame 0)
- Accent line draws beneath title L→R (secondary, frame 12)
- Subtitle slides up 20px with SNAPPY spring (secondary, frame 18)
- Data point pops with overshoot + slight rotation (primary, frame 26)
- Background pulse on data reveal (ambient responds to primary)
```

### Hard Rules
- Min 3 elements animating per scene with different start times
- Min 8-frame stagger between sequential entrances
- Every scene MUST have ambient motion
- Never same easing for adjacent elements
- Offset opacity from position by 3-6 frames
- `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'` on EVERY interpolate()
- Never damping < 10

---

## shared/technical-rules.md (~300 tokens)

Extracted from animator/system.md, deduplicated:
- Spring configs table (SMOOTH, SNAPPY, BOUNCY, HEAVY, STIFF, GENTLE)
- Easing guide (intent → easing mapping)
- Interpolate clamping rule (both sides, always)
- Frame timing in Sequences (useCurrentFrame is already local)
- keySync pattern (pre-computed local offsets in TIMING)
- Responsive sizing rules (EW/EH, never px)

---

## shared/quality-checklist.md (~150 tokens)

Unified checklist for all agents:
- [ ] Every entry pairs opacity + transform
- [ ] Stagger delays vary (not uniform)
- [ ] Exits faster than entries (75% duration)
- [ ] No frozen frames — ambient motion always present
- [ ] All content centered in flex container
- [ ] Only palette colors used
- [ ] Spring damping >= 10 everywhere
- [ ] Text scale never exceeds 1.15x during entry
- [ ] Mute test passes (concept clear without audio)
- [ ] Every 3-5s of narration has corresponding visual

---

## shared/vocabulary.md (~250 tokens)

Consolidated from director/system.md sections:
- Text animation vocabulary (word-cascade, char-stagger, text-reveal, typewriter, number-roll)
- Element animation vocabulary (spring-in, fade-rise, stagger-cascade, draw-in, fill-progress)
- Transition vocabulary (crossfade, slide-left, wipe-right, glow-pulse, cut)
- Scene archetypes table (hook-title, stat-reveal, process-flow, comparison-split, etc.)

---

## Prompt Rewrites

### Director system.md — From ~728 lines to ~450 lines
**Changes:**
- Remove animation vocabulary (→ shared/vocabulary.md)
- Remove color palettes (→ already in skills)
- Remove animation patterns section (belongs to Animator)
- ADD: Motion design planning language — Director plans in choreography phases, not just "what appears"
- ADD: Few-shot scene plan examples showing motion-first thinking
- KEEP: Transcript analysis, scene constraints, pacing, output format, quality criteria

### Animator system.md — From ~2,117 lines to ~800 lines
**Changes:**
- Delete ALL content that's moving to shared/ (~600 lines)
- Delete `base.md` entirely (~1,822 lines saved)
- Delete redundant code examples (keep 1 example per pattern, not 3)
- Delete aspirational content that's rarely followed (polish layer, film grain, vignette)
- RESTRUCTURE remaining content using XML tags + progressive disclosure
- ADD: Motion design implementation examples (before/after showing the quality gap)
- ADD: Self-verification against motion-design-principles.md
- KEEP: Workflow, plan adherence, assets, overlay mode, 3D, Remotion rules, layout

### Assistant Director system.md — From ~122 lines to ~150 lines
**Changes:**
- ADD: Motion design awareness — brief should recommend choreography style, not just colors
- ADD: "Motion mood" field (kinetic/dramatic/subtle/playful)
- ADD: Visual complexity hints per beat (simple/medium/rich)
- KEEP: Everything else (already well-structured)

### loader.ts / loader.py — Updated
- Compose prompts: `shared/* + role-specific/*` at build time
- Shared modules prepended to every agent's system prompt
- Order: technical-rules → motion-design-principles → vocabulary → quality-checklist → role prompt

---

## Token Impact Estimates

| File | Before | After | Savings |
|------|--------|-------|---------|
| animator/system.md | 2,117 lines | ~800 lines | -62% |
| animator/base.md | 1,822 lines | 0 (deleted) | -100% |
| director/system.md | 728 lines | ~450 lines | -38% |
| assistant-director/system.md | 122 lines | ~150 lines | +23% (quality investment) |
| shared/ (new) | 0 | ~400 lines | new, but replaces ~1,200 lines of duplication |
| **Total** | ~4,789 lines | ~1,800 lines | **-62%** |

Net: ~3,000 lines eliminated. Shared modules add ~400 lines but replace ~1,200 lines of per-prompt duplication.

---

## Risk Mitigation
- **Regression risk**: Keep current prompts as `*.md.bak` until validated
- **Quality validation**: Generate 3-5 test videos with old vs new prompts, compare motion quality
- **Incremental rollout**: Start with shared/ + animator (highest impact), then director, then assistant-director
