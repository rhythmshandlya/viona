# Caption Agent — Design Spec

## Problem
Captions are currently created mechanically: words split by fixed count (`wordsPerPhrase`), highlighted by static word lists. This produces unnatural phrase breaks, wrong emphasis, and no contextual awareness.

## Solution
A dedicated **Caption Agent** subagent that owns captions end-to-end. AI decides phrase boundaries, hero words, styling, and placement. The renderer just displays what the AI decided.

## Core Principle
**AI decides everything. Code just renders. Zero intelligence in the renderer.**

---

## Architecture

### Caption Agent is Timeline-Aware
The Caption Agent reads the **full manifest** — not just the transcript. It understands video items, scene items, tracks, and timing. This means:
- Initial creation considers likely scene boundaries (avoid phrases that span cuts)
- Repair/sync doesn't need a separate mode — the agent always has full context
- Smart decisions: if a scene transition happens at 6300ms, don't create a phrase that spans 6000-6500ms

### Pipeline Position
```
Phase 2: Trim Editor → clean transcript
Phase 2.5: Caption Agent (parallel with Planner)
           Reads: transcript.json + theme.md + full manifest
           Writes: caption track + items + captionPreset + caption-plan.json
Phase 3: Planner (parallel with Caption Agent)
Phase 6: Layout Editor
Phase 6.5: Caption sync — re-dispatch Caption Agent if captions span scene boundaries
Phase 8: Final Editor (does NOT touch captions)

Refinement: Caption Agent re-dispatchable anytime
```

### What the Caption Agent Does (Complete Ownership)
1. Reads trimmed transcript (word-level timestamps)
2. Reads theme (font family, accent color)
3. Reads full manifest (video items, audio items, existing tracks — for timeline awareness)
4. Groups words into natural phrases (3-7 words, by meaning/pauses/scene boundaries)
5. Selects hero words per phrase (0-2 per phrase, context-aware)
6. Creates caption track in manifest (highest position)
7. Creates caption items with timing + hero annotations
8. Sets captionPreset: displayMode, fonts, colors, position
9. Sets `captionPreset.managedByAgent: true` (protects from syncCaptions destruction)
10. Writes caption-plan.json for reference/debugging

### What the Caption Agent Does NOT Do
- Does not write scene code
- Does not modify video/audio items
- Does not touch the scene plan
- Does not make creative visual decisions about animations

---

## Data Model

