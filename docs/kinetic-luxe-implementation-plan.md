# Kinetic Luxe Captions — Implementation Plan

## Overview
Replace the mechanical caption system (wordsPerPhrase splitting, static word lists) with an AI-driven Caption Agent that owns captions end-to-end: phrase grouping, hero selection, placement, styling, and repair.

## Dependencies
- Trimmed transcript with word-level timestamps (from Trim Editor)
- Theme design tokens (from theme.md)
- Manifest tools (add_track, add_item, update_item, remove_item)
- KineticLuxeCaption renderer (already built, needs `word.hero` integration)

---

## Phase 0: Infrastructure Fixes (BLOCKERS — must come first)

These are critical bugs that would silently break the Caption Agent. Fix before
writing any Caption Agent code.

### 0.1 Add `hero` to captionWordSchema
**Files:**
- `packages/sandbox/src/tools/manifest-ops.ts` (line ~11)
- `packages/shared/src/manifest-shared.ts` (line ~6)

The Zod schema for caption words strips unknown fields. `hero: true` on words
is silently dropped by `safeParse`. Add:
```typescript
hero: z.boolean().optional(),
```

Without this fix, the Caption Agent can create items but `hero` annotations
never reach the manifest.

### 0.2 Guard `syncCaptions()` with managed-by-agent flag
**File:** `packages/sandbox/src/tools/transcript-sync.ts` (line ~145)

`syncCaptions()` is called as a side-effect from `update_item`, `remove_item`,
`split_item`, and `ripple_delete`. It **deletes ALL caption items** and
regenerates them mechanically from raw transcript.

This means: any time ANY agent modifies a video/audio item (Layout Editor
splitting video, Planner adjusting timing), all Caption Agent work is destroyed.

**Fix:** At the top of `syncCaptions()`, check:
```typescript
if (manifest.captionPreset?.managedByAgent) return; // skip — captions owned by Caption Agent
```

The Caption Agent sets `managedByAgent: true` on the captionPreset when it
creates captions. This flag tells `syncCaptions` to hands off.

### 0.3 Caption splitting is manual (not split_item)
**File:** `packages/sandbox/src/tools/manifest-ops.ts` (line ~592)

`split_item` only supports video/audio. Caption Agent must split phrases
manually: `remove_item` + two `add_item` calls, splitting the words array at
the timestamp boundary. Document this in the Caption Agent prompt — it does NOT
have a split tool for captions.

### 0.4 Update KineticLuxeCaption word type
**File:** `packages/sandbox/template/src/items/KineticLuxeCaption.tsx` (line ~109)

Add `hero?: boolean` to the word interface so TypeScript doesn't complain:
```typescript
words: Array<{ text: string; startMs: number; endMs: number; hero?: boolean }>;
```

### 0.5 Caption track position safety
Caption track position must be highest. Use `read_manifest` → find max track
position → set caption track to `maxPos + 10`. Don't hardcode position: 10.

---

## Phase 1: Caption Agent Prompt & Subagent Registration

### 1.1 Create Caption Agent system prompt
**File:** `packages/sandbox/src/prompts/caption-agent/system.md`

Contents:
- Role definition: typography director, owns captions completely
- Input: transcript.json, theme.md
- Output: caption-plan.json + manifest caption items + captionPreset
- Phrase grouping rules (see design doc)
- Hero selection rules (see design doc)
- Visual preset rules (font from theme, displayMode: kinetic-luxe)
- Repair mode instructions (when dispatched with `mode: "repair"`)

### 1.2 Create Caption Agent reminder prompt
**File:** `packages/sandbox/src/prompts/caption-agent/reminder.md`

Short checklist:
- Read full transcript before deciding anything
- 3-7 words per phrase, by meaning not count
- 0-2 heroes per phrase, ~60% phrases have hero
- Numbers always hero
- Don't repeat same hero word across phrases
- Set captionPreset with kinetic-luxe displayMode
- Write caption-plan.json for debugging

### 1.3 Register subagent in orchestrator
**File:** `packages/sandbox/src/orchestrator.ts`

- Add `caption_agent` to subagent type registry
- Map to prompt files: system.md + reminder.md
- Available tools: manifest tools (read_manifest, add_track, add_item, update_item, remove_item, split_item), file tools (Read, Write)

### 1.4 Add to prompt assembly
**File:** `packages/sandbox/src/prompt-assembly.ts`

- Add caption-agent prompt loading alongside existing agents

**Estimated effort:** Small — prompt file + registration wiring

---

## Phase 2: Orchestrator Pipeline Integration

### 2.1 Dispatch Caption Agent after Trim (Phase 2.5)
**File:** `packages/sandbox/src/prompts/orchestrator/system.md`

Add new phase between Trim Editor and Planner:

