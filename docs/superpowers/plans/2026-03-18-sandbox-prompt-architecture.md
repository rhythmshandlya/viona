# Sandbox Prompt Architecture Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure sandbox from 4 overloaded agents to 5 focused agents with optimized prompts, deterministic tooling, and professional editing techniques. Reduce total prompt size by ~79%.

**Architecture:** 5 agents (Trim Editor, Planner, Visual Editor, Animator, QC Reviewer) with XML-structured prompts assembled from shared modules + agent system + few-shot examples + injected context + critical reminders. Deterministic MCP tools for transcript sync, analysis, and timeline validation.

**Tech Stack:** TypeScript, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), MCP tools, Remotion skills

**Spec:** `docs/superpowers/specs/2026-03-18-sandbox-prompt-architecture-design.md`

---

## Task 1: Create Shared Prompt Modules

**Files:**
- Create: `packages/sandbox/src/prompts/shared/identity.xml`
- Create: `packages/sandbox/src/prompts/shared/manifest-tools.xml`
- Create: `packages/sandbox/src/prompts/shared/quality-rules.xml`

These are the cacheable prefix loaded at the top of every agent prompt.

- [ ] **Step 1: Create `shared/identity.xml`**

Extract the shared Viona identity from current orchestrator prompt. Keep it under 200 words:

```xml
<identity>
You are part of the Viona video production pipeline. You operate inside a sandbox with full creative control over the workspace at /workspace.

Project context:
- Canvas: {{CANVAS_WIDTH}}x{{CANVAS_HEIGHT}} at {{FPS}}fps
- Duration: {{DURATION_MS}}ms
- Theme: {{THEME}}
- Content type: {{PROJECT_TYPE}}

Workspace layout:
- /workspace/manifest.json — the project manifest (read/write via MCP tools)
- /workspace/public/source.mp4 — source video (NEVER modified)
- /workspace/public/audio.mp3 — source audio (if separate)
- /workspace/public/assets/ — downloaded B-roll, stock images
- /workspace/docs/transcript.json — word-level transcript (always current, auto-synced after trims)
- /workspace/docs/transcript-original.json — raw transcript (never modified)
- /workspace/docs/SCENE_PLAN.md — scene plan with spatial layout
- /workspace/src/scenes/ — Remotion .tsx scene files
- /workspace/src/constants.ts — shared COLORS, TIMING, SPRING_CONFIG
- /workspace/src/components/Background.tsx — shared animated background
</identity>
```

- [ ] **Step 2: Create `shared/manifest-tools.xml`**

Extract the manifest/scene/render/asset tool tables from the current orchestrator prompt. Compact format:

```xml
<tools>
## Manifest Tools (mcp__manifest__*)
- read_manifest — Read timeline state. ALWAYS read before editing.
- read_item — Read a single item by ID.
- add_track — Add a new track (video, audio, overlay, caption).
- update_track — Update track properties.
- remove_track — Remove a track and all its items.
- add_item — Add a new item (video, audio, text, image, scene, caption, shape).
- update_item — Update item properties (deep-merges data, transform, filters; replaces keyframes).
- remove_item — Remove an item by ID.
- split_item — Split a video/audio item at a timestamp.
- update_caption_style — Update global caption styling.
- update_manifest — Batch update the manifest.

## Scene Tools (mcp__scenes__*)
- write_scene_file — Write a .tsx scene file.
- delete_scene_file — Delete a scene file.

## Render Tools (mcp__render__*)
- render_still — Render a still frame at a specific timestamp.
- trigger_rebuild — Trigger esbuild rebuild after code changes.

## Asset Tools (mcp__assets__*)
- download_file — Download a file from URL to workspace.
- search_unsplash / search_pexels — Search stock photos.
- download_stock_photo — Download stock photo to /workspace/public/assets/.
- get_speaker_grid — Get speaker thumbnail grid.

## Analysis Tools
- analyze_transcript — Deterministic filler/silence/retake detection. Returns structured analysis.
- validate_timeline — Programmatic manifest integrity check. Returns pass/fail with issues.
</tools>
```

- [ ] **Step 3: Create `shared/quality-rules.xml`**

The non-negotiable rules that apply to ALL agents. Under 150 words:

```xml
<quality_rules>
## Non-Negotiable Rules (ALL agents)
- ALWAYS read the manifest before making ANY edits. Never edit blind.
- Source video is NEVER modified. All edits are manifest operations.
- transcript.json is auto-synced after every manifest trim/split/remove. Trust it.
- Scene files use meaningful PascalCase names (HookTitle.tsx, NOT Scene1.tsx).
- Every interpolate() call MUST have BOTH extrapolateLeft: 'clamp' AND extrapolateRight: 'clamp'.
- Use useCurrentFrame() directly — NEVER subtract scene start (frames are 0-relative inside Sequence).
- Audio and video items from the same source are married — every split/trim/remove on one must be applied identically to the other.
- After writing or modifying .tsx files, call trigger_rebuild.
- Use render_still to verify visual changes.
</quality_rules>
```

- [ ] **Step 4: Verify shared modules load correctly**

Run: `node -e "import('./packages/sandbox/src/prompts/prompt-loader.js').then(m => m.loadSharedModules().then(console.log))"`

Verify all 3 files load and concatenate without errors.

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/shared/
git commit -m "feat(sandbox): add shared prompt modules (identity, tools, quality rules)"
```

---

## Task 2: Build New Prompt Loader

**Files:**
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts`

Replace the current loader with the new assembly-order system.

- [ ] **Step 1: Read the current prompt-loader.ts**

Read `packages/sandbox/src/prompts/prompt-loader.ts` to understand the existing interface.

- [ ] **Step 2: Rewrite prompt-loader.ts**

New loader assembles prompts in research-backed order: shared (top) → system → examples → context → critical reminder (bottom).

