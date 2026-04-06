# Kinetic Luxe Captions — Implementation Plan

## Status: In Progress (Testing in Sandbox)
## Last updated: 2026-04-06

## Concept
Transcript-synced captions where **hero words** (power/strong from word classification) render in large accent italic serif, and **satellite words** render smaller in clean sans-serif. Words flow in exact transcript order. Hero words get their own visual line but maintain reading order.

## Reference
- Test HTML: `scripts/temp/kinetic-captions-test.html` — full 4-phase canvas-based algorithm
- Algorithm phases: Measurement → Line Building → Layout → Cassowary Refinement → Animation

## Current Implementation
- File: `packages/sandbox/template/src/items/KineticLuxeCaption.tsx`
- Approach: React flex-wrap layout (not canvas-based)
- Wired into `PlayerComposition.tsx` for `displayMode: "kinetic-luxe"` or `"poster-staircase"`
- Word classification: power/strong → hero, filler/medium → satellite
- Hero words: large italic serif (Playfair Display), accent color, spring scale-in
- Satellite words: small uppercase sans-serif (Inter), fade-in on transcript timing

## What Works
- [x] Word classification (power/strong/medium/filler)
- [x] Hero words get own line, larger styling
- [x] Satellite words flow inline in transcript order
- [x] Transcript sync — words appear when speaker says them
- [x] Spring animation on hero entrance
- [x] Vertical positioning at bottom of canvas

## Architecture: AI-Driven Caption Pipeline

### Principle
AI decides everything. Code just renders. Zero intelligence in the renderer.

### Pipeline Flow

```
Phase 1: Brief & Clarification
Phase 2: Trim Editor → clean transcript with word timestamps
              ↓
     ┌────────┴────────┐
     ↓                 ↓
Phase 2.5:          Phase 3:
Caption Agent       Planner
(parallel)          (parallel)
     ↓                 ↓
caption-plan.json   SCENE_PLAN.md
+ manifest items
     ↓                 ↓
     └────────┬────────┘
              ↓
Phase 4: Setup Agent
Phase 5: Depth Assets
Phase 6: Layout Editor (caption items already exist in manifest)
Phase 6.5: Caption sync — orchestrator checks if captions span scene
           boundaries. If yes, re-dispatch Caption Agent for quick
           split/trim pass. If no, skip.
Phase 7: Animators
Phase 8: Final Editor (validates timeline, does NOT touch captions)

Refinement: Caption Agent re-dispatchable any time for:
            - Full regeneration ("fix captions", "regenerate")
            - Hero changes ("highlight X not Y")
            - Sync repair after manual edits
```

### AI Caption Planner — What It Decides

1. **Phrase boundaries** — which words group together as one visual unit.
   Not mechanical word count. Based on: sentence structure, natural pauses,
   meaning boundaries, speaker rhythm.

2. **Hero words** — 0, 1, or 2 per phrase. The word(s) that carry the phrase's
   meaning and deserve visual emphasis. Based on:
   - Key message of the video (what the speaker is trying to communicate)
   - Numbers and stats (always hero candidates)
   - Action verbs that drive the narrative
   - Terms being defined or introduced
   - Emotional/emphasis words the speaker stresses
   - NOT filler, connectors, articles, prepositions

3. **Phrases with no hero** — some phrases are transitional ("and that's why",
   "so basically"). These render as all-satellite with no highlight. The AI
   should not force a hero where none exists.

### caption-plan.json Schema

```json
{
  "phrases": [
    {
      "words": ["Do", "you", "remember", "the", "dividers"],
      "startMs": 0,
      "endMs": 1300,
      "heroIndices": [2],
      "heroWords": ["remember"]
    },
    {
      "words": ["we", "used", "to", "use", "in", "school"],
      "startMs": 1300,
      "endMs": 2120,
      "heroIndices": [],
      "heroWords": []
    },
    {
      "words": ["some", "countries", "take", "more", "extreme", "measures"],
      "startMs": 4020,
      "endMs": 6300,
      "heroIndices": [4],
      "heroWords": ["extreme"]
    }
  ]
}
```

### Where in the Pipeline

**Caption Agent — New subagent, runs after Trim Editor (Phase 2.5)**

- Dispatched immediately after trim, in parallel with Planner (Phase 3)
- Only needs: trimmed transcript with word-level timestamps + theme
- Output: fully placed captions in the manifest — track, items, timing, hero
  annotations, visual preset. Captions are DONE after this agent.
- Final Editor does NOT touch captions at all.

