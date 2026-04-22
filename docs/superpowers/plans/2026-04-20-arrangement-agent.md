# Arrangement Agent + Pipeline Chat Bubbles Implementation Plan (PR-A2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After ingestion completes, a transcript-driven arrangement agent (Claude Opus via Agent SDK) produces a first-pass timeline from the user's create-time prompt + project assets + transcripts, persists it as real `tracks` + `timelineItems` rows, and surfaces progress to the chat via `pipeline`-role messages.

**Architecture:** The agent receives a forward-compatible `ArrangementInput` (nullable sockets for future analyses), returns an `ArrangementOutput` via a single `finalize_arrangement` tool call, and the orchestrator persists the output into the existing relational timeline schema. Pipeline events (`transcribing`, `transcribed`, `analyzing`, `arranging`, `arranged`) are inserted as `conversation_messages` with `role: 'pipeline'` so the existing chat SSE stream delivers them to the frontend unchanged. `analyzing` events are gated behind `ANALYSIS_WORKERS` (off now) for PR-C flag-flip later.

**Tech Stack:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, model `opus`), Drizzle ORM (Postgres), Fastify, BullMQ (Redis), MinIO, Vitest, TypeScript, Zod.

**Spec reference:** `docs/superpowers/specs/2026-04-19-asset-system-research.md` — §6.8 Phase 2, §7.1a (ArrangementInput/Output), §7.2 PR-A.

**Depends on:** PR-A1 (landed: `assets`, `asset_project_links`, `asset_events` tables; `transcriptAssetId` linkage; asset-events SSE; feature-flag pattern).

---

## File Structure

**Create:**
- `packages/api/src/agent/arrangement-types.ts` — `ArrangementInput` / `ArrangementOutput` + Zod schemas
- `packages/api/src/agent/arrangement-prompt.ts` — system prompt + tool definition for the agent
- `packages/api/src/agent/arrangement-agent.ts` — Claude SDK invocation returning `ArrangementOutput`
- `packages/api/src/services/transcript-fetch.ts` — reads a transcript's JSON from MinIO given `transcriptAssetId`
- `packages/api/src/services/arrangement-input-builder.ts` — gathers prompt + linked assets + transcripts from DB
- `packages/api/src/services/arrangement-persister.ts` — writes `ArrangementOutput` to `tracks` + `timelineItems`
- `packages/api/src/services/arrangement-orchestrator.ts` — glue: build input → agent → persist → pipeline events → assistant summary
- `packages/api/src/services/pipeline-messages.ts` — `insertPipelineMessage(conversationId, eventType, details)` + SSE Redis publish
- `packages/api/src/routes/arrangement.ts` — `POST /projects/:id/arrangement/compute`
- `packages/api/src/__tests__/*.test.ts` — colocated per module

**Modify:**
- `packages/api/src/config.ts` — add `featureFlags.analysisWorkers`
- `packages/api/src/services/queue.ts` — add `arrangementQueue` + `queueArrangementJob`
- `packages/api/src/services/asset-events.ts` — re-export the pipeline event-type union for worker consumers
- `packages/api/src/index.ts` — register arrangement route behind `ASSET_SYSTEM_V2`
- `packages/worker/src/processors/transcribe.ts` — emit `transcribing`/`transcribed` pipeline messages in asset mode
- `packages/worker/src/processors/asset-metadata.ts` — on completion, check if all project assets have transcripts ready; enqueue arrangement if so
- `packages/worker/src/processors/arrangement.ts` (NEW) — BullMQ consumer delegating to orchestrator
- `packages/worker/src/index.ts` — register the arrangement worker

**Won't touch:**
- Existing `agent-router.ts` conversational chat flow — unchanged
- `projectAssets` legacy path — unchanged
- Frontend — all rendering of pipeline bubbles + timeline updates lives in PR-C

---

## Conventions

- Model: `opus` (per user memory; applies to both agent calls and implementer subagents).
- Test file location: colocated `.test.ts` alongside source. All mocks match the `.js` import convention used by the repo (`vi.mock('../db/index.js', ...)`).
- Auth: use `request.user!.id` on routes (PR-A1 established this).
- Pipeline event types: `'transcribing' | 'transcribed' | 'analyzing' | 'analyzed' | 'arranging' | 'arranged' | 'ready'` (`ready` = "your edit is ready" capstone).
- All commits on `dev`, no `--no-verify`, no amending.

---

## Task 1: Feature flag `ANALYSIS_WORKERS`

**Files:**
- Modify: `packages/api/src/config.ts`
- Modify: `packages/api/src/config.test.ts`

- [ ] **Step 1: Extend test**

Append to `packages/api/src/config.test.ts`:
```ts
it('exposes analysisWorkers as a boolean, default false', () => {
  expect(typeof config.featureFlags.analysisWorkers).toBe('boolean');
  expect(config.featureFlags.analysisWorkers).toBe(process.env.ANALYSIS_WORKERS === 'true');
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/config.test.ts`
Expected: FAIL — `analysisWorkers` not on featureFlags.

- [ ] **Step 3: Add the flag**

In `packages/api/src/config.ts`, extend the `featureFlags` nested object:
```ts
featureFlags: {
  assetSystemV2: process.env.ASSET_SYSTEM_V2 === 'true',
  analysisWorkers: process.env.ANALYSIS_WORKERS === 'true',
},
```

- [ ] **Step 4: Run test, expect GREEN**

Run: `cd packages/api && pnpm test -- src/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/config.ts packages/api/src/config.test.ts
git commit -m "feat(api): add ANALYSIS_WORKERS feature flag (gates analyzing pipeline bubbles)"
```

---

## Task 2: Pipeline message helper

**Files:**
- Create: `packages/api/src/services/pipeline-messages.ts`
- Create: `packages/api/src/services/pipeline-messages.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/api/src/services/pipeline-messages.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMessageSpy = vi.fn();
const publishSpy = vi.fn();

vi.mock('../agent/conversation-store.js', () => ({
  addMessage: (...a: unknown[]) => addMessageSpy(...a),
}));
vi.mock('./redis.js', () => ({
  redis: { publish: (...a: unknown[]) => publishSpy(...a) },
}));

import { insertPipelineMessage } from './pipeline-messages.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('insertPipelineMessage', () => {
  it('inserts a pipeline-role message with eventType + details in content', async () => {
    addMessageSpy.mockResolvedValueOnce({ id: 'm-1', conversationId: 'c-1', role: 'pipeline' });
    const result = await insertPipelineMessage({
      conversationId: 'c-1',
      projectId: 'p-1',
      eventType: 'transcribing',
      details: { assetId: 'a-1', filename: 'intro.mp4' },
    });
    expect(result.id).toBe('m-1');
    expect(addMessageSpy).toHaveBeenCalledWith('c-1', 'pipeline', expect.arrayContaining([
      expect.objectContaining({ type: 'pipeline_event', eventType: 'transcribing', details: { assetId: 'a-1', filename: 'intro.mp4' } }),
    ]));
  });

  it('publishes the message to conversation SSE channel', async () => {
    addMessageSpy.mockResolvedValueOnce({ id: 'm-2', conversationId: 'c-1', role: 'pipeline', content: [] });
    await insertPipelineMessage({
      conversationId: 'c-1', projectId: 'p-1', eventType: 'arranging', details: {},
    });
    expect(publishSpy).toHaveBeenCalledWith('conversation:p-1', expect.stringContaining('"eventType":"arranging"'));
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/services/pipeline-messages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `packages/api/src/services/pipeline-messages.ts`:

```ts
import { addMessage } from '../agent/conversation-store.js';
import { redis } from './redis.js';

