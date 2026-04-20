# Asset System V2 Rollout Checklist

When ready to turn the whole system on:

## Feature flags

```env
ASSET_SYSTEM_V2=true
ANALYSIS_WORKERS=false  # stays off — visual analysis worker doesn't ship until Phase 2
```

## ANTHROPIC_API_KEY placement

PR-D removed the standalone arrangement orchestrator from the worker. Anthropic
calls are no longer made from the worker container. Set the key on these tiers:

```env
# SANDBOX container (REQUIRED)
ANTHROPIC_API_KEY=<key>   # Viona + the arrangement subagent run inside the sandbox

# API container (REQUIRED — legacy agent-router proxy path)
ANTHROPIC_API_KEY=<key>   # agent-router.ts streams Viona turns via proxyPromptWithIntercept

# WORKER container — NOT required
# The worker only runs transcribe / segmentation / utility jobs. It does not
# call Anthropic. Do not set ANTHROPIC_API_KEY there.
```

Sandbox containers receive the key at service-create time (passed through from
the API when the per-project sandbox is provisioned).

## Frontend

```env
NEXT_PUBLIC_ASSET_SYSTEM_V2=true   # BUILD-time env — Next.js inlines at build
NEXT_PUBLIC_API_URL=<api-base-url> # BUILD-time env — Next.js inlines at build
```

> **NEXT_PUBLIC_* vars are build-time, not runtime.** Next.js inlines them into
> the client bundle at `next build`. Flipping these on Railway after the image
> is built has no effect — you must trigger a fresh build (redeploy) for the
> new value to take effect in the browser.

## Arrangement is a Viona subagent (PR-D)

Arrangement is no longer a standalone agent that fires on a BullMQ queue when
transcripts complete. There is no `POST /api/projects/:id/arrangement/compute`
endpoint, no `arrangement` processor in the worker, and no auto-trigger from
the transcribe processor.

Instead:

1. The creative brief / first user message is forwarded to **Viona** (the
   creative director agent running in the sandbox).
2. Viona's system prompt instructs it to delegate to the **arrangement**
   subagent in Phase 1.5 — before trim_editor, caption_agent, planner, etc.
3. The arrangement subagent reads manifest assets via the sandbox's
   `read_asset` tool and writes tracks + timeline items through the
   manifest-ops MCP server.
4. The manifest-bridge on the API side receives manifest-ops deltas over SSE
   and resolves `data.assetId` via `listProjectAssets` before persisting to
   Postgres. The frontend sees the updated composition via the normal
   `composition-v2` GET (polled on mutation).

If you're looking for the old `composition_updated` SSE relay, it's been
removed — the API's agent-router no longer forwards that envelope kind (the
worker stopped publishing it in Task 2, and nothing emits it in the new flow).

## Known integration gap in PR-C

- `/projects/new` redirects to `/edit/:id?initialPrompt=<text>` but the editor's
  AIAssistantPanel does not yet read the query param. First message behavior
  is deferred to a follow-up PR. Workaround: user retypes the prompt in the
  chat on arrival.

## Verification steps after flag flip

1. Navigate to /projects/new
2. Drop 2-3 files + prompt → Create
3. Editor opens; verify Assets panel shows tiles
4. Pipeline bubbles for transcription appear in chat
5. Send the creative brief to Viona; arrangement subagent fires in Phase 1.5
   and timeline populates
6. Drop a file into the chat panel; verify it appears in Assets panel
7. Drag a tile to the timeline; verify it lands