**What the Caption Agent does (complete ownership):**
1. Reads trimmed transcript (word-level timestamps)
2. Reads theme (for font family, accent color)
3. Groups words into natural phrases
4. Selects hero words per phrase
5. Creates caption track in manifest
6. Creates caption items with: timing, words with hero annotations
7. Sets captionPreset on manifest: displayMode, fonts, colors, position
8. Writes caption-plan.json for reference/debugging

**Pipeline position:**
```
Phase 1: Brief
Phase 2: Trim Editor
Phase 2.5: Caption Agent ──→ complete captions in manifest (track + items + preset)
Phase 3: Planner (runs in parallel with Caption Agent)
Phase 4: Setup Agent
...
Phase 8: Final Editor (does NOT touch captions — they're already done)
```

**Why after trim, not later:**
- Caption items need to exist in the manifest before the Layout Editor runs
  (Phase 6) so they appear on the timeline
- Running in parallel with Planner saves time — no serial dependency
- The caption plan is purely linguistic — it doesn't need creative/visual context
- Captions are fully self-contained: the Caption Agent has everything it needs
  (transcript + theme) to produce final output

### Caption Agent — System Prompt Outline

**Role:** You analyze transcripts and create caption phrase groupings with
emphasis annotations. You are a typography director — you decide which words
the viewer should focus on.

**Input:** Trimmed transcript with word-level timestamps (`/workspace/docs/transcript.json`)

**Output:**
1. Write `/workspace/docs/caption-plan.json`
2. Create caption items in manifest via `add_item` tool calls

**Rules for phrase grouping:**
- Group by natural speech units — clauses, breath pauses, thought boundaries
- 3-7 words per phrase (flexible, driven by meaning not count)
- Never break mid-clause ("the annual / baccalaureate" is wrong — keep together)
- Use timestamp gaps between words to detect natural pauses (>200ms gap = likely phrase boundary)
- Short emphatic phrases are fine ("Wait." / "Eight years." / "$390 million.")
- Keep numbers with their context ("800,000 students" not "800,000 / students")

**Rules for hero selection:**
- 0 heroes = transitional phrase, all satellite (e.g., "and so that's why")
- 1 hero = the default. Pick the ONE word that carries the phrase's weight
- 2 heroes = only for compound emphasis ("eight years", "$390 million", "facial recognition")
- Never more than 2 heroes per phrase

**What makes a word hero:**
- Numbers and stats: always hero ("$390", "800,000", "73%", "eight")
- The subject being discussed: hero when introduced, not when repeated
  ("baccalaureate" is hero the first time, satellite when mentioned again)
- Action verbs that drive the narrative: "shuts down", "destroyed", "failed"
- Emotional peak words: "extreme", "severe", "shocking"
- Defined/introduced terms: the first appearance of a key concept

**What is NOT hero:**
- Articles, prepositions, conjunctions: the, a, to, of, in, for, and, but
- Common verbs: is, are, was, have, do, will, can
- Pronouns: he, she, they, we, it
- Filler transitions: basically, actually, so, well, like
- Words that were hero in a previous phrase (avoid repetitive highlighting)

**Context awareness:**
- Read the FULL transcript before deciding any heroes
- Identify the video's 3-5 key terms/numbers — these are primary hero candidates
- Track which words have been hero'd — don't repeat the same highlight
- The hero density should feel natural: roughly 60% of phrases have a hero,
  40% are all-satellite. Never hero every single phrase.

### Manifest Storage

Each caption item stores hero annotations on its words:

```json
{
  "type": "caption",
  "data": {
    "words": [
      { "text": "Do", "startMs": 0, "endMs": 240, "hero": false },
      { "text": "you", "startMs": 240, "endMs": 400, "hero": false },
      { "text": "remember", "startMs": 400, "endMs": 660, "hero": true },
      { "text": "the", "startMs": 660, "endMs": 940, "hero": false },
      { "text": "dividers", "startMs": 940, "endMs": 1300, "hero": false }
    ]
  }
}
```

### KineticLuxeCaption Renderer Changes

- Remove static word classification (POWER_WORDS, STRONG_WORDS, FILLER_WORDS)
- Read `word.hero` field instead of `classifyWord()`
- Fallback: if no `hero` annotations exist, use static classification as backup
- All layout algorithm (sizing, stacking, poke avoidance, edge alignment) unchanged

### Rendering Algorithm (current, tuned)

**Phase 1: Build blocks in transcript order**
- Hero words (word.hero=true) → own block, large serif italic
- Consecutive non-hero words → satellite block, small sans-serif uppercase
- Satellite lines wrap at 90% of hero width

**Phase 2: Vertical stacking**
- Absolute positioning, INK_GAP=2px between blocks
- Letter-level collision detection for tight spacing:
  - Satellite above hero: if no ascender pokes (b,d,f,h,k,l,t) under satellite → tighten
  - Satellite below hero: if no descender pokes (g,y,p,q,j) above satellite → tighten