export type PipelineEventType =
  | 'transcribing'
  | 'transcribed'
  | 'analyzing'
  | 'analyzed'
  | 'arranging'
  | 'arranged'
  | 'ready';

export interface PipelineMessageInput {
  conversationId: string;
  projectId: string;
  eventType: PipelineEventType;
  details: Record<string, unknown>;
}

export interface PipelineMessageRow {
  id: string;
  conversationId: string;
  role: string;
  content: unknown;
}

export async function insertPipelineMessage(input: PipelineMessageInput): Promise<PipelineMessageRow> {
  const content = [{
    type: 'pipeline_event' as const,
    eventType: input.eventType,
    details: input.details,
    ts: new Date().toISOString(),
  }];

  const row = await addMessage(input.conversationId, 'pipeline', content);

  const envelope = JSON.stringify({
    kind: 'pipeline_message',
    messageId: row.id,
    conversationId: row.conversationId,
    eventType: input.eventType,
    details: input.details,
  });
  await redis.publish(`conversation:${input.projectId}`, envelope);

  return row as PipelineMessageRow;
}
```

- [ ] **Step 4: Run test, expect GREEN**

Run: `cd packages/api && pnpm test -- src/services/pipeline-messages.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/pipeline-messages.ts packages/api/src/services/pipeline-messages.test.ts
git commit -m "feat(api): pipeline message helper — inserts role='pipeline' + SSE fanout"
```

---

## Task 3: Arrangement types + Zod schema

**Files:**
- Create: `packages/api/src/agent/arrangement-types.ts`
- Create: `packages/api/src/agent/arrangement-types.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/api/src/agent/arrangement-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { arrangementOutputSchema, type ArrangementInput, type ArrangementOutput } from './arrangement-types.js';

describe('arrangement types', () => {
  it('validates a well-formed ArrangementOutput', () => {
    const output: ArrangementOutput = {
      timelineItems: [
        { assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 },
        { assetId: 'a-2', trackIndex: 0, startMs: 3000, durationMs: 4000, sourceStartMs: 500, sourceDurationMs: 4000 },
      ],
      summary: 'Opened with the hook shot, then the product demo.',
    };
    const parsed = arrangementOutputSchema.parse(output);
    expect(parsed.timelineItems).toHaveLength(2);
  });

  it('rejects negative durations', () => {
    expect(() => arrangementOutputSchema.parse({
      timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: -100 }],
      summary: 's',
    })).toThrow();
  });

  it('accepts an empty ArrangementInput with required fields only', () => {
    const input: ArrangementInput = {
      prompt: 'Make it punchy',
      assets: [{ id: 'a-1', filename: 'x.mp4', mimeType: 'video/mp4' }],
      transcripts: [],
    };
    expect(input.visualAnalyses).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/agent/arrangement-types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the types module**

Create `packages/api/src/agent/arrangement-types.ts`:

```ts
import { z } from 'zod';

export interface ArrangementInput {
  prompt: string;
  assets: {
    id: string;
    filename: string;
    mimeType: string;
    durationMs?: number;
    userIntent?: string;
    userDescription?: string;
  }[];
  transcripts: {
    assetId: string;
    text: string;
    segments: { startMs: number; endMs: number; text: string }[];
  }[];

  // Forward-compatible sockets — empty now, populated by future workers.
  // The prompt template references them conditionally so the agent starts
  // using them the moment they're non-null, no interface change.
  visualAnalyses?: { assetId: string; embedding?: number[]; labels?: string[] }[];
  sceneBoundaries?: { assetId: string; cuts: number[] }[];
  speakerDiarization?: {
    assetId: string;
    segments: { speakerId: string; startMs: number; endMs: number }[];
  }[];
  highlights?: { assetId: string; scores: { startMs: number; endMs: number; score: number }[] }[];
  autoDescriptions?: { assetId: string; description: string }[];
}

export const arrangementOutputSchema = z.object({
  timelineItems: z.array(z.object({
    assetId: z.string().min(1),
    trackIndex: z.number().int().nonnegative(),
    startMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    sourceStartMs: z.number().int().nonnegative().optional(),
    sourceDurationMs: z.number().int().positive().optional(),
  })).min(0),
  summary: z.string().min(1),
});

export type ArrangementOutput = z.infer<typeof arrangementOutputSchema>;
```

- [ ] **Step 4: Run test, expect GREEN**

Run: `cd packages/api && pnpm test -- src/agent/arrangement-types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/agent/arrangement-types.ts packages/api/src/agent/arrangement-types.test.ts
git commit -m "feat(api): ArrangementInput/Output types + Zod schema with forward-compatible sockets"
```

---

## Task 4: Transcript fetcher (MinIO → JSON)

**Files:**
- Create: `packages/api/src/services/transcript-fetch.ts`
- Create: `packages/api/src/services/transcript-fetch.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getObjectSpy = vi.fn();

vi.mock('./minio.js', () => ({
  minioClient: { getObject: (...a: unknown[]) => getObjectSpy(...a) },
  config: { storage: { bucket: 'viona' } },  // no-op, real config shimmed below
}));

// Also mock ../config since minio pulls it
vi.mock('../config.js', () => ({
  config: { storage: { bucket: 'viona' } },
}));

import { Readable } from 'node:stream';
import { fetchTranscriptJson } from './transcript-fetch.js';

beforeEach(() => { vi.clearAllMocks(); });

function streamFrom(obj: unknown): Readable {
  const s = new Readable();
  s._read = () => {};
  s.push(JSON.stringify(obj));
  s.push(null);
  return s;
}

describe('fetchTranscriptJson', () => {
  it('returns parsed transcript with text + segments', async () => {
    getObjectSpy.mockResolvedValueOnce(streamFrom({
      text: 'hello world',
      segments: [{ start: 0, end: 1, text: 'hello world' }],
    }));
    const out = await fetchTranscriptJson('users/u/derived/a/transcript.json');
    expect(out.text).toBe('hello world');
    expect(out.segments).toHaveLength(1);
  });

  it('throws if MinIO rejects', async () => {
    getObjectSpy.mockRejectedValueOnce(new Error('no such key'));
    await expect(fetchTranscriptJson('bad/key')).rejects.toThrow('no such key');
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/services/transcript-fetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the fetcher**

Create `packages/api/src/services/transcript-fetch.ts`:

```ts
import { minioClient } from './minio.js';
import { config } from '../config.js';

export interface TranscriptJson {
  text: string;
  segments?: { start?: number; end?: number; startMs?: number; endMs?: number; text: string }[];
  words?: { start?: number; end?: number; word: string }[];
  language?: string;
}

export async function fetchTranscriptJson(storageKey: string): Promise<TranscriptJson> {
  const stream = await minioClient.getObject(config.storage.bucket, storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text) as TranscriptJson;
}
```

Note: the `config` import path may need adjustment if `minio.ts` does not re-export it. Inspect `packages/api/src/services/minio.ts` and match its actual exports.

- [ ] **Step 4: Run test, expect GREEN**

Run: `cd packages/api && pnpm test -- src/services/transcript-fetch.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/transcript-fetch.ts packages/api/src/services/transcript-fetch.test.ts
git commit -m "feat(api): transcript-fetch — reads transcript JSON from MinIO by storage key"
```

---

## Task 5: Arrangement input builder

**Files:**
- Create: `packages/api/src/services/arrangement-input-builder.ts`
- Create: `packages/api/src/services/arrangement-input-builder.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listProjectAssetsSpy = vi.fn();
const selectWhereSpy = vi.fn();
const selectWhereReturn = vi.fn();
const fetchTranscriptSpy = vi.fn();
const getConversationMessagesSpy = vi.fn();
const getOrCreateConversationSpy = vi.fn();

vi.mock('./asset-link-service.js', () => ({
  listProjectAssets: (...a: unknown[]) => listProjectAssetsSpy(...a),
}));
vi.mock('./transcript-fetch.js', () => ({
  fetchTranscriptJson: (...a: unknown[]) => fetchTranscriptSpy(...a),
}));
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...a: unknown[]) => { selectWhereSpy(...a); return Promise.resolve(selectWhereReturn()); },
      })),
    })),
  },
}));
vi.mock('../agent/conversation-store.js', () => ({
  getOrCreateConversation: (...a: unknown[]) => getOrCreateConversationSpy(...a),
  getConversationMessages: (...a: unknown[]) => getConversationMessagesSpy(...a),
}));