```typescript
// packages/sandbox/src/prompts/prompt-loader.ts
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROMPTS_DIR = process.env.NODE_ENV === 'production'
  ? '/app/dist/prompts'
  : join(__dirname);

// --- Shared modules (cacheable prefix) ---

const SHARED_FILES = ['identity.xml', 'manifest-tools.xml', 'quality-rules.xml'];

async function loadFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function loadSharedModules(): Promise<string> {
  const modules: string[] = [];
  for (const file of SHARED_FILES) {
    try {
      modules.push(await loadFile(join(PROMPTS_DIR, 'shared', file)));
    } catch {
      // Shared module not found — skip
    }
  }
  return modules.join('\n\n');
}

// --- Agent-specific loading ---

async function loadAgentSystem(agentName: string): Promise<string> {
  return loadFile(join(PROMPTS_DIR, agentName, 'system.md'));
}

async function loadExamples(agentName: string): Promise<string> {
  const examplesDir = join(PROMPTS_DIR, agentName, 'examples');
  try {
    const { readdir } = await import('fs/promises');
    const files = await readdir(examplesDir);
    const contents = await Promise.all(
      files.filter(f => f.endsWith('.md')).map(f => loadFile(join(examplesDir, f)))
    );
    return contents.join('\n\n');
  } catch {
    return ''; // No examples directory
  }
}

async function loadCriticalReminder(agentName: string): Promise<string> {
  try {
    return await loadFile(join(PROMPTS_DIR, agentName, 'reminder.md'));
  } catch {
    return ''; // No reminder file
  }
}

// --- Full assembly ---

export async function assembleAgentPrompt(agentName: string, ctx: PromptContext): Promise<string> {
  const [shared, system, examples, reminder] = await Promise.all([
    loadSharedModules(),
    loadAgentSystem(agentName),
    loadExamples(agentName),
    loadCriticalReminder(agentName),
  ]);

  const sections = [shared, system, examples].filter(Boolean);
  const assembled = sections.join('\n\n---\n\n');
  const injected = injectContext(assembled, ctx);

  if (reminder) {
    return injected + '\n\n---\n\n' + injectContext(reminder, ctx);
  }
  return injected;
}

// --- Context injection (kept from current) ---

export interface PromptContext {
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number | null;
  hasTranscript: boolean;
  theme?: string;
  projectType?: string;
  briefSummary?: string;
  hasHeadTracking?: boolean;
  totalScenes?: number;
  currentPhase?: string;
}

const STACKED_VISUAL_RATIO = 0.55;

export function injectContext(prompt: string, ctx: PromptContext): string {
  const stackedVisualHeight = Math.round(ctx.canvasHeight * STACKED_VISUAL_RATIO);
  return prompt
    .replaceAll('{{CANVAS_WIDTH}}', String(ctx.canvasWidth))
    .replaceAll('{{CANVAS_HEIGHT}}', String(ctx.canvasHeight))
    .replaceAll('{{STACKED_VISUAL_HEIGHT}}', String(stackedVisualHeight))
    .replaceAll('{{FPS}}', String(ctx.fps))
    .replaceAll('{{DURATION_MS}}', String(ctx.durationMs ?? 'unknown'))
    .replaceAll('{{THEME}}', ctx.theme ?? 'studio-dark')
    .replaceAll('{{PROJECT_TYPE}}', ctx.projectType ?? 'video')
    .replaceAll('{{BRIEF_SUMMARY}}', ctx.briefSummary ?? 'No brief provided')
    .replaceAll('{{HAS_HEAD_TRACKING}}', String(ctx.hasHeadTracking ?? false))
    .replaceAll('{{TOTAL_SCENES}}', String(ctx.totalScenes ?? 0))
    .replaceAll('{{CURRENT_PHASE}}', ctx.currentPhase ?? 'unknown');
}

// --- Legacy compat (remove after migration) ---

export async function loadPrompt(name: string): Promise<string> {
  return loadFile(join(PROMPTS_DIR, `${name}.md`));
}

export async function loadPromptWithShared(name: string): Promise<string> {
  const [shared, prompt] = await Promise.all([loadSharedModules(), loadPrompt(name)]);
  return `${shared}\n\n---\n\n${prompt}`;
}
```

- [ ] **Step 3: Verify the new loader compiles**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false`

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/prompt-loader.ts
git commit -m "feat(sandbox): new prompt loader with assembly-order pattern"
```

---

## Task 3: Build Deterministic MCP Tools

**Files:**
- Create: `packages/sandbox/src/tools/transcript-sync.ts`
- Create: `packages/sandbox/src/tools/transcript-analysis.ts`
- Create: `packages/sandbox/src/tools/timeline-validation.ts`
- Modify: `packages/sandbox/src/tools/manifest-ops.ts` (hook sync_transcript into trim/split/remove)

- [ ] **Step 1: Read current manifest-ops.ts to understand tool structure**

Read `packages/sandbox/src/tools/manifest-ops.ts` to understand how MCP tools are defined and registered.

- [ ] **Step 2: Create `transcript-sync.ts`**

Deterministic transcript sync — computes ripple shifts from manifest state and rewrites `transcript.json`:

```typescript
// packages/sandbox/src/tools/transcript-sync.ts
import { readFile, writeFile } from 'fs/promises';

interface Word {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

interface Transcript {
  words: Word[];
  segments: Array<{ text: string; startMs: number; endMs: number }>;
  language: string;
}

interface ManifestItem {
  id: string;
  type: string;
  startMs: number;
  endMs: number;
  data?: { startFrom?: number };
}

interface RippleShift {
  atMs: number;        // original timeline position
  deltaMs: number;     // negative = content removed, positive = content added
}

/**
 * Compute cumulative ripple shifts by comparing original transcript
 * word coverage against current manifest video/audio item coverage.
 */
function computeRippleShifts(
  originalWords: Word[],
  manifestItems: ManifestItem[],
): RippleShift[] {
  // Sort manifest items by startFrom (source offset) to map back to original timeline
  const videoItems = manifestItems
    .filter(i => i.type === 'video' || i.type === 'audio')
    .sort((a, b) => (a.data?.startFrom ?? 0) - (b.data?.startFrom ?? 0));

  const shifts: RippleShift[] = [];
  let cumulativeDelta = 0;

  for (const item of videoItems) {
    const sourceStart = item.data?.startFrom ?? 0;
    const sourceDuration = item.endMs - item.startMs;
    const sourceEnd = sourceStart + sourceDuration;

    // The timeline position this item occupies vs where it was in original
    const expectedTimelineStart = sourceStart + cumulativeDelta;
    const actualTimelineStart = item.startMs;
    const newDelta = actualTimelineStart - expectedTimelineStart;

    if (Math.abs(newDelta) > 10) { // ignore sub-10ms jitter
      cumulativeDelta += newDelta;
      shifts.push({ atMs: sourceStart, deltaMs: cumulativeDelta });
    }
  }

  return shifts;
}

function applyShifts(originalMs: number, shifts: RippleShift[]): number {
  let delta = 0;
  for (const shift of shifts) {
    if (originalMs >= shift.atMs) {
      delta = shift.deltaMs;
    }
  }
  return originalMs + delta;
}

function isWordRemoved(word: Word, manifestItems: ManifestItem[]): boolean {
  // A word is removed if no video/audio item covers its original time range
  const videoItems = manifestItems.filter(i => i.type === 'video' || i.type === 'audio');
  const wordMid = (word.startMs + word.endMs) / 2;

  return !videoItems.some(item => {
    const sourceStart = item.data?.startFrom ?? 0;
    const sourceEnd = sourceStart + (item.endMs - item.startMs);
    return wordMid >= sourceStart && wordMid <= sourceEnd;
  });
}

/**
 * Sync transcript.json with current manifest state.
 * Called automatically after manifest trim/split/remove operations.
 * Reads manifest from disk — no parameters needed.
 */
export async function syncTranscript(): Promise<void> {
  const raw = await readFile('/workspace/docs/transcript-original.json', 'utf-8');
  const original: Transcript = JSON.parse(raw);

  const manifestRaw = await readFile('/workspace/manifest.json', 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  const manifestItems: ManifestItem[] = manifest.items ?? [];

  const shifts = computeRippleShifts(original.words, manifestItems);

  const syncedWords = original.words
    .filter(w => !isWordRemoved(w, manifestItems))
    .map(w => ({
      ...w,
      startMs: Math.max(0, applyShifts(w.startMs, shifts)),
      endMs: Math.max(0, applyShifts(w.endMs, shifts)),
    }));

  const syncedSegments = original.segments
    .map(seg => ({
      ...seg,
      startMs: Math.max(0, applyShifts(seg.startMs, shifts)),
      endMs: Math.max(0, applyShifts(seg.endMs, shifts)),
    }))
    .filter(seg => seg.endMs > seg.startMs);

  const synced: Transcript = {
    words: syncedWords,
    segments: syncedSegments,
    language: original.language,
  };

  await writeFile('/workspace/docs/transcript.json', JSON.stringify(synced, null, 2));
}
```

Note: The actual ripple shift computation will need refinement based on how manifest items track source offsets. This is the structural pattern — exact implementation depends on manifest item schema. Read `manifest-ops.ts` for the real data shapes.

- [ ] **Step 3: Create `transcript-analysis.ts`**

Deterministic filler/silence/retake detection:

```typescript
// packages/sandbox/src/tools/transcript-analysis.ts

interface Word {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

interface Transcript {
  words: Word[];
  segments: Segment[];
  language: string;
}

// Tier 1 fillers — always safe to cut
const TIER_1_FILLERS = new Set(['um', 'uh', 'er', 'ah', 'hmm', 'mmm', 'erm', 'uhm']);

// Tier 2 fillers — context-dependent
const TIER_2_FILLERS = new Set(['you know', 'i mean', 'like', 'so', 'basically', 'actually', 'literally', 'sort of', 'kind of']);

interface FillerDetection {
  wordIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  tier: 1 | 2;
}

interface SilenceDetection {
  startMs: number;
  endMs: number;
  durationMs: number;
  tier: 1 | 3; // 1 = >2000ms (remove), 3 = 750-2000ms (shorten)
}

interface RetakeDetection {
  segmentAIndex: number;
  segmentBIndex: number;
  overlapRatio: number;
}

interface FalseStartDetection {
  segmentIndex: number;
  wordCount: number;
}

export interface TranscriptAnalysis {
  fillers: FillerDetection[];
  silences: SilenceDetection[];
  retakes: RetakeDetection[];
  falseStarts: FalseStartDetection[];
  contentType: 'tutorial' | 'podcast' | 'interview' | 'vlog' | 'presentation' | 'keynote';
  stats: {
    totalWords: number;
    totalDurationMs: number;
    fillerCount: number;
    silenceCount: number;
    estimatedTrimMs: number;
  };
}

function detectFillers(words: Word[]): FillerDetection[] {
  const fillers: FillerDetection[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i].text.toLowerCase().replace(/[.,!?]/g, '');

    // Tier 1: exact match
    if (TIER_1_FILLERS.has(w) && words[i].endMs - words[i].startMs >= 150) {
      fillers.push({ wordIndex: i, text: w, startMs: words[i].startMs, endMs: words[i].endMs, tier: 1 });
      continue;
    }

    // Tier 2: bigrams
    if (i < words.length - 1) {
      const bigram = `${w} ${words[i + 1].text.toLowerCase().replace(/[.,!?]/g, '')}`;
      if (TIER_2_FILLERS.has(bigram)) {
        fillers.push({
          wordIndex: i,
          text: bigram,
          startMs: words[i].startMs,
          endMs: words[i + 1].endMs,
          tier: 2,
        });
      }
    }
  }

  return fillers;
}

function detectSilences(words: Word[]): SilenceDetection[] {
  const silences: SilenceDetection[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].startMs - words[i].endMs;

    if (gap > 2000) {
      silences.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, durationMs: gap, tier: 1 });
    } else if (gap >= 750) {
      silences.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, durationMs: gap, tier: 3 });
    }
  }

  return silences;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
}

function detectRetakes(segments: Segment[]): RetakeDetection[] {
  const retakes: RetakeDetection[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const tokensA = tokenize(segments[i].text);
    const tokensB = tokenize(segments[i + 1].text);
    if (tokensA.length < 3 || tokensB.length < 3) continue;

    const setA = new Set(tokensA);
    const overlap = tokensB.filter(t => setA.has(t)).length;
    const ratio = overlap / Math.min(tokensA.length, tokensB.length);

    if (ratio > 0.7) {
      retakes.push({ segmentAIndex: i, segmentBIndex: i + 1, overlapRatio: ratio });
    }
  }

  return retakes;
}

function detectFalseStarts(segments: Segment[]): FalseStartDetection[] {
  const starts: FalseStartDetection[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const tokens = tokenize(segments[i].text);
    const hasTerminal = /[.!?]$/.test(segments[i].text.trim());

    if (tokens.length < 5 && !hasTerminal) {
      starts.push({ segmentIndex: i, wordCount: tokens.length });
    }
  }

  return starts;
}

function detectContentType(segments: Segment[]): TranscriptAnalysis['contentType'] {
  const fullText = segments.map(s => s.text).join(' ').toLowerCase();

  // Simple heuristic detection
  const hasMultipleSpeakers = /\b(interviewer|host|guest|speaker [0-9])\b/.test(fullText);
  const hasQuestionAnswer = (fullText.match(/\?/g) || []).length > segments.length * 0.3;
  const hasInstructional = /\b(step [0-9]|first|then|next|finally|how to|tutorial)\b/.test(fullText);
  const hasPresentation = /\b(slide|next slide|as you can see|chart|graph)\b/.test(fullText);

  if (hasPresentation) return 'presentation';
  if (hasMultipleSpeakers && hasQuestionAnswer) return 'interview';
  if (hasMultipleSpeakers) return 'podcast';
  if (hasInstructional) return 'tutorial';
  return 'vlog';
}

export function analyzeTranscript(transcript: Transcript): TranscriptAnalysis {
  const fillers = detectFillers(transcript.words);
  const silences = detectSilences(transcript.words);
  const retakes = detectRetakes(transcript.segments);
  const falseStarts = detectFalseStarts(transcript.segments);
  const contentType = detectContentType(transcript.segments);

  const estimatedTrimMs =
    fillers.reduce((sum, f) => sum + (f.endMs - f.startMs), 0) +
    silences.filter(s => s.tier === 1).reduce((sum, s) => sum + s.durationMs - 400, 0) +
    silences.filter(s => s.tier === 3).reduce((sum, s) => sum + s.durationMs - 450, 0);

  const totalDurationMs = transcript.words.length > 0
    ? transcript.words[transcript.words.length - 1].endMs
    : 0;

  return {
    fillers,
    silences,
    retakes,
    falseStarts,
    contentType,
    stats: {
      totalWords: transcript.words.length,
      totalDurationMs,
      fillerCount: fillers.length,
      silenceCount: silences.length,
      estimatedTrimMs,
    },
  };
}
```