```
### Phase 2.5: Captions → dispatch **Caption Agent**

Report progress: `{ phase: "captions", message: "Creating captions..." }`

Dispatch Caption Agent with:
- Theme slug
- "Read /workspace/docs/transcript.json for word-level timestamps"
- "Read /workspace/docs/guidelines/theme.md for design tokens"
- "Create caption track and items with kinetic-luxe styling"

This runs IN PARALLEL with Planner (Phase 3). Do not wait for Caption Agent
before dispatching Planner — they are independent.

After Caption Agent returns: verify caption track exists in manifest.
Write phase marker: `echo "phase2.5-complete" > /workspace/.pipeline-phase`
```

### 2.2 Dispatch in parallel with Planner
**File:** `packages/sandbox/src/prompts/orchestrator/system.md`

Update Phase 3 dispatch to happen simultaneously:
```
// Dispatch both in parallel
Agent(caption_agent, "Create captions...")
Agent(planner, "Plan scenes...")
```

### 2.3 Add Phase 6.5: Caption sync after Layout
**File:** `packages/sandbox/src/prompts/orchestrator/system.md`

After Layout Editor completes:
```
### Phase 6.5: Caption Sync (if needed)

Read manifest. Check if any caption items span scene boundaries
(caption startMs < scene boundary AND caption endMs > scene boundary).

If yes: re-dispatch Caption Agent with mode "sync":
- "Split captions at scene boundaries: [list of boundary timestamps]"
- "Do not regenerate — only split/trim existing captions"

If no boundary conflicts: skip, proceed to Phase 7.
```

### 2.4 Add Caption Agent to refinement table
**File:** `packages/sandbox/src/prompts/orchestrator/system.md`

Add to refinement table:
```
| "fix captions" / "regenerate captions" | Re-dispatch Caption Agent (full regen) |
| "highlight X not Y"                    | Re-dispatch Caption Agent (hero fix)   |
| "captions out of sync"                 | Re-dispatch Caption Agent (sync mode)  |
| "make captions bigger/move up"         | Update captionPreset directly           |
```

### 2.5 Add to orchestrator translation table
**File:** `packages/sandbox/src/prompts/orchestrator/system.md`

```
| "the words are wrong" / "highlighting wrong word" | Re-dispatch Caption Agent |
| "captions are overlapping" / "text is cut off"     | Re-dispatch Caption Agent |
| "I want different caption style"                   | Update captionPreset      |
```

### 2.6 Fallback if Caption Agent fails
If Caption Agent returns but no caption track exists in manifest:
- Log warning
- Call `generate_captions` tool as degraded fallback (mechanical captions)
- Set `captionPreset.displayMode = "phrase"` (not kinetic-luxe)
- Continue pipeline — user gets basic captions rather than none

### 2.7 Update phase tracking
**File:** `packages/sandbox/src/prompts/orchestrator/system.md`

Add `phase2.5-complete` to resume logic:
- `phase2-complete` → check if caption track exists. If yes, skip 2.5. If no, dispatch Caption Agent.

**Estimated effort:** Medium — orchestrator prompt changes, parallel dispatch

---

## Phase 3: Remove Old Caption Creation

### 3.1 Remove caption creation from workspace-init
**File:** `packages/sandbox/src/workspace-init.ts`

Currently workspace-init creates caption items from raw transcript words during initialization. Remove this — Caption Agent owns caption creation.

Keep: transcript.json creation (Caption Agent reads it)
Remove: caption item creation, caption track creation

### 3.2 Remove caption creation from Final Editor
**File:** `packages/sandbox/src/prompts/final-editor/system.md`

Remove any instructions about creating/restructuring caption items.
Keep: caption validation (verify they exist), caption preset application if missing.

### 3.3 Remove mechanical wordsPerPhrase splitting
**File:** `packages/sandbox/template/src/PlayerComposition.tsx`

Remove `mergeCaptionPhrases` function — the Caption Agent already creates
properly grouped phrases. No need for post-hoc merging.

**Estimated effort:** Small — removing code, not adding

---

## Phase 4: KineticLuxeCaption `word.hero` Integration

### 4.1 Read hero from word data
**File:** `packages/sandbox/template/src/items/KineticLuxeCaption.tsx`

Replace:
```typescript
function isHero(text: string): boolean {
  const tier = classifyWord(text);
  return tier === 'power' || tier === 'strong';
}
```

With:
```typescript
// In component: read hero from word data, fallback to static classification
const wordData = useMemo(() =>
  words.map((w, i) => ({
    ...w,
    index: i,
    isHero: w.hero !== undefined ? w.hero : isHeroFallback(w.text),
  })),
[words]);
```

Keep static classification as `isHeroFallback` for backward compatibility
with old projects that don't have hero annotations.

### 4.2 Handle phrases with no hero
When `heroIndices` is empty (all-satellite phrase):
- All words render as satellite (small sans-serif uppercase)
- No hero block in the layout
- Simpler stacking — just satellite lines