import { buildArrangementInput } from './arrangement-input-builder.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('buildArrangementInput', () => {
  it('collects prompt from first user message + assets + transcripts for assets with transcriptAssetId', async () => {
    getOrCreateConversationSpy.mockResolvedValueOnce({ id: 'c-1' });
    getConversationMessagesSpy.mockResolvedValueOnce([
      { id: 'm-1', role: 'user', content: [{ type: 'text', text: 'make it punchy' }] },
    ]);
    listProjectAssetsSpy.mockResolvedValueOnce([
      { id: 'a-1', filename: 'intro.mp4', mimeType: 'video/mp4', durationMs: 5000, userIntent: 'hook', userDescription: null, transcriptAssetId: 't-1' },
      { id: 'a-2', filename: 'logo.png', mimeType: 'image/png', durationMs: null, userIntent: null, userDescription: null, transcriptAssetId: null },
    ]);
    selectWhereReturn.mockReturnValueOnce([{ id: 't-1', storageKey: 'users/u/derived/a-1/transcript.json' }]);
    fetchTranscriptSpy.mockResolvedValueOnce({
      text: 'hello world',
      segments: [{ start: 0, end: 1, text: 'hello world' }],
    });

    const input = await buildArrangementInput('p-1');

    expect(input.prompt).toBe('make it punchy');
    expect(input.assets).toHaveLength(2);
    expect(input.assets[0]).toMatchObject({ id: 'a-1', filename: 'intro.mp4', durationMs: 5000, userIntent: 'hook' });
    expect(input.transcripts).toHaveLength(1);
    expect(input.transcripts[0].assetId).toBe('a-1');
    expect(input.transcripts[0].text).toBe('hello world');
    expect(input.transcripts[0].segments[0]).toMatchObject({ startMs: 0, endMs: 1000, text: 'hello world' });
  });

  it('returns empty prompt if conversation has no user messages', async () => {
    getOrCreateConversationSpy.mockResolvedValueOnce({ id: 'c-1' });
    getConversationMessagesSpy.mockResolvedValueOnce([]);
    listProjectAssetsSpy.mockResolvedValueOnce([]);
    const input = await buildArrangementInput('p-1');
    expect(input.prompt).toBe('');
    expect(input.transcripts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/services/arrangement-input-builder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the builder**

Create `packages/api/src/services/arrangement-input-builder.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { listProjectAssets } from './asset-link-service.js';
import { fetchTranscriptJson, type TranscriptJson } from './transcript-fetch.js';
import { getOrCreateConversation, getConversationMessages } from '../agent/conversation-store.js';
import type { ArrangementInput } from '../agent/arrangement-types.js';

/**
 * Gathers everything the arrangement agent needs for a project:
 * - The create-time prompt (first `user` message in the conversation)
 * - All linked assets with their minimal identifying metadata
 * - Transcripts for assets that have a transcriptAssetId
 *
 * Forward-compatible sockets (visualAnalyses, sceneBoundaries, etc.) are
 * populated only if their workers have run; for now they're always undefined.
 */
export async function buildArrangementInput(projectId: string): Promise<ArrangementInput> {
  const convo = await getOrCreateConversation(projectId);
  const messages = await getConversationMessages(convo.id);
  const firstUserMsg = messages.find((m) => m.role === 'user');
  const prompt = extractPromptText(firstUserMsg?.content) ?? '';

  const rows = await listProjectAssets(projectId);

  const assetSummaries: ArrangementInput['assets'] = rows.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    durationMs: a.durationMs ?? undefined,
    userIntent: a.userIntent ?? undefined,
    userDescription: a.userDescription ?? undefined,
  }));

  const transcriptAssetIds = rows
    .map((a) => a.transcriptAssetId)
    .filter((id): id is string => !!id);

  let derivedRows: { id: string; storageKey: string; parentAssetIds: string[] | null }[] = [];
  if (transcriptAssetIds.length > 0) {
    derivedRows = await db.select({
      id: assets.id,
      storageKey: assets.storageKey,
      parentAssetIds: assets.parentAssetIds,
    }).from(assets).where(inArray(assets.id, transcriptAssetIds));
  }

  const transcripts: ArrangementInput['transcripts'] = [];
  for (const derived of derivedRows) {
    try {
      const json = await fetchTranscriptJson(derived.storageKey);
      const parent = rows.find((a) => a.transcriptAssetId === derived.id);
      if (!parent) continue;
      transcripts.push({
        assetId: parent.id,
        text: json.text,
        segments: normalizeSegments(json.segments),
      });
    } catch {
      // Missing or unreadable transcript: skip; agent will arrange without it.
      continue;
    }
  }

  return { prompt, assets: assetSummaries, transcripts };
}

function extractPromptText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
      const text = (block as { text?: string }).text;
      if (text) return text;
    }
  }
  return null;
}

function normalizeSegments(segments?: TranscriptJson['segments']): ArrangementInput['transcripts'][number]['segments'] {
  if (!segments) return [];
  return segments.map((s) => {
    const startMs = s.startMs ?? (typeof s.start === 'number' ? Math.round(s.start * 1000) : 0);
    const endMs = s.endMs ?? (typeof s.end === 'number' ? Math.round(s.end * 1000) : startMs);
    return { startMs, endMs, text: s.text ?? '' };
  });
}
```

- [ ] **Step 4: Run test, expect GREEN**

Run: `cd packages/api && pnpm test -- src/services/arrangement-input-builder.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/arrangement-input-builder.ts packages/api/src/services/arrangement-input-builder.test.ts
git commit -m "feat(api): arrangement-input-builder — gather prompt + assets + transcripts from DB/MinIO"
```

---

## Task 6: Arrangement prompt template + tool definition

**Files:**
- Create: `packages/api/src/agent/arrangement-prompt.ts`
- Create: `packages/api/src/agent/arrangement-prompt.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildArrangementSystemPrompt, FINALIZE_ARRANGEMENT_TOOL } from './arrangement-prompt.js';

describe('buildArrangementSystemPrompt', () => {
  it('embeds prompt, assets with durations, transcripts, and conditional socket notes', () => {
    const sys = buildArrangementSystemPrompt({
      prompt: 'fun vibe',
      assets: [{ id: 'a-1', filename: 'i.mp4', mimeType: 'video/mp4', durationMs: 5000 }],
      transcripts: [{ assetId: 'a-1', text: 'hi there', segments: [] }],
    });
    expect(sys).toContain('fun vibe');
    expect(sys).toContain('a-1');
    expect(sys).toContain('i.mp4');
    expect(sys).toContain('hi there');
    // Absent analysis sockets: should NOT reference them as available
    expect(sys).not.toContain('visualAnalyses available');
  });

  it('turns on the visual-analysis clause when the socket is populated', () => {
    const sys = buildArrangementSystemPrompt({
      prompt: 'x', assets: [], transcripts: [],
      visualAnalyses: [{ assetId: 'a-1', labels: ['cat'] }],
    });
    expect(sys).toContain('visualAnalyses available');
  });
});

describe('FINALIZE_ARRANGEMENT_TOOL', () => {
  it('declares a JSON-schema tool with timelineItems and summary', () => {
    expect(FINALIZE_ARRANGEMENT_TOOL.name).toBe('finalize_arrangement');
    const schema = FINALIZE_ARRANGEMENT_TOOL.input_schema;
    expect(schema.properties.timelineItems).toBeDefined();
    expect(schema.properties.summary).toBeDefined();
    expect(schema.required).toEqual(expect.arrayContaining(['timelineItems', 'summary']));
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/agent/arrangement-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the prompt module**

Create `packages/api/src/agent/arrangement-prompt.ts`:

```ts
import type { ArrangementInput } from './arrangement-types.js';

export const FINALIZE_ARRANGEMENT_TOOL = {
  name: 'finalize_arrangement',
  description:
    'Commit the final timeline arrangement for this project. Call this exactly once at the end. ' +
    'timelineItems must be chronological per track (no overlaps within a track); tracks are indexed from 0. ' +
    'Each item references an asset by its id from the input list.',
  input_schema: {
    type: 'object' as const,
    properties: {
      timelineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            trackIndex: { type: 'integer', minimum: 0 },
            startMs: { type: 'integer', minimum: 0 },
            durationMs: { type: 'integer', minimum: 1 },
            sourceStartMs: { type: 'integer', minimum: 0 },
            sourceDurationMs: { type: 'integer', minimum: 1 },
          },
          required: ['assetId', 'trackIndex', 'startMs', 'durationMs'],
        },
      },
      summary: {
        type: 'string',
        description: 'A short (1-3 sentence) human-readable explanation of the arrangement.',
      },
    },
    required: ['timelineItems', 'summary'],
  },
} as const;