- [ ] **Step 4: Create `timeline-validation.ts`**

Programmatic manifest integrity check (zero tokens):

```typescript
// packages/sandbox/src/tools/timeline-validation.ts
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface ValidationIssue {
  severity: 'error' | 'warning';
  track?: string;
  itemId?: string;
  message: string;
}

interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}

export async function validateTimeline(): Promise<ValidationResult> {
  const raw = await readFile('/workspace/manifest.json', 'utf-8');
  const manifest = JSON.parse(raw);
  const issues: ValidationIssue[] = [];

  // Check each track for overlaps and gaps
  for (const track of manifest.tracks ?? []) {
    const items = (manifest.items ?? [])
      .filter((i: any) => i.trackId === track.id)
      .sort((a: any, b: any) => a.startMs - b.startMs);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // No negative timestamps
      if (item.startMs < 0) {
        issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Negative startMs: ${item.startMs}` });
      }

      // startMs < endMs
      if (item.startMs >= item.endMs) {
        issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `startMs (${item.startMs}) >= endMs (${item.endMs})` });
      }

      // Check overlaps with next item on same track
      if (i < items.length - 1) {
        const next = items[i + 1];
        if (item.endMs > next.startMs) {
          issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Overlaps with ${next.id}: ${item.endMs} > ${next.startMs}` });
        }
      }

      // Scene file exists
      if (item.type === 'scene' && item.data?.sceneFile) {
        const scenePath = `/workspace/src/scenes/${item.data.sceneFile}.tsx`;
        if (!existsSync(scenePath)) {
          issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Scene file not found: ${scenePath}` });
        }
      }

      // Valid startFrom for video/audio
      if ((item.type === 'video' || item.type === 'audio') && item.data?.startFrom != null) {
        if (item.data.startFrom < 0) {
          issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Negative startFrom: ${item.data.startFrom}` });
        }
      }

      // Transition duration check
      if (item.data?.enter?.durationMs != null) {
        const d = item.data.enter.durationMs;
        if (d < 0 || d > 1000) {
          issues.push({ severity: 'warning', track: track.name, itemId: item.id, message: `Enter transition duration out of range: ${d}ms` });
        }
      }
      if (item.data?.exit?.durationMs != null) {
        const d = item.data.exit.durationMs;
        if (d < 0 || d > 1000) {
          issues.push({ severity: 'warning', track: track.name, itemId: item.id, message: `Exit transition duration out of range: ${d}ms` });
        }
      }
    }
  }

  // durationMs matches last item
  const allItems = manifest.items ?? [];
  if (allItems.length > 0) {
    const maxEndMs = Math.max(...allItems.map((i: any) => i.endMs));
    if (manifest.durationMs && Math.abs(manifest.durationMs - maxEndMs) > 100) {
      issues.push({ severity: 'warning', message: `manifest.durationMs (${manifest.durationMs}) doesn't match last item extent (${maxEndMs})` });
    }
  }

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}
```

- [ ] **Step 5: Hook sync_transcript into manifest-ops.ts**

Read `manifest-ops.ts`, find the `split_item`, `remove_item`, and `update_item` tool handlers. After each operation that changes timing, call `syncTranscript()`.

The exact integration depends on the manifest-ops structure — read first, then add the hook.

- [ ] **Step 6: Register new MCP tools in `mcp-servers.ts`**

Add `analyze_transcript` and `validate_timeline` as MCP tools in `packages/sandbox/src/mcp-servers.ts`. Create a new `analysis` MCP server using `createSdkMcpServer` (same pattern as `manifestServer`, `scenesServer`, etc.). Register two tools using `wrapTool()`:

```typescript
// In createMcpServers():
const analysisServer = createSdkMcpServer({
  name: 'analysis',
  tools: [wrapTool(analyzeTranscriptTool), wrapTool(validateTimelineTool)],
});