### Caption Item in Manifest
```json
{
  "type": "caption",
  "trackId": "trk-subtitles",
  "startMs": 0,
  "endMs": 1300,
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

### caption-plan.json (Reference/Debug)
```json
{
  "videoTitle": "Algeria Internet Blackouts",
  "keyTerms": ["baccalaureate", "blackouts", "$390 million", "800,000"],
  "totalPhrases": 37,
  "heroRate": 0.62,
  "phrases": [
    {
      "id": 1,
      "words": ["Do", "you", "remember", "the", "dividers"],
      "startMs": 0,
      "endMs": 1300,
      "heroIndices": [2],
      "reason": "remember is the action verb that hooks the viewer"
    }
  ]
}
```

### captionPreset on Manifest
```json
{
  "displayMode": "kinetic-luxe",
  "managedByAgent": true,
  "hero": {
    "fontFamily": "'Playfair Display', serif",
    "color": "#e63946",
    "sizeMultiplier": 2.8
  },
  "satellite": {
    "fontFamily": "'Inter', sans-serif",
    "color": "#ffffff"
  },
  "position": {
    "anchor": "bottom",
    "offsetY": 8
  }
}
```

---

## Phrase Grouping Rules

- Group by natural speech units — clauses, breath pauses, thought boundaries
- 3-7 words per phrase (flexible, driven by meaning not count)
- Never break mid-clause ("the annual / baccalaureate" is wrong — keep together)
- Use timestamp gaps between words (>200ms = likely phrase boundary)
- Short emphatic phrases are fine ("Wait." / "Eight years." / "$390 million.")
- Keep numbers with their context ("800,000 students" not "800,000 / students")
- **Timeline-aware:** don't create phrases that span scene boundaries or video cuts

## Hero Selection Rules

- 0 heroes = transitional phrase, all satellite
- 1 hero = default. The ONE word that carries the phrase's weight
- 2 heroes = only for compound emphasis ("eight years", "facial recognition")
- Never more than 2 per phrase

**What makes a word hero:**
- Numbers and stats: always hero
- Subject being discussed: hero when introduced, satellite when repeated
- Action verbs that drive narrative: "shuts down", "destroyed"
- Emotional peak words: "extreme", "severe"
- Defined/introduced terms: first appearance of a key concept

**What is NOT hero:**
- Articles, prepositions, conjunctions
- Common verbs: is, are, was, have
- Pronouns
- Filler transitions
- Words already hero'd in a previous phrase

**Context awareness:**
- Read FULL transcript before deciding any heroes
- Identify video's 3-5 key terms — primary hero candidates
- Track which words have been hero'd — don't repeat
- Hero density: ~60% phrases have hero, ~40% all-satellite

---

## Tools Available to Caption Agent

### Manifest Tools
- `read_manifest` — read current state (tracks, items, timing, scene boundaries)
- `add_track` — create caption track
- `add_item` — create caption items with hero annotations
- `update_item` — modify existing items (fix hero, adjust timing)
- `remove_item` — delete broken/stale items
- `update_caption_preset` — set displayMode, fonts, colors, managedByAgent

### File Tools
- `Read` — read transcript.json, theme.md
- `Write` — write caption-plan.json

### NOT Available
- `split_item` — does not support caption type. Agent must manually remove + add two items to split a phrase.
- `update_manifest` — excluded from tools (data loss risk). Use `update_caption_preset` instead.

---

## Repair Capabilities

The Caption Agent is re-dispatchable for repairs at any point.

### 1. Full Regeneration
- Trigger: "regenerate captions", "fix captions"
- Action: remove all caption items, re-read transcript + manifest, create fresh

### 2. Sync to Scene Boundaries
- Trigger: after Layout Editor (Phase 6.5), or "captions out of sync"
- Action: read manifest, find captions spanning scene boundaries, split at boundary (remove + 2x add_item preserving hero annotations)

### 3. Fix Timing After Trim
- Trigger: transcript timestamps changed
- Action: re-read transcript.json, regenerate with new timing

### 4. Remove Dead Zone Captions
- Trigger: video segments removed, captions in gaps
- Action: scan for timeline gaps, remove/shorten overlapping captions

### 5. Fix Hero Annotations
- Trigger: "highlight X not Y"
- Action: find phrase, update word.hero fields

### 6. Re-phrase (Merge/Split)
- Trigger: "combine these captions", "break this into shorter lines"
- Action: merge adjacent items or split at word boundary

### Self-Validation (mandatory final step)
After any create or repair operation:
- All transcript words accounted for (no gaps, no duplicates)
- No phrase time overlaps
- Hero count per phrase is 0-2
- Timing monotonically increases
- Caption track is highest position

---

## Infrastructure Fixes Required (Blockers)

### B1: Zod Schema Strips `hero` Field
**Files:** `packages/sandbox/src/tools/manifest-ops.ts`, `packages/shared/src/manifest-shared.ts`

`captionWordSchema` uses `z.object()` without `.passthrough()`. `hero: true` is silently stripped by `safeParse`.

**Fix:** Add `hero: z.boolean().optional()` to the schema.

### B2: `syncCaptions()` Destroys Agent Work
**File:** `packages/sandbox/src/tools/transcript-sync.ts`

Called as side-effect from `update_item`, `remove_item`, `split_item`, `ripple_delete`. Deletes ALL caption items and regenerates mechanically.

**Fix:** Check `manifest.captionPreset?.managedByAgent === true` at top of `syncCaptions()`. If true, skip.

### B3: `split_item` Rejects Captions
**File:** `packages/sandbox/src/tools/manifest-ops.ts`

Only supports video/audio. Caption Agent must use remove + 2x add_item.

**Fix:** Document in prompt. No code change needed (manual split is fine).

### B4: TypeScript Types
**File:** `packages/sandbox/template/src/items/KineticLuxeCaption.tsx`

Word interface missing `hero?: boolean`.

**Fix:** Add to interface.

---

## Renderer: KineticLuxeCaption

### How It Reads Hero Annotations
```typescript
// Read hero from word data, fallback to static classification
const isWordHero = (w) => w.hero !== undefined ? w.hero : isHeroFallback(w.text);
```

### Layout Algorithm (Absolute Positioning)
1. **Build blocks** in transcript order: hero words → own block, satellites → wrapped lines
2. **Vertical stacking** with letter-level collision detection:
   - Satellite above hero: if no ascender pokes (b,d,f,h,k,l,t) under satellite's X range → tighten
   - Satellite below hero: if no descender pokes (g,y,p,q,j) above satellite's X range → tighten
3. **Horizontal poke-aware alignment**: find widest ascender/descender-free gap, center satellite there
4. **Render**: absolute positioned divs, hero spring scale-in, satellite opacity fade

### All-Satellite Phrases (No Hero)
When a phrase has no hero words: all words render as satellite, simple centered stacking, no poke avoidance needed.

### Backward Compatibility
Old projects without `hero` annotations → fallback to static `classifyWord()`. Works but not AI-quality.

---

## Orchestrator Integration

### Dispatch
```
// After Trim Editor completes, dispatch both in parallel:
Agent(caption_agent, "Create captions. Read transcript + theme + manifest.")
Agent(planner, "Plan scenes...")
```

### Phase 6.5 Auto-Sync
After Layout Editor: orchestrator checks for boundary-spanning captions, re-dispatches Caption Agent if needed.

### Refinement Table
| User says | Action |
|-----------|--------|
| "fix captions" / "regenerate" | Re-dispatch Caption Agent (full regen) |
| "highlight X not Y" | Re-dispatch Caption Agent (hero fix) |
| "captions out of sync" | Re-dispatch Caption Agent (sync) |
| "make captions bigger" | Update captionPreset directly |
| "move captions up" | Update captionPreset.position directly |
| "the words are wrong" | Re-dispatch Caption Agent |

### Translation Table (User Language → System)
| User says | Means |
|-----------|-------|
| "wrong word highlighted" | Hero annotation needs fixing |
| "captions overlapping" | Phrase boundaries need adjustment |
| "text cut off" | Phrase too long, needs wrapping/splitting |
| "different caption style" | Change captionPreset.displayMode |

### Fallback
If Caption Agent fails (timeout/error/no output): call `generate_captions` as degraded fallback, set `displayMode: "phrase"`. User gets mechanical captions rather than none.

---

## Default Experience

Kinetic-luxe is the new default caption style for all new projects. The Caption Agent sets `displayMode: "kinetic-luxe"` on every run. Users can change to other styles via captionPreset, but the out-of-box experience is the AI-driven kinetic layout.