export function buildArrangementSystemPrompt(input: ArrangementInput): string {
  const lines: string[] = [];
  lines.push(
    'You are the Arrangement Agent for an AI-first video editor. Your job: take the user\'s prompt,',
    'the uploaded assets, and any analysis signals, and produce a first-pass timeline arrangement.',
    '',
    'Output by calling the `finalize_arrangement` tool EXACTLY ONCE. Do not explain in text; all reasoning',
    'happens internally; only the tool call is read.',
    '',
    '### User prompt',
    input.prompt || '(empty — infer a reasonable short-form edit from the assets)',
    '',
    '### Assets',
  );
  for (const a of input.assets) {
    const dur = a.durationMs != null ? ` (${Math.round(a.durationMs / 1000)}s)` : '';
    const intent = a.userIntent ? ` [intent: ${a.userIntent}]` : '';
    const desc = a.userDescription ? ` [desc: ${a.userDescription}]` : '';
    lines.push(`- ${a.id} :: ${a.filename} (${a.mimeType})${dur}${intent}${desc}`);
  }

  if (input.transcripts.length > 0) {
    lines.push('', '### Transcripts');
    for (const t of input.transcripts) {
      lines.push(`- ${t.assetId}: "${truncate(t.text, 400)}"`);
      if (t.segments.length) {
        lines.push(`  (${t.segments.length} segments)`);
      }
    }
  }

  if (input.visualAnalyses && input.visualAnalyses.length > 0) {
    lines.push('', '### Visual analyses (visualAnalyses available)');
    for (const v of input.visualAnalyses) {
      lines.push(`- ${v.assetId}: labels=${(v.labels ?? []).join(',')}`);
    }
  }
  if (input.sceneBoundaries && input.sceneBoundaries.length > 0) {
    lines.push('', '### Scene boundaries (sceneBoundaries available)');
    for (const s of input.sceneBoundaries) {
      lines.push(`- ${s.assetId}: cuts at ms ${s.cuts.join(',')}`);
    }
  }
  if (input.speakerDiarization && input.speakerDiarization.length > 0) {
    lines.push('', '### Speaker diarization (speakerDiarization available)');
  }
  if (input.highlights && input.highlights.length > 0) {
    lines.push('', '### Highlight scores (highlights available)');
  }
  if (input.autoDescriptions && input.autoDescriptions.length > 0) {
    lines.push('', '### Auto descriptions (autoDescriptions available)');
    for (const d of input.autoDescriptions) {
      lines.push(`- ${d.assetId}: ${truncate(d.description, 200)}`);
    }
  }

  lines.push(
    '',
    '### Rules',
    '- Only reference assetIds present in the asset list.',
    '- Items on the same track must not overlap (startMs + durationMs of item N <= startMs of item N+1).',
    '- Prefer track 0 for the primary visual, track 1 for overlays/b-roll.',
    '- If transcripts exist, use them to decide ordering and trim points (sourceStartMs / sourceDurationMs).',
    '- If visualAnalyses, sceneBoundaries, speakerDiarization, highlights, or autoDescriptions are present, use them.',
    '  (They are optional; absent today but may be populated in future runs.)',
    '- Keep the arrangement short — 15s–90s total is a good default for a first pass.',
  );

  return lines.join('\n');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
```

- [ ] **Step 4: Run test, expect GREEN**

Run: `cd packages/api && pnpm test -- src/agent/arrangement-prompt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/agent/arrangement-prompt.ts packages/api/src/agent/arrangement-prompt.test.ts
git commit -m "feat(api): arrangement agent prompt + finalize_arrangement tool schema"
```

---

## Task 7: Arrangement agent invoker (Claude SDK)

**Files:**
- Create: `packages/api/src/agent/arrangement-agent.ts`
- Create: `packages/api/src/agent/arrangement-agent.test.ts`

The invoker calls `query` from `@anthropic-ai/claude-agent-sdk`, passes the system prompt, and expects exactly one `finalize_arrangement` tool call in the output. It validates the tool input with Zod and returns `ArrangementOutput`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const querySpy = vi.fn();

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...a: unknown[]) => querySpy(...a),
}));

import { runArrangementAgent } from './arrangement-agent.js';

beforeEach(() => { vi.clearAllMocks(); });

/** Build an async iterable that yields the given messages in order. */
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const x of items) yield x;
    },
  };
}

describe('runArrangementAgent', () => {
  it('parses the finalize_arrangement tool call and returns ArrangementOutput', async () => {
    querySpy.mockReturnValueOnce(asyncIter([
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'finalize_arrangement', input: {
              timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 }],
              summary: 'Opening on the hook.',
            }},
          ],
        },
      },
    ]));

    const out = await runArrangementAgent({
      prompt: 'punchy', assets: [{ id: 'a-1', filename: 'x.mp4', mimeType: 'video/mp4' }],
      transcripts: [],
    });

    expect(out.timelineItems).toHaveLength(1);
    expect(out.summary).toBe('Opening on the hook.');
  });

  it('throws if no finalize_arrangement tool call is produced', async () => {
    querySpy.mockReturnValueOnce(asyncIter([
      { type: 'assistant', message: { content: [{ type: 'text', text: 'I refuse.' }] } },
    ]));
    await expect(runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] }))
      .rejects.toThrow(/finalize_arrangement/);
  });

  it('throws if tool input fails Zod validation', async () => {
    querySpy.mockReturnValueOnce(asyncIter([
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'finalize_arrangement', input: {
          timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: -1, durationMs: 3000 }],
          summary: 's',
        }}] },
      },
    ]));
    await expect(runArrangementAgent({ prompt: 'x', assets: [], transcripts: [] })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/agent/arrangement-agent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the invoker**

Create `packages/api/src/agent/arrangement-agent.ts`:

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { arrangementOutputSchema, type ArrangementInput, type ArrangementOutput } from './arrangement-types.js';
import { buildArrangementSystemPrompt, FINALIZE_ARRANGEMENT_TOOL } from './arrangement-prompt.js';

/**
 * Runs the arrangement agent. Expects exactly one `finalize_arrangement` tool
 * call in the output. Returns the validated ArrangementOutput.
 *
 * @remarks
 * The agent is best-effort: if it refuses or malforms the call, we throw and
 * the orchestrator surfaces a `failed` pipeline event so the user can retry.
 */
export async function runArrangementAgent(input: ArrangementInput): Promise<ArrangementOutput> {
  const systemPrompt = buildArrangementSystemPrompt(input);
  const iter = query({
    model: 'opus',
    systemPrompt,
    tools: [FINALIZE_ARRANGEMENT_TOOL],
    // Single turn, no tool-result loop — the agent is expected to emit the tool and stop.
    // The SDK's default is single-turn unless tool_use is replied; absent a tool result,
    // the stream terminates after the first assistant message.
    prompt: 'Produce the arrangement now by calling finalize_arrangement.',
  } as Parameters<typeof query>[0]);

  let toolInput: unknown = null;
  for await (const msg of iter) {
    if ((msg as { type?: string }).type !== 'assistant') continue;
    const content = (msg as { message?: { content?: unknown[] } }).message?.content ?? [];
    for (const block of content) {
      if (
        block && typeof block === 'object' &&
        (block as { type?: string }).type === 'tool_use' &&
        (block as { name?: string }).name === 'finalize_arrangement'
      ) {
        toolInput = (block as { input?: unknown }).input;
        break;
      }
    }
    if (toolInput !== null) break;
  }

  if (toolInput === null) {
    throw new Error('arrangement agent did not emit a finalize_arrangement tool call');
  }

  return arrangementOutputSchema.parse(toolInput);
}
```

Note: the exact `query()` options shape depends on the installed `@anthropic-ai/claude-agent-sdk` version. Inspect the existing usage in `packages/sandbox/src/orchestrator.ts` and match the caller-supplied options that fit. The test above mocks the module wholesale so this is self-contained; the integration will be smoke-tested in Task 12.

- [ ] **Step 4: Run tests, expect GREEN**

Run: `cd packages/api && pnpm test -- src/agent/arrangement-agent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/agent/arrangement-agent.ts packages/api/src/agent/arrangement-agent.test.ts
git commit -m "feat(api): arrangement agent — Claude SDK with finalize_arrangement tool + Zod validation"
```

---

## Task 8: Arrangement persister (writes to tracks + timelineItems)

**Files:**
- Create: `packages/api/src/services/arrangement-persister.ts`
- Create: `packages/api/src/services/arrangement-persister.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackInsertValues = vi.fn();
const trackInsertReturning = vi.fn();
const itemInsertValues = vi.fn();
const itemInsertReturning = vi.fn();
const selectWhereReturn = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => selectWhereReturn()),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (arg: unknown) => {
        if ((table as { _ident?: string })._ident === 'tracks' || String(table).includes('tracks')) {
          trackInsertValues(arg);
          return { returning: () => trackInsertReturning() };
        }
        itemInsertValues(arg);
        return { returning: () => itemInsertReturning() };
      },
    })),
  },
}));

import { persistArrangement } from './arrangement-persister.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('persistArrangement', () => {
  it('creates tracks for each unique trackIndex then inserts items', async () => {
    // No pre-existing tracks for this project.
    selectWhereReturn.mockReturnValue([]);
    trackInsertReturning.mockResolvedValueOnce([{ id: 't-0', position: 0 }]);
    trackInsertReturning.mockResolvedValueOnce([{ id: 't-1', position: 1 }]);
    itemInsertReturning.mockResolvedValue([{ id: 'i-1' }]);

    await persistArrangement('p-1', {
      timelineItems: [
        { assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 },
        { assetId: 'a-2', trackIndex: 0, startMs: 3000, durationMs: 2000 },
        { assetId: 'a-3', trackIndex: 1, startMs: 0, durationMs: 5000 },
      ],
      summary: 's',
    });

    expect(trackInsertValues).toHaveBeenCalledTimes(2);  // one per unique trackIndex
    expect(itemInsertValues).toHaveBeenCalledTimes(3);   // one per item
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/services/arrangement-persister.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the persister**

Create `packages/api/src/services/arrangement-persister.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tracks, timelineItems } from '../db/schema.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

