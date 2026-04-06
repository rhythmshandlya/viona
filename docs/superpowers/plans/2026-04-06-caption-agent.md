# Caption Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mechanical caption system with an AI-driven Caption Agent that owns captions end-to-end — phrase grouping, hero word selection, placement, styling, and repair.

**Architecture:** A new `caption_agent` subagent runs after Trim Editor (Phase 2.5), parallel with Planner. It reads the full transcript + manifest, groups words into natural phrases, selects hero words contextually, creates caption items with `hero: boolean` annotations, and sets the `kinetic-luxe` display mode. The KineticLuxeCaption renderer reads `word.hero` instead of static word lists. A `managedByAgent` flag on captionPreset prevents `syncCaptions()` from destroying AI-created captions.

**Tech Stack:** TypeScript, Zod schemas, MCP tools, Claude SDK subagents, Remotion React components

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/manifest-shared.ts` | Modify | Add `hero` to captionWordSchema |
| `packages/sandbox/src/tools/manifest-ops.ts` | Modify | Add `hero` to local captionWordSchema |
| `packages/sandbox/src/tools/transcript-sync.ts` | Modify | Guard `syncCaptions()` with `managedByAgent` flag |
| `packages/sandbox/template/src/items/KineticLuxeCaption.tsx` | Modify | Read `word.hero`, add type, fallback |
| `packages/sandbox/src/prompts/caption-agent/system.md` | Create | Caption Agent system prompt |
| `packages/sandbox/src/prompts/caption-agent/reminder.md` | Create | Caption Agent reminder checklist |
| `packages/sandbox/src/orchestrator.ts` | Modify | Register `caption_agent` subagent |
| `packages/sandbox/src/prompt-assembly.ts` | Modify | Add caption-agent prompt loading |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Modify | Add Phase 2.5, Phase 6.5, refinement table |
| `packages/sandbox/src/prompts/final-editor/system.md` | Modify | Remove caption creation, keep validation only |

---

### Task 1: Add `hero` field to caption word schemas

**Files:**
- Modify: `packages/shared/src/manifest-shared.ts:6-14`
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:11-17`

Without this fix, `hero: true` annotations are silently stripped by Zod `safeParse` and never reach the manifest.

- [ ] **Step 1: Add `hero` to shared schema**

In `packages/shared/src/manifest-shared.ts`, find the `captionWordSchema` and add `hero`:

```typescript
export const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  hero: z.boolean().optional(),
  role: z.string().optional(),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});
```

- [ ] **Step 2: Add `hero` to sandbox local schema**

In `packages/sandbox/src/tools/manifest-ops.ts`, find the local `captionWordSchema` (line ~11) and add `hero`:

```typescript
const captionWordSchema = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  hero: z.boolean().optional(),
  classification: z.enum(['power', 'medium', 'filler']).optional(),
  styleOverrides: z.record(z.string(), z.unknown()).optional(),
});
```

- [ ] **Step 3: Verify schemas compile**