- Hero totalHeight = fontSize × 1.2 (Playfair Display exceeds em square)

**Phase 3: Horizontal poke-aware alignment**
- Find poke-free gaps in hero text (ascenders above, descenders below)
- Position satellite centered in the widest gap that fits
- Satellite stays within hero bounds (±15% overflow max)

**Phase 4: Render**
- Absolute positioned divs at computed coordinates
- Hero: spring scale-in animation on appearance
- Satellite: opacity fade on appearance
- All blocks always in DOM (opacity:0 when hidden) for stable layout

## Known Issues / TODO

### Caption Agent — Tools & Repair Capabilities

The Caption Agent needs tools to both create AND fix captions. It should be
re-dispatchable at any point — not just during initial pipeline.

**MCP Tools the Caption Agent needs:**

1. `read_manifest` — read current state of all tracks, items, timing
2. `add_track` — create caption track
3. `add_item` — create caption items
4. `update_item` — modify existing caption items (change hero, fix timing)
5. `remove_item` — delete broken/stale caption items
6. `split_item` — split a caption at a timestamp (when phrase spans a scene boundary)
7. `read_transcript` — read `/workspace/docs/transcript.json` for word timestamps

**Repair scenarios the Caption Agent handles:**

**1. Full regeneration**
- When: user says "regenerate captions", or captions are completely broken
- Action: remove all existing caption items, re-read transcript, create fresh

**2. Sync to scene boundaries**
- When: Layout Editor has placed scenes, captions span across scene cuts
- Action: read all scene items from manifest, split any caption that crosses
  a scene boundary. If a scene cut removes video (overlay/fullscreen), check
  if captions in that range still make sense with the audio timing.
- Example: Scene 1 ends at 6300ms, Scene 2 starts at 6300ms. Caption phrase
  "extreme measures uses drones" spans 5800-7200ms. Split into:
  - "extreme measures" (5800-6300) in Scene 1's range
  - "uses drones" (6300-7200) in Scene 2's range

**3. Fix timing after trim**
- When: Trim Editor removed fillers/silences, shifting timestamps
- Action: re-read updated transcript.json (timestamps already adjusted by
  trim), regenerate captions with new timing. Old caption items may reference
  pre-trim timestamps.

**4. Remove captions in dead zones**
- When: video segments removed (filler cuts), captions exist in gaps
- Action: scan manifest for gaps in video/audio track. Remove any caption
  items that fall entirely within a gap. Shorten captions that partially
  overlap a gap.

**5. Fix hero annotations**
- When: user says "highlight X instead of Y" or "don't highlight anything here"
- Action: find the caption phrase, update `word.hero` fields on specific words

**6. Re-phrase (merge/split phrases)**
- When: user says "combine these two captions" or "break this into shorter lines"
- Action: merge adjacent caption items (combine words arrays) or split a
  caption item at a word boundary

**Orchestrator integration for repairs:**

```
| User says                          | Orchestrator action                    |
|------------------------------------|----------------------------------------|
| "fix captions"                     | Re-dispatch Caption Agent (full regen) |
| "captions are out of sync"         | Re-dispatch with repair flag           |
| "highlight X not Y"               | Manifest tool directly (update_item)   |
| "make captions bigger/smaller"     | Update captionPreset (no agent needed) |
| "move captions up/down"           | Update captionPreset.position           |
| "remove captions from scene 3"    | Manifest tool (remove items in range)  |
| "regenerate captions"             | Re-dispatch Caption Agent (full regen) |
```

**Post-Layout sync (automatic):**

After Layout Editor (Phase 6) completes, the orchestrator should automatically
check if any captions span scene boundaries and dispatch Caption Agent for a
quick sync pass if needed. This is a lightweight repair, not full regeneration.

### P0 — Core Implementation Steps

1. **Caption Agent subagent type**
   - New file: `packages/sandbox/src/prompts/caption-agent/system.md`
   - System prompt: phrase grouping rules, hero selection rules, visual preset rules
   - Has access to manifest tools (add_track, add_item, update_manifest)
   - Reads: `/workspace/docs/transcript.json`, `/workspace/docs/guidelines/theme.md`
   - Writes: `/workspace/docs/caption-plan.json` (reference), manifest items

2. **Register in orchestrator**
   - Add `caption_agent` to subagent table
   - Dispatch after Trim Editor, in parallel with Planner
   - Pass theme slug so Caption Agent reads the right design tokens