/**
 * Persists an ArrangementOutput into the relational timeline schema.
 *
 * Strategy:
 * - Look up existing tracks for the project; create new tracks for any trackIndex not covered.
 * - Insert one timelineItems row per arrangement item, linked to its track by id.
 *
 * This is a first-pass: if tracks already exist from a prior arrangement or user editing,
 * they are reused by position. New items are APPENDED; the caller is responsible for
 * clearing prior arrangement-generated items if re-running.
 */
export async function persistArrangement(projectId: string, output: ArrangementOutput): Promise<void> {
  const existingTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
  const trackByPosition = new Map<number, { id: string }>(
    existingTracks.map((t) => [t.position, { id: t.id }]),
  );

  const neededPositions = new Set(output.timelineItems.map((i) => i.trackIndex));

  for (const position of neededPositions) {
    if (trackByPosition.has(position)) continue;
    const [row] = await db.insert(tracks).values({
      projectId,
      type: 'video',
      name: `Track ${position + 1}`,
      position,
      locked: false,
      visible: true,
    }).returning();
    trackByPosition.set(position, { id: row.id });
  }

  for (const item of output.timelineItems) {
    const track = trackByPosition.get(item.trackIndex);
    if (!track) continue;   // should not happen given we just created all needed tracks
    await db.insert(timelineItems).values({
      trackId: track.id,
      type: 'asset',
      startMs: item.startMs,
      endMs: item.startMs + item.durationMs,
      data: {
        assetId: item.assetId,
        sourceStartMs: item.sourceStartMs ?? 0,
        sourceDurationMs: item.sourceDurationMs ?? item.durationMs,
        source: 'arrangement_agent',
      },
    }).returning();
  }
}
```

Note: column names for `tracks` and `timelineItems` may differ in the existing schema — read `packages/api/src/db/schema.ts` at the `tracks` + `timelineItems` declarations and adapt. If `tracks.type` is an enum with specific values, use whatever the codebase already accepts for asset-referencing tracks.

- [ ] **Step 4: Run tests, expect GREEN**

Run: `cd packages/api && pnpm test -- src/services/arrangement-persister.test.ts`
Expected: PASS (1 test minimum; add more once the schema-read confirms the right fields).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/arrangement-persister.ts packages/api/src/services/arrangement-persister.test.ts
git commit -m "feat(api): arrangement-persister — writes ArrangementOutput to tracks + timelineItems"
```