Run: `cd packages/shared && npx tsc --noEmit`
Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors related to captionWordSchema

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-shared.ts packages/sandbox/src/tools/manifest-ops.ts
git commit -m "fix: add hero field to captionWordSchema for AI-driven captions"
```

---

### Task 2: Guard `syncCaptions()` with `managedByAgent` flag

**Files:**
- Modify: `packages/sandbox/src/tools/transcript-sync.ts:145-201`

`syncCaptions()` is called as a fire-and-forget side-effect from `update_item`, `remove_item`, `split_item`, and `ripple_delete`. It deletes ALL caption items and regenerates them mechanically. This destroys Caption Agent work whenever ANY agent modifies a video/audio item.

- [ ] **Step 1: Add guard at top of syncCaptions()**

In `packages/sandbox/src/tools/transcript-sync.ts`, find `syncCaptions()` (line ~145). Add a guard that reads the manifest's `captionPreset.managedByAgent` flag:

```typescript
export async function syncCaptions(): Promise<void> {
  try {
    // If captions are managed by the Caption Agent, skip automatic regeneration.
    // The Caption Agent handles phrase grouping and hero selection — mechanical
    // syncCaptions would destroy its work.
    const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    if (manifest.captionPreset?.managedByAgent) {
      return;
    }

    // ... rest of existing syncCaptions code unchanged ...
```

Find the existing first line of the function body (which reads the synced transcript) and add the guard before it. Keep all existing logic intact below the guard.

- [ ] **Step 2: Verify the guard works**

The guard reads the manifest JSON directly (not via MCP tools) since `syncCaptions` is a low-level function. When `captionPreset.managedByAgent` is `true`, it returns immediately without touching any caption items.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/tools/transcript-sync.ts
git commit -m "fix: guard syncCaptions with managedByAgent flag to protect AI captions"
```

---

### Task 3: Update KineticLuxeCaption to read `word.hero`

**Files:**
- Modify: `packages/sandbox/template/src/items/KineticLuxeCaption.tsx`

- [ ] **Step 1: Update word type interface**

Find the `KineticLuxeCaptionProps` interface (line ~108) and add `hero?`:

```typescript
interface KineticLuxeCaptionProps {
  words: Array<{ text: string; startMs: number; endMs: number; hero?: boolean }>;
  itemStartMs: number;
  config?: KineticConfig;
}
```

- [ ] **Step 2: Replace `isHero` with annotation-aware check**

Rename the existing `isHero` function to `isHeroFallback` and create a new function:

```typescript
// Static fallback for old projects without hero annotations
function isHeroFallback(text: string): boolean {
  const tier = classifyWord(text);
  return tier === 'power' || tier === 'strong';
}
```

- [ ] **Step 3: Update hero detection in component**

In the component body, find where `heroIndices` is computed (line ~133). Replace the classification logic:

```typescript
    // Phase 1: Classify words, find heroes
    const wordList = words.map(w => w.text);
    const heroIndices: number[] = [];
    wordList.forEach((w, i) => {
      // Read AI annotation first, fallback to static classification
      const wordHero = words[i].hero !== undefined ? words[i].hero : isHeroFallback(w);
      if (wordHero) heroIndices.push(i);
    });
    if (heroIndices.length === 0) {
      let longest = 0;
      wordList.forEach((w, i) => { if (w.length > wordList[longest].length) longest = i; });
      heroIndices.push(longest);
    }
```

- [ ] **Step 4: Handle all-satellite phrases**

After the hero detection, add a check: if the original words had `hero` annotations and ALL were `false`, don't force a fallback hero. Only pick the longest word when there are no annotations at all:

```typescript
    // If AI annotated all words as non-hero, respect that (no forced fallback)
    const hasAnnotations = words.some(w => w.hero !== undefined);
    if (heroIndices.length === 0 && !hasAnnotations) {
      let longest = 0;
      wordList.forEach((w, i) => { if (w.length > wordList[longest].length) longest = i; });
      heroIndices.push(longest);
    }
```

Replace the existing fallback block with this version.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/template/src/items/KineticLuxeCaption.tsx
git commit -m "feat: KineticLuxeCaption reads word.hero annotations with static fallback"
```

---

### Task 4: Create Caption Agent system prompt

**Files:**
- Create: `packages/sandbox/src/prompts/caption-agent/system.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/sandbox/src/prompts/caption-agent
```

- [ ] **Step 2: Write system prompt**

Create `packages/sandbox/src/prompts/caption-agent/system.md` with this content:

```markdown
<role>
You are the Caption Agent. You create and manage captions for the video. You own captions completely — phrase grouping, hero word selection, timing, visual styling, and placement in the manifest.

You are a typography director. You decide which words the viewer should focus on, how words group into readable phrases, and how the captions integrate with the video's timeline.
</role>

<input>
- `/workspace/docs/transcript.json` — word-level timestamps (read with Read tool)
- `/workspace/docs/guidelines/theme.md` — design tokens: fonts, colors (read with Read tool)
- Manifest (via `read_manifest`) — full timeline state: tracks, items, scene boundaries
</input>

<output>
1. Caption track + items in manifest (via `add_track`, `add_item`)
2. Caption preset on manifest (via `update_caption_preset`)
3. `/workspace/docs/caption-plan.json` — reference file for debugging (via Write tool)
</output>

<rules>
## Phrase Grouping

Group words into natural speech units — clauses, breath pauses, thought boundaries.

- 3-7 words per phrase (flexible, driven by meaning not fixed count)
- Never break mid-clause ("the annual / baccalaureate" is WRONG — keep together)
- Use timestamp gaps between words to detect natural pauses (>200ms gap = likely phrase boundary)
- Short emphatic phrases are fine: "Wait." / "Eight years." / "$390 million."
- Keep numbers with their context: "800,000 students" not "800,000 / students"
- **Timeline-aware:** read the manifest for scene boundaries. Do NOT create phrases that span a scene cut or video gap.

## Hero Selection

Each phrase gets 0, 1, or 2 hero words. Heroes are the words that carry the phrase's meaning and deserve visual emphasis.

- **0 heroes** = transitional phrase, all satellite. Examples: "and so that's why", "you know what I mean"
- **1 hero** = the default. Pick the ONE word that carries the phrase's weight.
- **2 heroes** = only for compound emphasis. Examples: "eight years", "$390 million", "facial recognition"
- **Never more than 2 heroes per phrase.**

### What makes a word hero:
- Numbers and stats: ALWAYS hero ("$390", "800,000", "73%", "eight")
- The subject being discussed: hero when INTRODUCED, satellite when repeated ("baccalaureate" is hero the first time, satellite after)
- Action verbs that drive the narrative: "shuts down", "destroyed", "failed"
- Emotional peak words: "extreme", "severe", "shocking"
- Defined/introduced terms: the first appearance of a key concept

### What is NOT hero:
- Articles, prepositions, conjunctions: the, a, to, of, in, for, and, but
- Common verbs: is, are, was, have, do, will, can
- Pronouns: he, she, they, we, it
- Filler transitions: basically, actually, so, well, like
- Words that were hero in a PREVIOUS phrase — avoid repetitive highlighting

### Context awareness:
- Read the FULL transcript before deciding any heroes
- Identify the video's 3-5 key terms/numbers — these are primary hero candidates
- Track which words have been hero'd — don't repeat the same highlight
- Hero density: roughly 60% of phrases have a hero, 40% are all-satellite. Never hero every single phrase.

## Visual Preset

Read theme.md to determine fonts and colors. Set `captionPreset` via `update_caption_preset`:

```json
{
  "displayMode": "kinetic-luxe",
  "managedByAgent": true,
  "wordsPerPhrase": 5,
  "fontFamily": "[theme body font]",
  "fontSize": 54,
  "fontWeight": 800,
  "color": "#ffffff",
  "activeColor": "[theme accent color]",
  "position": { "anchor": "bottom", "offsetY": 8 }
}
```

The `managedByAgent: true` flag prevents automatic caption regeneration from destroying your work.

## Caption Splitting (for repair/sync)

`split_item` does NOT support caption items. To split a caption at a timestamp:
1. Read the caption item via `read_manifest`
2. `remove_item` the original
3. `add_item` twice — one with words before the split, one with words after
4. Preserve `hero` annotations on both halves

## Self-Validation (mandatory final step)

After creating all captions, verify:
- [ ] All transcript words are accounted for (no gaps between phrases, no missing words)
- [ ] No phrase time overlaps (each phrase endMs <= next phrase startMs)
- [ ] Hero count per phrase is 0-2
- [ ] Timing is monotonically increasing
- [ ] Caption track exists and is at the highest position
- [ ] `captionPreset.managedByAgent` is set to `true`
</rules>

<task>
## Workflow

### Create Mode (initial pipeline)

1. Read `/workspace/docs/transcript.json` — get all words with timestamps
2. Read `/workspace/docs/guidelines/theme.md` — get font family, accent color
3. `read_manifest` — get existing tracks, items, scene boundaries (for timeline awareness)
4. Analyze the full transcript:
   - Identify the video's key terms/numbers (3-5 primary hero candidates)
   - Map natural phrase boundaries (pauses, clause breaks, scene cuts)
5. Create caption track: `add_track({ type: "caption", name: "Subtitles" })`
   - Read manifest first to find max track position, set position to max + 10
6. For each phrase: `add_item({ type: "caption", trackId, startMs, endMs, data: { words } })`
   - Each word: `{ text, startMs, endMs, hero: true/false }`
7. Set caption preset: `update_caption_preset({ displayMode: "kinetic-luxe", managedByAgent: true, ... })`
8. Write `/workspace/docs/caption-plan.json` for reference
9. Run self-validation

### Sync Mode (dispatched with "sync" instruction)

1. `read_manifest` — find all caption items and scene boundaries
2. Identify captions that span scene boundaries
3. For each spanning caption: split at the boundary (remove + 2x add_item)
4. Preserve hero annotations when splitting
5. Run self-validation

### Repair Mode (dispatched with specific repair instruction)

Read the dispatch prompt for the specific repair needed:
- "full regen" → delete all captions, run Create Mode
- "hero fix" → find specific phrase, update word.hero via `update_item`
- "timing fix" → re-read transcript, regenerate with new timestamps
- "remove dead zones" → find timeline gaps, remove/shorten overlapping captions
</task>
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/caption-agent/system.md
git commit -m "feat: Caption Agent system prompt — phrase grouping, hero selection, repair"
```

---

### Task 5: Create Caption Agent reminder prompt

**Files:**
- Create: `packages/sandbox/src/prompts/caption-agent/reminder.md`

- [ ] **Step 1: Write reminder**

Create `packages/sandbox/src/prompts/caption-agent/reminder.md`:

```markdown
<critical_reminder>
## Read First
- Read the FULL transcript before deciding ANY heroes or phrase boundaries.
- Read the manifest for scene boundaries — never create phrases that span cuts.

## Phrase Rules
- 3-7 words per phrase, by meaning not count
- Never break mid-clause
- Timestamp gaps >200ms suggest natural boundaries

## Hero Rules
- 0-2 heroes per phrase. 60% have hero, 40% don't.
- Numbers/stats = always hero
- First appearance of key terms = hero
- Don't repeat same hero word across phrases

## Required Actions
- `add_track` for caption track (position = max + 10)
- `add_item` for each phrase with `hero: true/false` on every word
- `update_caption_preset` with `managedByAgent: true` and `displayMode: "kinetic-luxe"`
- Write `caption-plan.json` for debugging

## Caption Splitting
- `split_item` does NOT support captions
- To split: `remove_item` + 2x `add_item` with words divided at timestamp

## Self-Validation (mandatory)
- All words accounted for (no gaps)
- No phrase overlaps
- Hero count 0-2 per phrase
- Monotonic timing
- Caption track is highest position
</critical_reminder>
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/caption-agent/reminder.md
git commit -m "feat: Caption Agent reminder prompt"
```

---

### Task 6: Register Caption Agent in orchestrator

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Add to SUBAGENT_LABELS**

Find `SUBAGENT_LABELS` (line ~220) and add `caption_agent`:

```typescript
const SUBAGENT_LABELS: Record<string, string> = {
  trim_editor: 'Trim Editor',
  planner: 'Planner',
  caption_agent: 'Caption Agent',
  setup_agent: 'Setup Agent',
  layout_editor: 'Layout Editor',
  animator: 'Animator',
  final_editor: 'Final Editor',
};
```

- [ ] **Step 2: Add agent definition to agents object**

Find the `agents` object (line ~329). Add `caption_agent` after `planner`:

```typescript
caption_agent: {
  tools: [
    ...MANIFEST_TOOL_NAMES,
    ...ANALYSIS_TOOL_NAMES,
    'Read', 'Write', 'Glob', 'Grep',
  ],
  systemPrompt: captionAgentSystemPrompt,
  reminderPrompt: captionAgentReminderPrompt,
  maxTurns: 30,
},
```

The `captionAgentSystemPrompt` and `captionAgentReminderPrompt` variables need to be loaded from the prompt files. Find where other agent prompts are loaded (likely in a `Promise.all` or init block) and add:

```typescript
const captionAgentSystemPrompt = await readFile(
  join(PROMPTS_DIR, 'caption-agent', 'system.md'), 'utf-8'
);
const captionAgentReminderPrompt = await readFile(
  join(PROMPTS_DIR, 'caption-agent', 'reminder.md'), 'utf-8'
);
```

- [ ] **Step 3: Verify registration compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: No errors related to caption_agent

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat: register caption_agent subagent in orchestrator"
```

---

### Task 7: Update orchestrator pipeline — Phase 2.5 + Phase 6.5

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md`

- [ ] **Step 1: Add Phase 2.5 between Trim Editor and Planner**

Find the section after Phase 2 (Trim Editor) and before Phase 3 (Planner). Add:

```markdown
### Phase 2.5: Captions → dispatch **Caption Agent** (parallel with Planner)

Report progress: `{ phase: "captions", message: "Creating captions..." }`

Dispatch Caption Agent AND Planner simultaneously:

```
// Dispatch both in parallel — they are independent
Agent(caption_agent, "Create captions for this video. Theme: {theme_slug}. Read /workspace/docs/transcript.json for word timestamps. Read /workspace/docs/guidelines/theme.md for design tokens. Read the manifest for timeline context (scene boundaries, video cuts).")
Agent(planner, "Plan scenes...")
```

The Caption Agent creates the caption track, all caption items with hero annotations, and sets the kinetic-luxe caption preset. It runs in parallel with the Planner — they don't depend on each other.

After both return:
1. Verify caption track exists in manifest
2. If Caption Agent failed (no caption track): call `generate_captions` as degraded fallback, set `captionPreset.displayMode = "phrase"`
3. Write phase marker: `echo "phase2.5-complete" > /workspace/.pipeline-phase`
```

- [ ] **Step 2: Add Phase 6.5 caption sync after Layout Editor**

Find the section after Phase 6 (Layout Editor) and before Phase 7 (Animators). Add:

```markdown
### Phase 6.5: Caption Sync (if needed)

After Layout Editor completes, check if any captions span scene boundaries.

Read the manifest. For each caption item, check if its time range crosses any scene boundary (where one scene's endMs meets the next scene's startMs).

If boundary conflicts exist: re-dispatch Caption Agent with sync instructions:
"Sync captions to scene boundaries. Split any captions that span these boundary timestamps: [list]. Do not regenerate — only split/trim existing captions. Preserve hero annotations."

If no conflicts: skip, proceed to Phase 7.
```

- [ ] **Step 3: Add Caption Agent to refinement table**

Find the refinement table and add these rows:

```markdown
| "fix captions" / "regenerate captions" | Re-dispatch **Caption Agent** (full regen) |
| "highlight X not Y" / "wrong word highlighted" | Re-dispatch **Caption Agent** (hero fix) |
| "captions out of sync" / "captions overlapping" | Re-dispatch **Caption Agent** (sync mode) |
| "make captions bigger/smaller" / "move captions" | Update captionPreset directly (no agent) |
```

- [ ] **Step 4: Add to translation table**

Find the "TRANSLATING USER LANGUAGE" section and add under "Scene & Animation Requests":

```markdown
| "the subtitles are wrong" / "captions broken" | Re-dispatch Caption Agent |
| "wrong word is big" / "highlighting wrong word" | Caption Agent hero fix |
| "caption text is cut off" | Caption Agent sync/repair |
| "I want different caption style" | Update captionPreset.displayMode |
```

- [ ] **Step 5: Update phase tracking for resume**

Find the phase tracking section and add:

```markdown
- `phase2-complete` → check if caption track exists in manifest. If yes, skip 2.5. If no, dispatch Caption Agent + Planner.
- `phase2.5-complete` → skip to Phase 4 (if phase3 also complete) or wait for Planner.
```

- [ ] **Step 6: Update subagent table**

Find the subagent table and add:

```markdown
| Caption Agent | caption_agent | 2.5 | Creates captions: phrase grouping, hero selection, placement, styling |
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat: orchestrator Phase 2.5 Caption Agent dispatch + Phase 6.5 sync"
```

---

### Task 8: Update Final Editor — remove caption creation

**Files:**
- Modify: `packages/sandbox/src/prompts/final-editor/system.md`

- [ ] **Step 1: Remove caption creation instructions**

Find any instructions about creating caption items, calling `generate_captions`, or restructuring captions. Replace with:

```markdown
## Captions
Captions are created by the Caption Agent (Phase 2.5). Do NOT create, regenerate, or restructure caption items. Do NOT call `generate_captions`.

Your only caption responsibility: verify caption items exist in the manifest. If they don't exist (Caption Agent failed), report this as an issue — do NOT attempt to create them yourself.

You MAY update the caption preset styling if the current preset doesn't match the theme (e.g., wrong font). Use `update_caption_preset` for styling changes only.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/final-editor/system.md
git commit -m "feat: Final Editor no longer creates captions — owned by Caption Agent"
```

---

### Task 9: Rebuild sandbox image

**Files:**
- All changes from Tasks 1-8

- [ ] **Step 1: Rebuild the sandbox Docker image**

```bash
docker compose build sandbox-build
```

This bakes in:
- Updated Zod schemas (hero field)
- syncCaptions guard
- Caption Agent prompts
- Updated orchestrator with Phase 2.5
- Updated Final Editor
- KineticLuxeCaption with word.hero support

- [ ] **Step 2: Verify image builds successfully**

Expected: Build completes with no errors. Image tagged as `viona-sandbox:latest`.

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: Caption Agent — full implementation with kinetic-luxe default"
```

---

### Task 10: End-to-end test with live project

- [ ] **Step 1: Create a new project or restart existing sandbox**

Stop and remove existing sandbox container to use the new image:
```bash
docker stop sandbox-<project-id> && docker rm sandbox-<project-id>
```
Navigate to the project in the browser to spawn a new container.

- [ ] **Step 2: Run the pipeline with the brief**

Use the test brief from the Algeria blackouts video. The orchestrator should:
1. Trim (Phase 2)
2. Dispatch Caption Agent + Planner in parallel (Phase 2.5 + 3)
3. Verify Caption Agent created captions with hero annotations
4. Continue through Layout (Phase 6) → Caption sync (Phase 6.5) → Animators → Final Editor

- [ ] **Step 3: Verify caption output**

Check the sandbox manifest:
```bash
docker exec sandbox-<id> //bin/sh -c 'node -e "
var m = JSON.parse(require(\"fs\").readFileSync(\"/workspace/manifest.json\",\"utf8\"));
var caps = m.items.filter(function(i) { return i.type === \"caption\"; });
console.log(\"Captions:\", caps.length);
caps.slice(0,3).forEach(function(c) {
  var words = c.data.words.map(function(w) { return (w.hero ? \"*\" : \"\") + w.text; }).join(\" \");
  console.log(c.startMs + \"-\" + c.endMs + \":\", words);
});
console.log(\"managedByAgent:\", m.captionPreset?.managedByAgent);
console.log(\"displayMode:\", m.captionPreset?.displayMode);
"'
```

Expected:
- Caption items with `hero: true/false` on each word
- `managedByAgent: true` on captionPreset
- `displayMode: "kinetic-luxe"`
- Natural phrase groupings (not mechanical 5-word splits)
- Hero words are contextually appropriate (numbers, key terms, action verbs)

- [ ] **Step 4: Verify rendering in browser**

Open the project in the editor. Play through and verify:
- Hero words render large italic serif
- Satellite words render small sans-serif uppercase
- Phrase timing matches speech
- No captions span scene boundaries
- Poke-aware alignment works (satellites avoid ascender/descender collisions)

- [ ] **Step 5: Test repair flow**

In the chat, type: "highlight extreme not measures"
Verify: Caption Agent re-dispatched, hero annotation updated, preview updates.

---

## Summary

| Task | What | Dependencies |
|------|------|-------------|
| 1 | Add `hero` to Zod schemas | None |
| 2 | Guard `syncCaptions()` | None |
| 3 | KineticLuxeCaption `word.hero` | Task 1 |
| 4 | Caption Agent system prompt | None |
| 5 | Caption Agent reminder prompt | None |
| 6 | Register in orchestrator | Tasks 4, 5 |
| 7 | Orchestrator pipeline (Phase 2.5 + 6.5) | Task 6 |
| 8 | Update Final Editor | None |
| 9 | Rebuild sandbox image | Tasks 1-8 |
| 10 | End-to-end test | Task 9 |

**Parallel groups:**
- Tasks 1, 2, 4, 5, 8 can run in parallel (no dependencies on each other)
- Task 3 depends on Task 1
- Task 6 depends on Tasks 4, 5
- Task 7 depends on Task 6
- Task 9 depends on all previous
- Task 10 depends on Task 9