3. **Caption Agent creates everything**
   - Reads transcript, groups into phrases, picks heroes
   - `add_track({ type: "caption", name: "Subtitles", position: 10 })` (top layer)
   - For each phrase: `add_item({ type: "caption", data: { words: [...] } })`
   - Each word: `{ text, startMs, endMs, hero: boolean }`
   - Sets `captionPreset` on manifest: `{ displayMode: "kinetic-luxe", fontFamily, fontSize, position, hero: { fontFamily, color }, satellite: { fontFamily, color } }`
   - Writes `caption-plan.json` for debugging

4. **KineticLuxeCaption reads `word.hero`**
   - Replace `isHero(w.text)` with `w.hero === true`
   - Fallback: if no `hero` field, use static classification (backward compat for old projects)

5. **Remove old caption creation paths**
   - Workspace init: stop creating caption items from raw transcript
   - Final Editor: remove caption creation/restructuring — only validates they exist
   - Caption track + items are fully owned by Caption Agent

6. **Theme integration**
   - Caption Agent reads theme.md for: accent color → hero color, headline font → hero font, body font → satellite font
   - Magazine theme: hero = Playfair Display italic #e63946, satellite = Inter uppercase white
   - Blackboard theme: hero = different font/color per theme tokens

### P1 — Rendering Quality
- [ ] Satellite text wrapping edge cases — very long words that exceed hero width
- [ ] Animation — satellite lines slide-up with stagger instead of instant opacity
- [ ] Multiple adjacent heroes — when two hero words are next to each other, merge into one hero block
- [ ] Orphan handling — single short satellite word ("a", "to") between heroes
- [ ] Font metrics — Playfair Display actual rendered height varies by character; current 1.2× is approximate

### P2 — Integration
- [ ] Color theming — hero color from theme accent, not hardcoded #e63946
- [ ] Caption preset integration — hero font, satellite font, colors from captionPreset config
- [ ] Font loading — ensure Playfair Display and Inter are loaded via Google Fonts
- [ ] Drag support — captions can't be repositioned by dragging (no transform on caption items)
- [ ] Cassowary constraint refinement — kiwi.js added to deps but not used (CSS approach works for now)

## Architecture Decisions
1. **React flex-wrap over canvas rendering** — The test HTML uses canvas for pixel-perfect layout, but React/Remotion needs DOM elements for Remotion's frame-sync and export pipeline. CSS flex-wrap handles word flow naturally.
2. **Hero forces line break** — Hero words get `display: block` behavior (own flex row) to visually stand out. Satellites wrap as inline spans.
3. **Transcript order preserved** — Words always render top-to-bottom in the order spoken. Hero word position in the flow matches its position in the transcript.
4. **No orphan merging across hero boundaries** — Satellite lines before and after a hero are never merged, preserving reading order.

## Config Shape (captionPreset.kineticConfig)
```typescript
interface KineticConfig {
  hero?: {
    fontFamily?: string;     // default: "'Playfair Display', serif"
    color?: string;          // default: '#e63946'
    sizeMultiplier?: number; // hero font = base × this (default: 2.8)
  };
  satellite?: {
    fontFamily?: string;     // default: "'Inter', sans-serif"
    color?: string;          // default: '#ffffff'
  };
  position?: {
    anchor?: 'bottom' | 'center' | 'top';
    offsetY?: number;        // percentage from anchor (default: 8)
  };
}
```

## Full Algorithm (from test HTML — for future canvas-based implementation)
1. **Phase 1: Measurement** — canvas `measureText` for ink-box precision (ascent, descent, cap height, dead space)
2. **Phase 2: Build Lines** — hero runs (consecutive heroes merge), satellite word-wrapping constrained by hero width
3. **Phase 3: Layout** — vertical ink-gap stacking, inline orphan detection, edge alignment (satellites align to hero edges)
4. **Phase 4: Cassowary Refinement** — kiwi.js constraint solver ensures safe-zone bounds, minimum line gaps
5. **Phase 4b: Alignment Snapping** — near-aligned lines snap to exact alignment (8px threshold)
6. **Phase 5: Animation** — critically damped spring for hero scale-in, staggered slide-up for satellites

## Files Changed
- `packages/sandbox/template/src/items/KineticLuxeCaption.tsx` — new component
- `packages/sandbox/template/src/items/index.tsx` — added export
- `packages/sandbox/template/src/PlayerComposition.tsx` — import + routing for kinetic-luxe displayMode
- `packages/sandbox/template/package.json` — added kiwi.js dep (for future use)
- `packages/sandbox/template/src/items/CaptionItem.tsx` — fixed `bottom: 40 + offsetY` bug
- `packages/sandbox/src/workspace-init.ts` — `force: true` on template copy for existing projects
