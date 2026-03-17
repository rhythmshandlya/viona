# Plan C: Creative Quality — Content-Type-Aware Creative Direction

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the planner (director) produce content-type-aware creative plans with emotional arc engineering, hook psychology, and anti-pattern awareness — instead of applying blanket layout rules to every video type.

**Architecture:** Two prompt changes: (1) Replace the blanket "70-80% stacked" rule in the orchestrator with content-type creative guidelines (not hard ratios — the director designs layouts, it doesn't follow a lookup table). (2) Add a creative direction section to the planner prompt with emotional arc mapping, hook psychology, and anti-pattern checklist. No code changes — prompt-only.

**Tech Stack:** Markdown prompts

**Spec Reference:** `docs/superpowers/plans/2026-03-16-pipeline-issues.md` — Issue 6

**Relationship to Plan D:** Plan D replaces display mode enums with spatial coordinates and kills `scenes.json`. Plan C's creative direction content (emotional arcs, hook psychology, anti-patterns) is additive — it teaches the director HOW to think creatively regardless of whether layouts use display modes or spatial coordinates. If Plan D is implemented first, the layout ratio content below should use spatial language. If Plan C is implemented first, the layout ratios will be replaced by Plan D's spatial design system.

---

## File Structure

### Files to modify:
- `packages/sandbox/src/prompts/orchestrator-system.md:531-540` — Replace blanket ratio rule with content-type creative guidelines
- `packages/sandbox/src/prompts/planner-system.md:90-97,157-170` — Replace blanket ratio rule + add creative direction section

### Files NOT touched:
- `packages/sandbox/src/orchestrator.ts` — Content type already detected and passed to planner via workspace context
- `packages/sandbox/src/prompts/animator-system.md` — Animator doesn't need layout ratios
- Any code files — this is entirely prompt engineering

---

## Chunk 1: Content-type-aware creative guidelines

### Task 1: Update orchestrator prompt — replace blanket ratio with creative guidelines

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md:531-540`

**Context:** The orchestrator's quality standards section (lines 531-540) enforces a blanket rule: "Stacked layout: 70-80% of beats." This is correct for educational explainers but wrong for ads, product demos, and brand stories. The orchestrator already detects content type in Phase 1. We need to replace the hard ratio with creative guidelines that inform the director's spatial design decisions.

- [ ] **Step 1: Read the current quality standards section**

Open `packages/sandbox/src/prompts/orchestrator-system.md` and read lines 531-540:

```markdown
- Hook (Beat 1): NEVER fullscreen. The speaker must be visible. Use stacked layout.
- **Stacked layout: 70-80% of beats.** Visuals on TOP, speaker on BOTTOM.
- Fullscreen: 1-2 beats max per video. Only for dramatic reveals or complex diagrams.
- Overlay: 10-20% of beats. Speaker fills frame, compact annotations float on top.
```

- [ ] **Step 2: Replace with content-type creative guidelines**

Replace lines 531-540 with:

```markdown
- Hook: The speaker must be visible. Motion from frame 0 — NEVER static.

**Speaker visibility depends on the content type detected in Phase 1:**

| Content Type | Speaker Visibility | Creative Direction |
|-------------|-------------------|-------------------|
| Educational / Tutorial | Visible 60-70% of time | Visuals need maximum screen real estate — speaker in smaller region when visuals are teaching |
| Ad (Meta / TikTok / Instagram) | Visible 70-80% of time | Speaker IS the product — keep them prominent, layer annotations over/beside them |
| Product demo | Visible 50-60% of time | Balance product visuals with speaker credibility |
| Brand story / Testimonial | Visible 60-80% of time | Emotional connection through speaker presence — vary based on emotional arc |
| Podcast / Interview | Visible 80-90% of time | Speaker dominates — visuals are supplementary context |

These are CREATIVE GUIDELINES, not hard rules. The director designs the spatial layout based on these principles plus head tracking data, asset inventory, and the user's brief. If the brief contradicts these guidelines, follow the brief.

**For ads:** The speaker IS the product. Keep them large and prominent. Layer annotations, stats, and product shots around or over the speaker. Use dramatic reveals (speaker hidden briefly) sparingly for impact — not as the default.

**For educational:** Visuals ARE the content. Give them the most screen space. The speaker provides trust and context — they can be in a smaller region. When the speaker explains something complex, give visuals maximum real estate.

Pass the detected content type to the Planner so it informs the spatial design.
```

- [ ] **Step 3: Verify**

Run: `grep -n "creative guidelines" packages/sandbox/src/prompts/orchestrator-system.md`
Expected: One match on the new content.

Run: `grep -n "70-80% of beats" packages/sandbox/src/prompts/orchestrator-system.md`
Expected: Zero matches (blanket rule removed).

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "fix: replace blanket 70-80% stacked rule with content-type creative guidelines (Issue 6)"
```

---

### Task 2: Update planner prompt — replace blanket ratio + add creative direction

**Files:**
- Modify: `packages/sandbox/src/prompts/planner-system.md:90-97,157-170`

**Context:** The planner has the same blanket "70-80% stacked" rule (lines 95, 163). It also lacks creative direction knowledge — it knows structure (sync points, frame counts, segment grouping) but not HOW to think creatively (emotional arcs, hook psychology, retention mechanics, anti-patterns).

- [ ] **Step 1: Replace the Speaker-Visible-by-Default section**

In `packages/sandbox/src/prompts/planner-system.md`, find the "Speaker-Visible-by-Default (CRITICAL RULE)" section (lines 90-97). Replace with:

```markdown
## Speaker-Visible-by-Default (CRITICAL RULE)

The speaker's talking-head video is the anchor of the composition. Never hide the speaker for more than 15 consecutive seconds. Viewers connect with faces — the speaker provides trust, emotion, and context.

**Speaker visibility depends on content type** (passed from the orchestrator via the creative brief):

| Content Type | Speaker Visibility | Why |
|-------------|-------------------|-----|
| Educational / Tutorial | 60-70% of time | Visuals ARE the content — need maximum screen space |
| Ad (Meta / TikTok) | 70-80% of time | Speaker IS the product — keep them prominent |
| Product demo | 50-60% of time | Balance product visuals with speaker credibility |
| Brand story / Testimonial | 60-80% of time | Emotional connection through speaker presence |
| Podcast / Interview | 80-90% of time | Speaker dominates — visuals are supplementary |

These are creative guidelines, not hard constraints. Use them to inform your spatial design — the actual layout is up to you based on head tracking data, assets, and the creative brief.

If the content type is not in this table, default to Educational guidelines.

**Hook:** Speaker must be visible. Motion from frame 0 — NEVER static.
```

- [ ] **Step 2: Update the Display Mode Rules table**

Find the Display Mode Rules section (lines 157-170) with the usage table. Replace the hard ratio column with a note pointing to the creative guidelines:

```markdown
| Layout Concept | Description | When to Use |
|---------------|-------------|-------------|
| Speaker + visuals (split) | Visuals in one region, speaker in another | The workhorse — when both need to be visible |
| Visuals only (speaker hidden) | Scene fills canvas, speaker video cut | Dramatic reveals, complex diagrams, pattern interrupts |
| Speaker with overlays | Speaker fills frame, annotations layered on top | Credibility beats, emotional moments, ads |

The exact split proportions, positions, and arrangement are up to you. Use the content-type creative guidelines and head tracking data to design the layout for each scene. Don't use the same arrangement for every scene — variety keeps viewers engaged.
```

- [ ] **Step 3: Add Creative Direction section**

Add a new section after the "Plan with Motion Design" section (after line 384). Insert:

```markdown
## Creative Direction

### Emotional Arc Engineering

Every video has an energy curve. Map each scene to an energy level (1-5):

| Energy | Visual Treatment | When to Use |
|--------|-----------------|-------------|
| 1 — Calm | Slow ambient motion, muted palette, single element | Reflection, setup |
| 2 — Building | Gentle stagger, elements appearing | Context, explanation |
| 3 — Active | Multiple elements, moderate spring dynamics | Core content |
| 4 — Intense | Fast stagger, bold colors, scale/position shifts | Key reveals, stat callouts |
| 5 — Peak | Full animation, particles, complex choreography | Hook, climax, CTA |

**Rules:**
- Never two adjacent scenes at the same energy level
- Hook must be energy 4-5
- At least one energy dip (1-2) before the final peak
- The arc should follow the content type:
  - **Ads (PAS):** Problem (4) → Agitate (5) → Solve (3) → CTA (5)
  - **Educational:** Hook (5) → Context (2) → Insight (4) → Insight (4) → Summary (3)
  - **Brand story:** Hook (4) → Journey (2→3→4) → Transformation (5) → CTA (4)

### Hook Psychology (Scene 1)

The hook has 3 seconds to stop the scroll. It must create a **curiosity gap** — an incomplete idea that the viewer needs to resolve.

**Techniques by content type:**
- **Ads:** Pattern interrupt — bold claim ("This costs $3 and replaces your gym"), surprising stat, visual shock (unexpected color/scale)
- **Educational:** Curiosity question ("Why do 90% of developers get this wrong?"), mystery visual (blurred reveal)
- **Brand story:** Relatable moment ("I almost quit"), emotional close-up

**Visual requirements for the hook:**
- Motion from frame 0 — NEVER static
- Primary element at large scale, fills visual region
- Bold contrast with background
- Text must be readable in < 1 second (max 5 words)

### Anti-Pattern Checklist

Before finalizing SCENE_PLAN.md, verify NONE of these are true:

| Anti-Pattern | Why It Fails |
|-------------|-------------|
| Every scene is a "card with text and icon" | Repetitive, no visual variety — use path drawing, diagrams, morphing, particles |
| No energy variation (all scenes at level 3) | Monotonous — the viewer's brain stops paying attention |
| Hook is just a title fade-in | No pattern interrupt — will be scrolled past |
| Same layout for 5+ consecutive scenes | Visually stale — alternate between arrangements |
| All text overlays, no visual metaphors | Tell-don't-show — use visual metaphors |
| Every transition is "cut" | No rhythm — vary between cut (energy), fade (mood shift), zoom (focus) |
| Speaker hidden for > 15 seconds | Trust erosion — viewers disconnect from faceless content |
```

- [ ] **Step 4: Update self-verification table**

Find the self-verification table (lines 633-659). Add these new checks after the existing rows:

```markdown
| Energy arc: no two adjacent scenes at same energy? | | |
| Hook psychology: first scene creates curiosity gap? | | |
| Anti-patterns: none of the 7 anti-patterns present? | | |
| Content-type guidelines: speaker visibility matches content type? | | |
```

- [ ] **Step 5: Verify changes**

Run: `grep -n "Emotional Arc Engineering" packages/sandbox/src/prompts/planner-system.md`
Expected: One match.

Run: `grep -n "70-80% of beats" packages/sandbox/src/prompts/planner-system.md`
Expected: Zero matches (blanket rule removed).

Run: `grep -n "Anti-Pattern Checklist" packages/sandbox/src/prompts/planner-system.md`
Expected: One match.

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/prompts/planner-system.md
git commit -m "feat: add creative direction to planner — content-type guidelines, emotional arcs, hook psychology (Issue 6)"
```

---

## What This Achieves

| Problem | Fix |
|---------|-----|
| Blanket "70-80% stacked" for all content types | Content-type creative guidelines — the director designs layouts informed by these principles, not constrained by ratios |
| No emotional arc | Energy level (1-5) mapping with content-type-specific formulas |
| Weak hooks | Hook psychology section with techniques per content type |
| Repetitive "card with text" visuals | Anti-pattern checklist catches formulaic plans before finalization |
| No creative variety enforcement | Self-verification table extended with 4 new creative checks |

## Known Tradeoffs

- **Creative guidelines vs hard rules:** The old hard ratios (70-80% stacked) were wrong but predictable. Creative guidelines give the director freedom to make bad decisions too. The anti-pattern checklist mitigates this by catching the most common failures.
- **Content type detection accuracy:** The orchestrator detects content type from the transcript. If it misdetects, the wrong guidelines apply. Mitigated by Phase 1 brainstorming — the user can correct.
- **Prompt length increase:** The planner prompt grows by ~80 lines. Well within context limits and the creative knowledge directly improves output quality.
- **Relationship to Plan D:** If Plan D is implemented (spatial design system), the layout ratio tables in this plan become redundant — Plan D's spatial design section subsumes them. The creative direction content (emotional arcs, hook psychology, anti-patterns) remains valuable regardless.
