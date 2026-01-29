# OpenHands Visual Generation System Design

## Overview

Replace Claude Code CLI with OpenHands SDK for scalable AI visual generation. The system uses OpenHands agents running in Docker containers to generate Remotion animations, with configurable LLM quality tiers and visual feedback loops.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend      │     │   API Server     │     │   Worker            │
│                 │     │                  │     │                     │
│ StyleSelection  │────▶│ POST /generate   │────▶│ BullMQ Job          │
│ Modal + Tier    │     │ -visuals         │     │                     │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │ Python Subprocess   │
                                                 │ visual_generator.py │
                                                 └──────────┬──────────┘
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │ OpenHands Agent     │
                                                 │ (Docker Sandbox)    │
                                                 │                     │
                                                 │ - Write Remotion    │
                                                 │ - Take screenshots  │
                                                 │ - Polish designs    │
                                                 └──────────┬──────────┘
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │ Bundle & Store      │
                                                 │ @remotion/bundler   │
                                                 └──────────┬──────────┘
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │ Frontend Player     │
                                                 │ DynamicVisualLoader │
                                                 └─────────────────────┘
```

## Components

### 1. Python Agent Script (`visual_generator.py`)

Standalone Python script that:
- Receives job parameters (projectId, prompt, model, workspace)
- Configures OpenHands LLM and agent
- Runs conversation with event streaming
- Outputs progress as JSON to stdout

```python
from openhands.sdk import LLM, Conversation
from openhands.tools.preset import get_default_agent

llm = LLM(model=args.model, api_key=SecretStr(args.api_key))
agent = get_default_agent(llm=llm, cli_mode=True)
conversation = Conversation(agent=agent, workspace=args.workspace)

conversation.send_message(prompt)
for event in conversation.run_iter():
    print(json.dumps({"type": event.type, "tool": event.tool_name}), flush=True)
```

### 2. TypeScript Worker (`generate-visuals.ts`)

Simplified to:
- Build prompt using existing `buildGenerateVisualsPrompt`
- Spawn Python subprocess with job parameters
- Parse stdout events for progress updates
- Handle cancellation via SIGTERM
- Bundle output after agent completes

### 3. Custom Docker Sandbox

Dockerfile with Remotion dependencies:
- Base: `nikolaik/python-nodejs:python3.12-nodejs22`
- Chromium for screenshots
- @remotion/cli pre-installed

### 4. LLM Quality Tiers

| Tier | Model | Provider | Vision |
|------|-------|----------|--------|
| fast | gpt-4o-mini | OpenAI | Yes |
| balanced | claude-sonnet-4 | Anthropic | Yes |
| quality | claude-opus-4 | Anthropic | Yes |

### 5. Visual Feedback Loop

Agent workflow:
1. Write Remotion component code
2. Take screenshot: `npx remotion still ... --output=preview.png`
3. Analyze screenshot with vision LLM
4. Refine code based on analysis
5. Repeat until polished (max 3 iterations)

## Database Changes

```sql
ALTER TABLE jobs ADD COLUMN llm_model VARCHAR(100);
ALTER TABLE visuals ADD COLUMN llm_model VARCHAR(100);
```

## API Changes

```typescript
interface GenerateVisualsRequest {
  stylePreset: 'minimal' | 'modern' | 'playful' | 'bold' | 'classic';
  qualityTier: 'fast' | 'balanced' | 'quality';
}
```

## Concurrency & Scaling

- BullMQ concurrency: 10 parallel jobs per worker
- Container limits: 2GB RAM, 1 CPU per job
- Recommended server: 48GB RAM, 16 cores for 20 concurrent jobs
- Future: OpenHands Cloud API for 1000s of agents

## Bundle Delivery

1. Worker bundles Remotion project after agent completes
2. Bundle stored at `/bundles/{compositionId}/`
3. API serves bundles via static file middleware
4. Frontend loads via `DynamicVisualLoader` component

## Implementation Phases

### Phase 1: Foundation
- [ ] Create custom Docker image with Remotion/Chromium
- [ ] Install openhands-ai in worker
- [ ] Write visual_generator.py agent script
- [ ] Test standalone agent

### Phase 2: Integration
- [ ] Simplify generate-visuals.ts
- [ ] Wire up event streaming and progress
- [ ] Implement cancellation
- [ ] Test end-to-end

### Phase 3: Quality Tiers
- [ ] Add qualityTier to API/database
- [ ] Update StyleSelectionModal UI
- [ ] Pass model config to agent
- [ ] Test each tier

### Phase 4: Polish
- [ ] Container resource limits
- [ ] BullMQ concurrency config
- [ ] Error handling and retries
- [ ] Logging and monitoring

## Files to Modify

- `packages/worker/src/processors/generate-visuals.ts` - Simplify, spawn Python
- `packages/worker/src/agents/visual_generator.py` - New OpenHands agent
- `packages/worker/Dockerfile` - Add Python/OpenHands deps
- `docker/remotion-sandbox/Dockerfile` - New custom sandbox image
- `packages/api/src/routes/projects.ts` - Add qualityTier param
- `apps/web/src/lib/api.ts` - Add qualityTier type
- `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx` - Add tier UI