// Return it alongside existing servers:
return { manifest: manifestServer, scenes: scenesServer, render: renderServer, widgets: widgetServer, analysis: analysisServer };
```

Create tool wrappers in transcript-analysis.ts and timeline-validation.ts that match the `{ name, description, input_schema, execute }` shape used by existing tools (see `allManifestTools` in manifest-ops.ts for reference).

- [ ] **Step 7: Verify tools compile**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false`

- [ ] **Step 8: Commit**

```bash
git add packages/sandbox/src/tools/transcript-sync.ts packages/sandbox/src/tools/transcript-analysis.ts packages/sandbox/src/tools/timeline-validation.ts packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat(sandbox): add deterministic tools (sync_transcript, analyzeTranscript, validate_timeline)"
```

---

## Task 4: Write Trim Editor Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/trim-editor/system.md`
- Create: `packages/sandbox/src/prompts/trim-editor/examples/good-trim.md`
- Create: `packages/sandbox/src/prompts/trim-editor/reminder.md`

- [ ] **Step 1: Write `trim-editor/system.md`**

Under 500 words. XML structure. Incorporates professional techniques (radio cut, J-cuts, L-cuts, zoom punch-ins, pacing oscillation):

```markdown
<role>
You are a precision audio-first editor. You handle Phase 2 of the Viona pipeline: transcript trimming, jump cut coverage, pacing refinement, and caption generation. You think like a radio editor — content and rhythm first, visuals second.
</role>

<rules>
## Core Rules
- Process ALL trims in REVERSE chronological order (latest first). Earlier timestamps stay valid.
- Audio and video from the same source are MARRIED. Every split/trim/remove on one, apply identically to the other.
- transcript.json updates automatically after every trim — you never manually recalculate timestamps.
- Replace removed segments with 100-200ms gaps, not hard cuts. Preserve natural speech rhythm.
- Never cut pauses under 300ms — these are natural speech rhythm.
- Never cut "like" used as comparison, "so" used as conjunction, "actually" used as correction.

## Trim Tiers
- **Tier 1 (always remove):** "um", "uh", "er", "ah", "hmm" + dead air >2s + false starts + retakes
- **Tier 2 (context-dependent):** "you know", "i mean", "like" (as filler), "basically", "sort of" — only when removing preserves grammar
- **Tier 3 (shorten, don't delete):** Silences 750-2000ms → compress to 400-500ms

## Professional Techniques
- **Radio cut:** Edit for audio flow first. Does the speech sound natural with this cut? Listen mentally before cutting.
- **Jump cut coverage:** After trimming, every visible edit point needs coverage. Add 3-8% zoom punch-in at each cut point using split_item + crop transform.
- **J-cuts:** At section transitions, start the incoming audio 200-400ms before the video cut. Pulls the viewer forward.
- **L-cuts:** When transitioning to B-roll, let the outgoing speaker audio continue 300-500ms under the new visual. Smooths the transition.
- **Pacing:** Cut on energy peaks, not sentence endings. Vary cut lengths. Alternate calm (10-20s) and burst (5-10 quick cuts) sections.
</rules>

<task>
## Your Workflow

1. Read the `analyze_transcript` tool output provided by the orchestrator — it has pre-detected fillers, silences, retakes, and false starts.
2. Read the manifest to understand current timeline state.
3. Plan your trims (Tier 1 first, then Tier 2, then Tier 3). Write the plan to `/workspace/docs/trim-report.md`.
4. Apply trims in REVERSE chronological order via manifest tools (split_item, remove_item, update_item).
5. After trims: add zoom punch-ins at edit points (3-8% crop, split video at trim boundaries).
6. Apply J-cuts at natural section breaks.
7. Generate captions from the post-trim transcript on a dedicated caption track.
8. Verify: read manifest, confirm no gaps, no overlaps, no negative timestamps.
</task>
```

- [ ] **Step 2: Write `trim-editor/examples/good-trim.md`**

One concrete before/after example showing the reasoning chain:

```markdown
<example>
## Trim Decision Example

**Raw transcript segment (12400ms - 18200ms):**
"So, um, the thing is, you know, when you actually look at the data, um, it's basically showing us that, that growth has been, uh, really significant."

**Analysis (from analyze_transcript tool):**
- Filler: "um" at 12800-13000ms (Tier 1)
- Filler: "you know" at 13200-13550ms (Tier 2 — filler at phrase boundary, safe to cut)
- Filler: "um" at 15100-15300ms (Tier 1)
- Filler: "basically" at 15500-15750ms (Tier 2 — adds zero meaning, safe to cut)
- False start: "that, that" at 16000-16400ms (keep second "that" only)
- Filler: "uh" at 16900-17050ms (Tier 1)

**Trim plan (reverse chronological):**
1. Remove "uh" at 16900-17050ms → 150ms gap
2. Remove first "that," at 16000-16200ms → 100ms gap
3. Remove "basically" at 15500-15750ms → 150ms gap
4. Remove "um" at 15100-15300ms → 150ms gap
5. Remove "you know" at 13200-13550ms → 150ms gap
6. Remove "um" at 12800-13000ms → 150ms gap

**Result:**
"So, the thing is, when you actually look at the data, it's showing us that growth has been really significant."
Removed: 1350ms of filler. Natural rhythm preserved with 150ms gaps.

**Post-trim:** Apply 5% zoom punch-in at each edit point to cover jump cuts.
</example>
```

- [ ] **Step 3: Write `trim-editor/reminder.md`**

```markdown
<critical_reminder>
REVERSE chronological order for ALL trims. Edit BOTH audio and video (married items). Never cut pauses under 300ms. After trims, add zoom punch-ins at edit points. transcript.json syncs automatically.
</critical_reminder>
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/trim-editor/
git commit -m "feat(sandbox): add Trim Editor prompt (system + example + reminder)"
```

---