---

## Task 9: Arrangement orchestrator + pipeline events

**Files:**
- Create: `packages/api/src/services/arrangement-orchestrator.ts`
- Create: `packages/api/src/services/arrangement-orchestrator.test.ts`

The orchestrator ties everything together:
1. Fetch the conversation for the project.
2. Insert `pipeline: arranging` message.
3. Build input → run agent → persist output.
4. Insert `pipeline: arranged` message + the agent's `summary` as a regular `assistant` message.
5. On any failure: insert a `pipeline: failed` message with the error text; rethrow.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const buildInputSpy = vi.fn();
const runAgentSpy = vi.fn();
const persistSpy = vi.fn().mockResolvedValue(undefined);
const insertPipelineSpy = vi.fn().mockResolvedValue(undefined);
const addMessageSpy = vi.fn();
const getOrCreateConversationSpy = vi.fn();

vi.mock('./arrangement-input-builder.js', () => ({
  buildArrangementInput: (...a: unknown[]) => buildInputSpy(...a),
}));
vi.mock('../agent/arrangement-agent.js', () => ({
  runArrangementAgent: (...a: unknown[]) => runAgentSpy(...a),
}));
vi.mock('./arrangement-persister.js', () => ({
  persistArrangement: (...a: unknown[]) => persistSpy(...a),
}));
vi.mock('./pipeline-messages.js', () => ({
  insertPipelineMessage: (...a: unknown[]) => insertPipelineSpy(...a),
}));
vi.mock('../agent/conversation-store.js', () => ({
  getOrCreateConversation: (...a: unknown[]) => getOrCreateConversationSpy(...a),
  addMessage: (...a: unknown[]) => addMessageSpy(...a),
}));

import { computeArrangement } from './arrangement-orchestrator.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('computeArrangement', () => {
  it('emits arranging → arranged, persists output, posts summary as assistant message', async () => {
    getOrCreateConversationSpy.mockResolvedValue({ id: 'c-1' });
    buildInputSpy.mockResolvedValueOnce({ prompt: 'x', assets: [], transcripts: [] });
    runAgentSpy.mockResolvedValueOnce({
      timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 }],
      summary: 'first pass',
    });

    const result = await computeArrangement('p-1');

    expect(insertPipelineSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ eventType: 'arranging' }));
    expect(insertPipelineSpy).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'arranged' }));
    expect(persistSpy).toHaveBeenCalledWith('p-1', expect.objectContaining({ summary: 'first pass' }));
    expect(addMessageSpy).toHaveBeenCalledWith('c-1', 'assistant', expect.arrayContaining([
      expect.objectContaining({ type: 'text', text: 'first pass' }),
    ]));
    expect(result.summary).toBe('first pass');
  });

  it('emits failed pipeline event and rethrows when the agent throws', async () => {
    getOrCreateConversationSpy.mockResolvedValue({ id: 'c-1' });
    buildInputSpy.mockResolvedValueOnce({ prompt: 'x', assets: [], transcripts: [] });
    runAgentSpy.mockRejectedValueOnce(new Error('agent-fail'));

    await expect(computeArrangement('p-1')).rejects.toThrow('agent-fail');
    expect(insertPipelineSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: 'arranged',  // we still want to mark completion? no — it should be a failed variant
    }));
  });
});
```

Note the second test's assertion is deliberately a placeholder — tune it to match whatever failure-event convention you choose (`arranged` with `{ ok: false }` in details, or a separate `'failed'` event type variant, or reuse the existing asset `failed`). Pick ONE convention in Step 3, then update the assertion to match. The simplest choice: include `ok: false` + error text inside the `arranged` event payload, keeping the event-type vocabulary tight.

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/services/arrangement-orchestrator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the orchestrator**

Create `packages/api/src/services/arrangement-orchestrator.ts`:

```ts
import { buildArrangementInput } from './arrangement-input-builder.js';
import { runArrangementAgent } from '../agent/arrangement-agent.js';
import { persistArrangement } from './arrangement-persister.js';
import { insertPipelineMessage } from './pipeline-messages.js';
import { getOrCreateConversation, addMessage } from '../agent/conversation-store.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

export async function computeArrangement(projectId: string): Promise<ArrangementOutput> {
  const convo = await getOrCreateConversation(projectId);

  await insertPipelineMessage({
    conversationId: convo.id, projectId,
    eventType: 'arranging', details: {},
  });

  try {
    const input = await buildArrangementInput(projectId);
    const output = await runArrangementAgent(input);
    await persistArrangement(projectId, output);

    await insertPipelineMessage({
      conversationId: convo.id, projectId,
      eventType: 'arranged',
      details: { ok: true, itemCount: output.timelineItems.length },
    });

    await addMessage(convo.id, 'assistant', [
      { type: 'text', text: output.summary },
    ]);

    return output;
  } catch (err) {
    await insertPipelineMessage({
      conversationId: convo.id, projectId,
      eventType: 'arranged',
      details: { ok: false, error: (err as Error).message },
    });
    throw err;
  }
}
```

Update the failure-case test assertion in the test file to match: assert the last `insertPipelineMessage` call has `details: { ok: false, error: 'agent-fail' }`.

- [ ] **Step 4: Run tests, expect GREEN**

Run: `cd packages/api && pnpm test -- src/services/arrangement-orchestrator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/arrangement-orchestrator.ts packages/api/src/services/arrangement-orchestrator.test.ts
git commit -m "feat(api): arrangement orchestrator — input → agent → persist + pipeline events"
```

---

## Task 10: `POST /projects/:id/arrangement/compute` endpoint

**Files:**
- Create: `packages/api/src/routes/arrangement.ts`
- Create: `packages/api/src/routes/arrangement.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';

const computeSpy = vi.fn();

vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: (...a: unknown[]) => computeSpy(...a),
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (req: { user: { id: string } }) => {
    req.user = { id: 'u-1' } as unknown as never;
  },
}));

import arrangementRoutes from './arrangement.js';

async function build() {
  const app = fastify();
  await app.register(arrangementRoutes);
  return app;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /projects/:id/arrangement/compute', () => {
  it('returns 200 with the arrangement output on success', async () => {
    computeSpy.mockResolvedValueOnce({
      timelineItems: [{ assetId: 'a-1', trackIndex: 0, startMs: 0, durationMs: 3000 }],
      summary: 'ok',
    });
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(200);
    expect(res.json().summary).toBe('ok');
    expect(computeSpy).toHaveBeenCalledWith('p-1');
  });

  it('returns 500 when orchestrator throws', async () => {
    computeSpy.mockRejectedValueOnce(new Error('boom'));
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/projects/p-1/arrangement/compute' });
    expect(res.statusCode).toBe(500);
  });
});
```

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/api && pnpm test -- src/routes/arrangement.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

Create `packages/api/src/routes/arrangement.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { computeArrangement } from '../services/arrangement-orchestrator.js';

const arrangementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/arrangement/compute',
    async (request, reply) => {
      try {
        const output = await computeArrangement(request.params.id);
        return reply.send(output);
      } catch (err) {
        request.log.error({ err }, 'arrangement compute failed');
        return reply.code(500).send({ error: 'arrangement_failed', message: (err as Error).message });
      }
    },
  );
};

export default arrangementRoutes;
```

- [ ] **Step 4: Register behind feature flag**

In `packages/api/src/index.ts`, extend the `assetSystemV2` block:

```ts
import arrangementRoutes from './routes/arrangement.js';
// ...
if (config.featureFlags.assetSystemV2) {
  await fastify.register(assetRoutes);
  await fastify.register(projectAssetRoutes);
  await fastify.register(assetEventsSseRoutes);
  await fastify.register(arrangementRoutes);  // NEW
  fastify.log.info('Asset system v2 routes registered');
}
```

- [ ] **Step 5: Run tests, expect GREEN**

Run: `cd packages/api && pnpm test -- src/routes/arrangement.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/arrangement.ts packages/api/src/routes/arrangement.test.ts packages/api/src/index.ts
git commit -m "feat(api): POST /projects/:id/arrangement/compute"
```

---

## Task 11: Arrangement BullMQ queue + worker

**Files:**
- Modify: `packages/api/src/services/queue.ts`
- Create: `packages/worker/src/processors/arrangement.ts`
- Create: `packages/worker/src/processors/arrangement.test.ts`
- Modify: `packages/worker/src/index.ts`

The worker consumes `{ projectId }` jobs and calls `computeArrangement(projectId)` — same code path as the endpoint, so the synchronous and async invocations share one orchestrator.

- [ ] **Step 1: Add queue + helper to `packages/api/src/services/queue.ts`**

Append:
```ts
export interface ArrangementJobData {
  projectId: string;
}

export const arrangementQueue = new Queue<ArrangementJobData>('arrangement', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  },
});

export async function queueArrangementJob(data: ArrangementJobData): Promise<void> {
  await arrangementQueue.add('arrangement', data, { attempts: 2 });
}
```

- [ ] **Step 2: Failing test for the worker processor**

Create `packages/worker/src/processors/arrangement.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const computeSpy = vi.fn();

vi.mock('../services/arrangement-orchestrator.js', () => ({
  computeArrangement: (...a: unknown[]) => computeSpy(...a),
}));

import { processArrangementJob } from './arrangement.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('processArrangementJob', () => {
  it('invokes computeArrangement with the projectId', async () => {
    computeSpy.mockResolvedValueOnce({ timelineItems: [], summary: 's' });
    await processArrangementJob({ data: { projectId: 'p-1' } } as never);
    expect(computeSpy).toHaveBeenCalledWith('p-1');
  });
});
```

- [ ] **Step 3: Run test, expect RED**

Run: `cd packages/worker && pnpm test -- src/processors/arrangement.test.ts`
Expected: FAIL — module not found.

The worker does not yet have `../services/arrangement-orchestrator.js` because the orchestrator lives in the API package. You need to decide:

**Option A (recommended):** The worker imports the orchestrator from `packages/api/src/services/arrangement-orchestrator.ts` by extending the worker's tsconfig paths or by cross-package workspace resolution. Check `packages/worker/package.json` — if it lists `@viona/api` as a dependency, import via that. If not, add a narrow worker-side re-export file at `packages/worker/src/services/arrangement-orchestrator.ts` that just re-imports the API module path. Either way, the test above mocks the import so the wiring detail is isolated.

**Option B:** Duplicate the orchestrator into the worker package (mirrors the Task 8/9 pattern the worker already uses for MinIO/events). Larger surface but simpler deps.

Prefer A: share code via workspace import. If `packages/worker/package.json` already lists `@viona/api` as a dep, use that import path. Otherwise add the dep and use it.

- [ ] **Step 4: Create the processor**

Create `packages/worker/src/processors/arrangement.ts`:

```ts
import type { Job } from 'bullmq';
import { computeArrangement } from '../services/arrangement-orchestrator.js';

export interface ArrangementJobData {
  projectId: string;
}

export async function processArrangementJob(job: Job<ArrangementJobData>): Promise<void> {
  await computeArrangement(job.data.projectId);
}
```

Plus the thin re-export file at `packages/worker/src/services/arrangement-orchestrator.ts` (if chosen):

```ts
export { computeArrangement } from '@viona/api/src/services/arrangement-orchestrator.js';
```

(Adjust the import to match the monorepo's actual package name + entry resolution.)

- [ ] **Step 5: Register the worker in `packages/worker/src/index.ts`**

```ts
import { processArrangementJob } from './processors/arrangement.js';

const arrangementWorker = new Worker('arrangement', processArrangementJob, {
  connection,
  concurrency: 1,
  lockDuration: 10 * 60 * 1000,
  stalledInterval: 5 * 60 * 1000,
});
```

Add it to the shutdown list wherever existing workers are drained.

- [ ] **Step 6: Run tests, expect GREEN**

Run: `cd packages/worker && pnpm test -- src/processors/arrangement.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/services/queue.ts \
  packages/worker/src/processors/arrangement.ts \
  packages/worker/src/processors/arrangement.test.ts \
  packages/worker/src/services/arrangement-orchestrator.ts \
  packages/worker/src/index.ts
git commit -m "feat(worker): arrangement queue + processor"
```

Stage only the files you actually modified.

---

## Task 12: Auto-trigger — fire arrangement after all transcripts ready

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts`
- Modify: `packages/worker/src/processors/transcribe.test.ts`

After transcribe asset-mode finishes for a given asset, check: do all assets linked to every project containing this asset now have `transcriptStatus = 'ready'` OR `transcriptStatus = 'not_applicable'`? If yes for a project, enqueue one arrangement job for that project.

- [ ] **Step 1: Add a test case**

Append to `packages/worker/src/processors/transcribe.test.ts`:

```ts
describe('processTranscribeJob — asset mode auto-trigger', () => {
  it('enqueues arrangement for each project where all assets are transcript-ready', async () => {
    // Mock setup:
    //   - select() on asset_project_links returning [{ projectId: 'p-1' }]
    //   - select() on assets joined with asset_project_links for p-1 returning all ready
    //   - queueArrangementJob stub captures calls
    // Then call processAssetTranscribe with the completed asset.
    // Assert queueArrangementJob called with { projectId: 'p-1' }.
  });

  it('does not enqueue arrangement if any sibling asset is still pending', async () => {
    // Same setup but one sibling has transcriptStatus: 'pending'.
    // Assert queueArrangementJob NOT called.
  });
});
```

Flesh these out matching the repo's existing test-mock patterns. The `queueArrangementJob` helper must be importable from the worker (see Task 11's worker-side queue helper — add one that mirrors the API's).

- [ ] **Step 2: Run test, expect RED**

Run: `cd packages/worker && pnpm test -- src/processors/transcribe.test.ts`
Expected: new tests FAIL — auto-trigger logic not implemented.

- [ ] **Step 3: Implement the trigger**

In `packages/worker/src/processors/transcribe.ts`, at the end of `processAssetTranscribe` (after the `transcript_ready` event is emitted), add:

```ts
import { queueArrangementJob } from '../services/queue.js';
// (extend the worker-side queue.ts with a mirror of queueArrangementJob that uses the same
// BullMQ connection; or import the API's queue.ts via workspace resolution.)

async function enqueueArrangementIfReady(assetId: string) {
  const links = await db.select({ projectId: assetProjectLinks.projectId })
    .from(assetProjectLinks)
    .where(eq(assetProjectLinks.assetId, assetId));
  for (const { projectId } of links) {
    const siblings = await db
      .select({ transcriptStatus: assets.transcriptStatus })
      .from(assets)
      .innerJoin(assetProjectLinks, eq(assets.id, assetProjectLinks.assetId))
      .where(eq(assetProjectLinks.projectId, projectId));
    const allDone = siblings.every(
      (s) => s.transcriptStatus === 'ready' || s.transcriptStatus === 'not_applicable',
    );
    if (allDone) {
      await queueArrangementJob({ projectId });
    }
  }
}
```

And at the end of the success path in `processAssetTranscribe`:

```ts
await enqueueArrangementIfReady(data.assetId);
```

- [ ] **Step 4: Run tests, expect GREEN**

Run: `cd packages/worker && pnpm test -- src/processors/transcribe.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/transcribe.ts packages/worker/src/processors/transcribe.test.ts packages/worker/src/services/queue.ts
git commit -m "feat(worker): auto-trigger arrangement after all project transcripts ready"
```

---

## Task 13: Pipeline event emission from workers

**Files:**
- Modify: `packages/worker/src/processors/transcribe.ts`
- Modify: `packages/worker/src/processors/asset-metadata.ts`
- Modify: `packages/worker/src/services/pipeline-messages.ts` (create if absent — mirror of API's)

Emit `transcribing` / `transcribed` messages at the start and end of asset-mode transcription. Optionally, emit `analyzing` from any future analysis worker — gated behind `ANALYSIS_WORKERS`.

- [ ] **Step 1: Create the worker-side pipeline-messages helper**

Create `packages/worker/src/services/pipeline-messages.ts` (mirror of the API module from Task 2):

```ts
import { addMessage } from './conversation-store.js';  // worker-side mirror, or import from @viona/api
import { redis } from './redis.js';

export type PipelineEventType =
  | 'transcribing' | 'transcribed'
  | 'analyzing' | 'analyzed'
  | 'arranging' | 'arranged' | 'ready';

export interface PipelineMessageInput {
  conversationId: string;
  projectId: string;
  eventType: PipelineEventType;
  details: Record<string, unknown>;
}

export async function insertPipelineMessage(input: PipelineMessageInput) {
  const content = [{
    type: 'pipeline_event' as const,
    eventType: input.eventType,
    details: input.details,
    ts: new Date().toISOString(),
  }];
  const row = await addMessage(input.conversationId, 'pipeline', content);
  const envelope = JSON.stringify({
    kind: 'pipeline_message',
    messageId: row.id,
    conversationId: row.conversationId,
    eventType: input.eventType,
    details: input.details,
  });
  await redis.publish(`conversation:${input.projectId}`, envelope);
  return row;
}
```

If the worker does not yet have a `conversation-store.js`, either import from `@viona/api` (preferred) or add a minimal worker-side mirror.

- [ ] **Step 2: Wire into transcribe worker**

In `packages/worker/src/processors/transcribe.ts`, in `processAssetTranscribe`:

- Before running Whisper: resolve the conversation for the first project this asset is linked to (same query as `enqueueArrangementIfReady` but take only the first link). Call `insertPipelineMessage({ eventType: 'transcribing', details: { assetId, filename } })`.
- After the `transcript_ready` asset event is emitted successfully: call `insertPipelineMessage({ eventType: 'transcribed', details: { assetId, wordCount } })`.

(Skip if the asset has no project links — the transcript still lands as a library asset, just without a chat to narrate it in.)

- [ ] **Step 3: Tests**

Add two test cases to `transcribe.test.ts` asserting `insertPipelineMessage` is called with the correct event types around the STT block. Mock the helper via `vi.mock`.

- [ ] **Step 4: Run tests, expect GREEN**

Run: `cd packages/worker && pnpm test -- src/processors/transcribe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/services/pipeline-messages.ts \
  packages/worker/src/processors/transcribe.ts \
  packages/worker/src/processors/transcribe.test.ts
git commit -m "feat(worker): emit transcribing/transcribed pipeline messages from transcribe processor"
```

---

## Task 14: Typecheck + test suite baseline

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: baseline matches PR-A1 (2 known pre-existing errors in `sandbox/proxy.ts`, `sandbox/routes.ts`). No NEW errors introduced by PR-A2.

- [ ] **Step 2: Full test suites**

```bash
cd packages/api && pnpm test
cd ../worker && pnpm test
```

Both all-green. Smoke test (`ASSET_SMOKE_ENABLED=1`) remains opt-in.

- [ ] **Step 3: Commit any baseline fixups**

If typecheck or tests surface regressions caused by PR-A2 commits, fix them and commit:
```bash
git commit -m "chore: typecheck + test baseline clean for arrangement-agent scope"
```

Otherwise skip this step and state explicitly that no baseline fixup was needed.

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ `'pipeline'` role for chat messages → Task 2 (stored as `role: 'pipeline'`, no schema migration needed — column is varchar).
- ✅ `ArrangementInput` / `ArrangementOutput` types → Task 3.
- ✅ `POST /projects/:id/arrangement/compute` endpoint → Task 10 (behind `ASSET_SYSTEM_V2`).
- ✅ Claude Opus arrangement agent → Task 7.
- ✅ Prompt template with conditional analysis sockets → Task 6.
- ✅ Auto-trigger after transcription → Task 12.
- ✅ Pipeline events from workers → Task 13.
- ✅ `ANALYSIS_WORKERS` flag → Task 1. Currently no worker emits `analyzing` / `analyzed` (since no visual analysis ships here); the flag is ready for PR-C + the future visual analysis worker to flip.
- ✅ Persists to existing relational timeline schema → Task 8.

**2. Placeholder scan:** Task 8's test mock is the weakest — the `_ident` cast dispatches between `tracks` and `timelineItems` inserts based on string containment. Implementers should inspect `packages/api/src/db/schema.ts`'s real `tracks` / `timelineItems` exports and swap in proper Drizzle table introspection. Task 9's failure-case test assertion is deliberately hand-off-to-implementation — Step 3 says "Pick ONE convention, update the assertion to match"; Step 3 picks `arranged` with `ok: false`, so the test assertion must be updated to `{ ok: false, error: 'agent-fail' }`. Both are called out explicitly in the task bodies.

**3. Type consistency:**
- `ArrangementOutput.timelineItems[].assetId` is always a string (not UUID-typed), matching the Zod schema and the agent's tool input.
- `PipelineEventType` is the same union across `packages/api/src/services/pipeline-messages.ts` (Task 2) and `packages/worker/src/services/pipeline-messages.ts` (Task 13). Worker can import the API version via workspace resolution if available; otherwise duplicate the union and rely on exhaustiveness checks.
- `queueArrangementJob({ projectId })` has the exact same shape in `packages/api/src/services/queue.ts` (Task 11 Step 1) and the processor data type in `packages/worker/src/processors/arrangement.ts` (Task 11 Step 4).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-arrangement-agent.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task with two-stage review, proven workflow from PR-A1 (22 commits, zero production bugs escaped).

**2. Inline Execution** — batch execution with checkpoints.

Which approach?
