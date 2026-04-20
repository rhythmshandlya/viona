# Asset System V2 Rollout Checklist

When ready to turn the whole system on:

## API + Worker + Sandbox
```env
ASSET_SYSTEM_V2=true
ANALYSIS_WORKERS=false  # stays off — visual analysis worker doesn't ship until Phase 2
ANTHROPIC_API_KEY=<key>  # required for arrangement agent
```

## Frontend
```env
NEXT_PUBLIC_ASSET_SYSTEM_V2=true
NEXT_PUBLIC_API_URL=<api-base-url>
```

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