## Task 5: Write Planner Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/planner/system.md`
- Create: `packages/sandbox/src/prompts/planner/examples/good-plan.md`
- Create: `packages/sandbox/src/prompts/planner/reminder.md`

- [ ] **Step 1: Write `planner/system.md`**

Slimmed from 45KB to ~5-6KB. Core creative direction + spatial layout. Visual technique catalog moves to skills.

```markdown
<role>
You are a senior creative director planning visual stories for the Viona platform. You produce one file: `/workspace/docs/SCENE_PLAN.md` — the complete creative plan with spatial layout specs, sync points, and energy arc.

This file is the contract between all agents. It must contain enough detail that each agent can do its job without guessing.
</role>

<rules>
## Planning Process
1. Read `/workspace/docs/transcript.json` (always current — post-trim timestamps)
2. Read head tracking data at `/workspace/docs/speaker-grid.json` (if available)
3. Read theme files at `/workspace/docs/themes/`
4. Use `render_still` to check speaker position at representative moments
5. Perform 4-pass transcript analysis (content → story arc → sync points → visual continuity)
6. Write `/workspace/docs/SCENE_PLAN.md`

## Scene Rules
- Every scene has a display mode: stacked (default), overlay, or fullscreen
- Every scene has exact coordinates: {x, y, width, height} in canvas pixels
- Scene file dimensions MUST match their display mode canvas
- No scene exceeds 450 frames. If content runs longer, SPLIT it.
- Minimum scene duration: 210 frames (120 for videos under 20s)
- Visual change every 3 seconds (90 frames) — this is the rhythm of engagement
- Speaker visible in at least 60% of total duration (varies by content type)
- Hook (Scene 1): speaker visible, motion from frame 0, NEVER fullscreen

## Display Modes
- **stacked**: Animation in top 55% ({{CANVAS_WIDTH}}x{{STACKED_VISUAL_HEIGHT}}), speaker in bottom 45%
- **overlay**: Speaker fullscreen, content in safe zones only (top 0-15%, lower-third 58-85%). Face zone 15-58% is OFF-LIMITS.
- **fullscreen**: Animation fills entire canvas, speaker hidden. Use sparingly — max 15 consecutive seconds.

## Energy Arc
Map each scene to energy 1-5. No two adjacent scenes at same energy level.
- Hook: energy 4-5
- At least one energy dip (1-2) before final peak
- Alternate calm explanation (10-20s) with quick visual bursts

## Pacing Variety
Never repeat the same treatment 3+ times in a row. Vary display modes across scenes.
At least 60% of scenes should be type "animation" with rich motion graphics.

## Cross-Scene Anchoring
Each scene specifies `buildsFrom` (what carries in from previous) and `connectsTo` (what carries to next). Be SPECIFIC: "the overflowing container" not "previous visual continues".
</rules>

<task>
Read the transcript and available data. Perform 4-pass analysis. Write SCENE_PLAN.md with:
1. Transcript analysis summary
2. Scene-by-scene breakdown (display mode, coordinates, visual description, sync points, energy level)
3. Cross-scene anchoring
4. Self-verification table
</task>
```

- [ ] **Step 2: Write `planner/examples/good-plan.md`**

One concrete SCENE_PLAN.md excerpt showing the expected output format. Extract and adapt from the existing planner prompt's examples section.

- [ ] **Step 3: Write `planner/reminder.md`**

```markdown
<critical_reminder>
Every scene MUST have: display mode, exact {x,y,width,height} coordinates, sync points (max 90 frames apart), energy level (1-5, no adjacent duplicates). Scene file dimensions match display mode canvas. Speaker visible 60%+ of total duration. transcript.json has CURRENT post-trim timestamps — trust them.
</critical_reminder>
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner/
git commit -m "feat(sandbox): add slimmed Planner prompt (system + example + reminder)"
```

---

## Task 6: Write Visual Editor Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/visual-editor/system.md`
- Create: `packages/sandbox/src/prompts/visual-editor/examples/good-rough-cut.md`
- Create: `packages/sandbox/src/prompts/visual-editor/reminder.md`

- [ ] **Step 1: Write `visual-editor/system.md`**

Covers Phase 4 (rough cut) and Phase 7 (final assembly). Under 500 words:

```markdown
<role>
You are a visual editor for the Viona platform. You handle two phases:
- **Phase 4 (Rough Cut):** Split video at scene boundaries, apply zoom crops, place B-roll with L-cuts, create mockup placeholders for animations.
- **Phase 7 (Final Assembly):** Replace mockups with real scene files, add transitions, apply caption styling, final quality pass.

You read workspace state to know which phase to execute.
</role>

<rules>
## Always
- Read the manifest BEFORE any edits.
- Read SCENE_PLAN.md for scene boundaries, display modes, and coordinates.
- Process zoom cuts in REVERSE chronological order.

## Phase 4: Rough Cut
1. Read manifest + SCENE_PLAN.md
2. Split video at scene boundaries. Set transforms (position, size) per plan coordinates.
3. Apply zoom crops where specified.
4. Place B-roll on overlay track with L-cuts (speaker audio continues 300-500ms under B-roll).
5. Create colored rectangle mockups for animation slots (shape items with sceneFile + displayMode in data).
6. Add text overlays where specified.
7. Verify with render_still at key timestamps.

## Phase 7: Final Assembly
1. Read manifest. Find mockup shape items by data.sceneFile.
2. Replace each mockup with a scene item (same timing, same track).
3. Set transitions: crossfade 300ms default. Vary by energy: slide-left/zoom 200ms (high energy), fade 400ms (emotional shift).
4. First scene: enter fade 300ms. Last scene: exit fade 300ms.
5. Verify captions exist. If not, generate from post-trim transcript.
6. Render 2-3 stills to verify composition.

## Mockup Format
Shape items with type "rect", theme color at 20% opacity, sceneFile and displayMode in data. The Editor in Phase 7 matches these to real scenes.

## Transition Types
crossfade, fade, slide-left, slide-up, zoom, morph, cut. Duration 200-500ms.
</rules>

<task>
The orchestrator tells you which phase to execute. Read the workspace to understand current state, then execute that phase.
</task>
```

- [ ] **Step 2: Write example and reminder files**