### 4.3 Handle 2 adjacent heroes
When two consecutive words are both hero:
- Merge into one hero block: "eight years" renders as one large hero line
- Already handled by hero run merging in current code

**Estimated effort:** Small — minor code change + fallback

---

## Phase 5: Caption Agent Prompt — Full Content

### 5.1 System prompt structure

```markdown
<role>
You are the Caption Agent. You create and manage captions for the video.
You own captions completely — phrase grouping, hero word selection, timing,
visual styling, and placement in the manifest.
</role>

<input>
- /workspace/docs/transcript.json — word-level timestamps
- /workspace/docs/guidelines/theme.md — design tokens (fonts, colors)
- Manifest (via read_manifest) — for repair mode, read existing state
</input>

<output>
1. Caption track + items in manifest (via add_track, add_item)
2. captionPreset on manifest (via update_manifest or equivalent)
3. /workspace/docs/caption-plan.json (reference file)
</output>

<modes>
## Create mode (initial pipeline)
Read transcript → group phrases → select heroes → create items → set preset

## Sync mode (after layout)
Read manifest → find captions spanning scene boundaries → split at boundaries

## Repair mode (user-triggered)
Read manifest + transcript → diagnose issue → fix (regen/split/update heroes)
</modes>

<phrase_rules>
[phrase grouping rules from design doc]
</phrase_rules>

<hero_rules>
[hero selection rules from design doc]
</hero_rules>

<visual_preset>
Read theme.md and set captionPreset:
{
  displayMode: "kinetic-luxe",
  hero: {
    fontFamily: [theme headline font, italic],
    color: [theme accent color]
  },
  satellite: {
    fontFamily: [theme body font],
    color: "#ffffff"
  },
  position: {
    anchor: "bottom",
    offsetY: 8
  }
}
</visual_preset>

<repair_scenarios>
[6 repair scenarios from design doc]
</repair_scenarios>
```

### 5.2 Caption plan JSON — what the agent writes

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
    },
    {
      "id": 2,
      "words": ["we", "used", "to", "use"],
      "startMs": 1300,
      "endMs": 2120,
      "heroIndices": [],
      "reason": "transitional, no emphasis needed"
    }
  ]
}
```

**Estimated effort:** Medium — prompt writing, testing with different transcripts

---

## Phase 6: Testing & Tuning

### 6.1 Test with current project (Algeria blackouts)
- Run full pipeline with Caption Agent
- Verify phrase groupings match natural speech
- Verify hero selections make sense for the content
- Check rendering in KineticLuxeCaption

### 6.2 Test repair flows
- Manually break captions → dispatch Caption Agent in repair mode
- Test scene boundary sync after Layout Editor
- Test hero change via chat ("highlight X not Y")

### 6.3 Test with different content types
- Tutorial (technical terms as heroes)
- Podcast (emotional words as heroes)
- Data-heavy video (numbers as heroes)

### 6.4 Tune hero density
- Target: ~60% phrases have hero
- Adjust prompt if too aggressive or too sparse
- Verify no repeated hero across adjacent phrases

**Estimated effort:** Medium — iterative testing

---

## Phase 7: Cleanup & Polish

### 7.1 Remove static word classification from KineticLuxeCaption
Once Caption Agent is stable, remove POWER_WORDS, STRONG_WORDS, FILLER_WORDS
sets and `classifyWord` function. Keep only `isHeroFallback` for old projects.

### 7.2 Remove kiwi.js dependency
Not using Cassowary constraint solver — CSS absolute positioning works.
Remove from package.json to reduce bundle size.

### 7.3 Rebuild sandbox image
Final image rebuild with all changes:
- Caption Agent prompts
- Updated orchestrator
- Cleaned KineticLuxeCaption
- Removed old caption creation paths

### 7.4 Update memory/docs
- Update `docs/kinetic-luxe-captions.md` with final state
- Save project memory about Caption Agent architecture

**Estimated effort:** Small — cleanup

---

## Summary

| Phase | What | Effort | Dependencies |
|-------|------|--------|-------------|
| 0 | Infrastructure fixes (BLOCKERS) | Small | None — do first |
| 1 | Caption Agent prompt + registration | Small | Phase 0 |
| 2 | Orchestrator pipeline integration | Medium | Phase 1 |
| 3 | Remove old caption creation paths | Small | Phase 2 |
| 4 | KineticLuxeCaption word.hero | Small | Phase 0 |
| 5 | Caption Agent full prompt content | Medium | Phase 1 |
| 6 | Testing & tuning | Medium | All above |
| 7 | Cleanup & polish | Small | Phase 6 |

**Phase 0 is the critical path — without it, the Caption Agent silently fails.**
**Phase 0 + 1 + 4 can start in parallel once 0 is done.**
