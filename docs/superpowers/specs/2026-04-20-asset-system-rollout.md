# Asset System V2 Rollout Checklist

When ready to turn the whole system on:

## API + Worker + Sandbox
```env
ASSET_SYSTEM_V2=true
ANALYSIS_WORKERS=false  # stays off — visual analysis worker doesn't ship until Phase 2
ANTHROPIC_API_KEY=<key>  # REQUIRED on BOTH api + worker containers
```

> **ANTHROPIC_API_KEY must be set on the Worker container too, not just the API.**
> The worker runs its own mirrored arrangement orchestrator that calls Anthropic
> directly. Missing the key on the worker container causes arrangement jobs to
> fail silently (no user-visible error) — the job dies before posting a progress
> event. Sandbox containers also receive the key (passed through from API at
> service create time), but that path is separate.

## Frontend
```env
NEXT_PUBLIC_ASSET_SYSTEM_V2=true   # BUILD-time env — Next.js inlines at build
NEXT_PUBLIC_API_URL=<api-base-url> # BUILD-time env — Next.js inlines at build
```

> **NEXT_PUBLIC_* vars are build-time, not runtime.** Next.js inlines them into
> the client bundle at `next build`. Flipping these on Railway after the image
> is built has no effect — you must trigger a fresh build (redeploy) for the
> new value to take effect in the browser.

## Known integration gap in PR-C
- `/projects/new` redirects to `/edit/:id?initialPrompt=<text>` but the editor's AIAssistantPanel does not yet read the query param. First message behavior is deferred to a follow-up PR. Workaround: user retypes the prompt in the chat on arrival.

## Verification steps after flag flip
1. Navigate to /projects/new
2. Drop 2-3 files + prompt → Create
3. Editor opens; verify Assets panel shows tiles
4. Pipeline bubbles for transcription appear in chat
5. Arrangement agent fires once transcripts complete; timeline populates
6. Drop a file into the chat panel; verify it appears in Assets panel
7. Drag a tile to the timeline; verify it lands