Follow same pattern as Trim Editor.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/visual-editor/
git commit -m "feat(sandbox): add Visual Editor prompt (system + example + reminder)"
```

---

## Task 7: Write QC Reviewer Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/qc-reviewer/system.md`
- Create: `packages/sandbox/src/prompts/qc-reviewer/examples/good-review.md`
- Create: `packages/sandbox/src/prompts/qc-reviewer/reminder.md`

- [ ] **Step 1: Write `qc-reviewer/system.md`**

Expanded from current 10KB to cover both per-scene review AND full-timeline QC:

```markdown
<role>
You are an independent quality gate for the Viona pipeline. You review scenes as they complete (per-scene review) and verify the full assembled timeline after Phase 7 (full QC pass).

You do NOT fix anything. Your job is diagnosis, not surgery. Failed verdicts route back to the responsible agent.
</role>

<rules>
## Per-Scene Review (dispatched per scene during Phase 5/6)
1. Read the scene plan from SCENE_PLAN.md for this scene's brief
2. Read the scene source .tsx file
3. Render a still at the key sync frame via render_still
4. Code review: check for unclamped interpolate, frame subtraction bugs, missing overflow hidden, display mode violations
5. Visual review: canvas fill, element count (3+ distinct elements), font readability, background quality
6. Submit verdict via submit_verdict

## Full Timeline QC (dispatched after Phase 7)
1. Call `validate_timeline` tool — programmatic check for gaps, overlaps, missing scene files, invalid timestamps
2. Render stills at: first scene boundary, mid-video, last scene boundary (3 stills max)
3. Check: no flash frames, speaker visible in stacked/overlay, captions readable, transitions smooth
4. Code review: read 2-3 scene .tsx files, check for common bugs

## Verdict Rules
- **FAIL on:** unclamped interpolate (any instance), frame subtraction bug, blank frame at key sync, display mode violation (content in face zone), fewer than 3 visual elements
- **PASS on:** minor spacing, slightly off-center, color shade difference, spring config polish
- Max 2 retries per scene. After 2 failures, accept with warning.
</rules>

<task>
The orchestrator dispatches you for either per-scene review or full-timeline QC. Check your dispatch prompt to determine which.
</task>
```

- [ ] **Step 2: Write example and reminder files**

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/qc-reviewer/
git commit -m "feat(sandbox): add QC Reviewer prompt (system + example + reminder)"
```

---

## Task 8: Write Slim Orchestrator Prompt

**Files:**
- Create: `packages/sandbox/src/prompts/orchestrator/system.md` (new location)
- Archive: `packages/sandbox/src/prompts/orchestrator-system.md` (old 41.6KB file)

- [ ] **Step 1: Write `orchestrator/system.md`**

~10-15KB. Personality, phase flow, dispatch rules, widget/progress mechanics. NO tool tables (those are in shared modules). NO detailed phase instructions (each agent owns those).

Key sections:
1. Personality (from current — warm, direct, no filler)
2. Streaming behavior (from current — zero text before tool calls, one sentence before subagent dispatch)
3. 8-phase pipeline (SLIM version — just phase name, what agent to dispatch, what to pass)
4. Dispatch rules (5 agents, when to use each)
5. Widget usage (scene_plan, choice, theme_picker, progress, plan reporting)
6. Content type detection (from current)
7. Refinement routing table (from current Phase 8)

- [ ] **Step 2: Verify it stays under 15KB**

Run: `wc -c packages/sandbox/src/prompts/orchestrator/system.md`

Target: under 15,000 bytes.

- [ ] **Step 3: Archive old prompt files**

Rename old prompt files so they're preserved but not loaded:

```bash
mv packages/sandbox/src/prompts/orchestrator-system.md packages/sandbox/src/prompts/orchestrator-system.md.old
mv packages/sandbox/src/prompts/editor-system.md packages/sandbox/src/prompts/editor-system.md.old
mv packages/sandbox/src/prompts/planner-system.md packages/sandbox/src/prompts/planner-system.md.old
mv packages/sandbox/src/prompts/animator-system.md packages/sandbox/src/prompts/animator-system.md.old
mv packages/sandbox/src/prompts/reviewer-system.md packages/sandbox/src/prompts/reviewer-system.md.old
```

Also add `*.md.old` to `.gitignore` if desired, or delete outright after verifying the new prompts work end-to-end (Task 13).

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/ packages/sandbox/src/prompts/*.md.old
git commit -m "feat(sandbox): add slim orchestrator prompt (~12KB, down from 41.6KB), archive old prompts"
```

---

## Task 9: Update prompt-assembly.ts (Animator Per-Scene)

**Files:**
- Modify: `packages/sandbox/src/prompt-assembly.ts`

The Animator gets NO base system prompt. `prompt-assembly.ts` is the ONLY prompt source. Expand it to include the essential coding rules that were in the 64KB animator-system.md.

- [ ] **Step 1: Read current prompt-assembly.ts**

Already read earlier. It builds: theme + layout rules + scene brief + self-healing.

- [ ] **Step 2: Add essential coding rules to the assembly**

Add a compact `CODING_RULES` section (~200 words) covering the non-negotiable Remotion rules:

```typescript
const CODING_RULES = `
<rules>
## Remotion Coding Rules (NON-NEGOTIABLE)
- Use \`useCurrentFrame()\` directly. NEVER subtract scene start — frames are 0-relative inside Sequence.
- EVERY \`interpolate()\` call MUST have BOTH \`extrapolateLeft: 'clamp'\` AND \`extrapolateRight: 'clamp'\`.
- Use \`spring()\` for entrances/exits. Minimum damping: 18. Import SPRINGS from constants.ts.
- Stagger elements by 6+ frames minimum. NEVER animate all at once.
- Root container: \`overflow: 'hidden'\`.
- All sizes relative to effective width/height (EW/EH). No hardcoded pixels.
- No \`Math.sin()\`/\`Math.cos()\` on text positions (causes jitter).
- No CSS \`animation\` property — use Remotion \`interpolate\`/\`spring\`.
- Scene files: \`export default\` for the component.
- Import from \`../constants\` and \`../components/Background\`.
- After writing, verify: \`npx tsc --noEmit\`, then \`trigger_rebuild\`, then \`render_still\` at key sync frame.
</rules>
`;
```

- [ ] **Step 3: Update the assembly function**

Insert `CODING_RULES` and a `CRITICAL_REMINDER` at the bottom:

```typescript
export async function buildAnimatorPrompt(config: SceneConfig): Promise<string> {
  const themeContent = await loadThemeContent(config.theme);

  const sections = [
    `<role>You are a motion graphics engineer. Write one Remotion .tsx scene file based on the brief below. You decide HOW to animate — techniques, spring physics, choreography.</role>`,
    '',
    CODING_RULES,
    '',
    themeContent,
    '',
    LAYOUT_RULES,
    '',
    formatSceneBrief(config),
    '',
    SELF_HEALING_RULES,
    '',
    `<critical_reminder>`,
    `EVERY interpolate() needs extrapolateLeft:'clamp' AND extrapolateRight:'clamp'. Use useCurrentFrame() directly — NEVER subtract scene start. Stagger by 6+ frames. overflow:'hidden' on root.`,
    `</critical_reminder>`,
  ];

  return sections.join('\n');
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompt-assembly.ts
git commit -m "feat(sandbox): expand prompt-assembly.ts as sole Animator prompt source"
```

---

## Task 10: Update orchestrator.ts

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

Wire up the 5-agent config, new prompt loader, and new tools.

- [ ] **Step 1: Update imports**

Add imports for `assembleAgentPrompt` from the new prompt loader, and the new tool registrations.

- [ ] **Step 2: Update `buildOrchestratorOptions`**

Replace the 4-agent config with 5-agent config per the spec. Use `assembleAgentPrompt()` for each agent instead of `loadPrompt()`/`loadPromptWithShared()`.

Key changes:
- `planner` → uses `assembleAgentPrompt('planner', ctx)`
- `editor` → REMOVED, replaced by `trim_editor` and `visual_editor`
- `animator` → uses `buildAnimatorPrompt()` from prompt-assembly.ts (no change in how it's called, but no base prompt prepended)
- `reviewer` → renamed to `qc_reviewer`, uses `assembleAgentPrompt('qc-reviewer', ctx)`
- Add `skills` field to each agent definition

- [ ] **Step 3: Update `SUBAGENT_LABELS`**

```typescript
const SUBAGENT_LABELS: Record<string, string> = {
  planner: 'Planner',
  trim_editor: 'Trim Editor',
  visual_editor: 'Visual Editor',
  animator: 'Animator',
  qc_reviewer: 'QC Reviewer',
};
```

- [ ] **Step 4: Verify compilation**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false`

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): wire up 5-agent config with new prompt loader"
```

---

## Task 11: Update Workspace CLAUDE.md

**Files:**
- Modify: `packages/sandbox/template/.claude/CLAUDE.md`

Strip to file structure + import conventions only.

- [ ] **Step 1: Rewrite CLAUDE.md**

```markdown
## File Structure
```
src/
  scenes/         # Individual scene .tsx files (default export)
  components/     # Shared components (Background.tsx)
  constants.ts    # COLORS, TIMING, SPRING_CONFIG
```

## Import Pattern
```tsx
import { COLORS, SPRING_CONFIG } from '../constants';
import { Background } from '../components/Background';
```

## Scene Export Convention
Scene files use `export default` for the component.
Example: `const MyScene: React.FC = () => { ... }; export default MyScene;`
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/template/.claude/CLAUDE.md
git commit -m "refactor(sandbox): strip CLAUDE.md to file structure + imports only"
```

---

## Task 12: Preserve Original Transcript at Ingest

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts`

- [ ] **Step 1: Read workspace-init.ts**

Understand where `transcript.json` is written during workspace initialization.

- [ ] **Step 2: Add copy to transcript-original.json**

After writing `transcript.json`, copy it to `transcript-original.json`:

```typescript
// After writing transcript.json
await copyFile(
  '/workspace/docs/transcript.json',
  '/workspace/docs/transcript-original.json'
);
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat(sandbox): preserve transcript-original.json at ingest"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Verify all prompts load correctly**

Write a quick test script at `scripts/temp/test-prompt-loader.ts` that calls `assembleAgentPrompt()` for each agent and logs the byte sizes:

```typescript
import { assembleAgentPrompt, type PromptContext } from '../../packages/sandbox/src/prompts/prompt-loader.js';

const ctx: PromptContext = {
  canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000,
  hasTranscript: true, theme: 'studio-dark', projectType: 'tutorial',
};

for (const agent of ['trim-editor', 'planner', 'visual-editor', 'qc-reviewer']) {
  const prompt = await assembleAgentPrompt(agent, ctx);
  console.log(`${agent}: ${(prompt.length / 1024).toFixed(1)} KB`);
}
```

Verify all agents load under their budget (shared ~2KB + system ~4KB + example ~2KB + reminder ~0.5KB = ~8.5KB per agent).

- [ ] **Step 2: Verify deterministic tools work**

Test `analyzeTranscript()` with a sample transcript. Test `validateTimeline()` with a sample manifest. Test `syncTranscript()` with a manifest that has splits.

- [ ] **Step 3: Verify orchestrator builds correctly**

Call `buildOrchestratorOptions()` with a test context and verify all 5 agents are present with their prompts and skill lists.

- [ ] **Step 4: Commit test scripts**

```bash
git add scripts/temp/
git commit -m "test(sandbox): add prompt architecture verification scripts"
```

---

## Summary

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1 | Shared prompt modules | Small |
| 2 | New prompt loader | Medium |
| 3 | Deterministic MCP tools | Large |
| 4 | Trim Editor prompt | Medium |
| 5 | Planner prompt | Medium |
| 6 | Visual Editor prompt | Medium |
| 7 | QC Reviewer prompt | Medium |
| 8 | Slim orchestrator prompt | Large |
| 9 | Animator prompt-assembly.ts | Small |
| 10 | orchestrator.ts wiring | Medium |
| 11 | Strip CLAUDE.md | Small |
| 12 | Preserve original transcript | Small |
| 13 | End-to-end verification | Medium |
