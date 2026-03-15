# Sandbox Agent Pipeline — End-to-End Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sandbox agent pipeline actually work end-to-end — from Docker image build through a real visual generation conversation.

**Architecture:** The sandbox is a Docker container running an Express server with Claude Agent SDK. An orchestrator agent dispatches 6 subagents (planner, animator, researcher, trimmer, verifier, healer) via SDK `query()`. MCP tool servers (manifest, scenes, render, widgets + stdio: assets, viewport, icons) provide the agents' capabilities. The API layer proxies chat requests from the frontend to the sandbox, and the frontend displays streamed SSE responses.

**Tech Stack:** Node 20, TypeScript, Docker, Express, Claude Agent SDK, esbuild, Remotion, Chokidar, MinIO, Fastify (API), React/Next.js (frontend)

**Spec:** `docs/superpowers/specs/2026-03-15-sandbox-agent-pipeline-design.md`

**Preconditions:**
- The 4 stdio MCP servers (assets, viewport, freepik, better-icons) are already wired in `mcp-config.ts` and `orchestrator.ts`
- All 7 prompt files exist in `packages/sandbox/src/prompts/`
- All in-process MCP servers (manifest, scenes, render, widgets) exist in `packages/sandbox/src/tools/` and `mcp-servers.ts`
- Tasks 7-10 require a valid `ANTHROPIC_API_KEY` set as an environment variable (live SDK calls, will incur API costs)
- The transcript fields in `workspace-init.ts` use `startMs`/`endMs` (milliseconds), matching the DB schema — NOT seconds as in the init spec's TypeScript interface

---

## Chunk 1: Fix Known Bugs & Build Docker Image

These tasks fix code issues discovered during review and get the Docker image building successfully.

### Task 1: Fix scene registry key mismatch

**Problem:** `scene-registry-generator.ts` produces keys like `'scenes/HookTitle.tsx'` but `SceneItem.tsx` looks up by `data.sceneFile` which is `'HookTitle.tsx'` or `'scenes/HookTitle.tsx'`. The key format must match what the orchestrator/planner puts in the manifest's `data.sceneFile` field.

**Files:**
- Modify: `packages/sandbox/src/scene-registry-generator.ts:27`

- [ ] **Step 1: Read the current registry generator and SceneItem**

Read `packages/sandbox/src/scene-registry-generator.ts` and `packages/sandbox/template/src/items/SceneItem.tsx` to understand the mismatch.

The generator produces:
```typescript
registryEntries.push(`  'scenes/${file}': ${varName},`);
```

SceneItem looks up:
```typescript
const SceneComponent = sceneRegistry[data.sceneFile];
```

The planner prompt tells agents to set `sceneFile: "HookTitle.tsx"`. So the key must be `"HookTitle.tsx"`, not `"scenes/HookTitle.tsx"`.

- [ ] **Step 2: Fix the registry key format**

Change `scene-registry-generator.ts` line 27 from:
```typescript
registryEntries.push(`  'scenes/${file}': ${varName},`);
```
to:
```typescript
registryEntries.push(`  '${file}': ${varName},`);
```

This makes the key `'HookTitle.tsx'` which matches what agents put in `data.sceneFile`.

- [ ] **Step 3: Also handle lookup without extension**

In `SceneItem.tsx`, add a fallback lookup so both `"HookTitle"` and `"HookTitle.tsx"` work:

```typescript
const SceneComponent = sceneRegistry[data.sceneFile]
  || sceneRegistry[`${data.sceneFile}.tsx`]
  || sceneRegistry[`${data.sceneFile}.ts`];
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/scene-registry-generator.ts packages/sandbox/template/src/items/SceneItem.tsx
git commit -m "fix(sandbox): align scene registry keys with SceneItem lookup format"
```

---

### Task 2: Fix scene default export handling in registry

**Problem:** The generator uses `import ${varName} from './scenes/${name}'` (default import) but scenes export named components like `export const HookTitle = ...`. The generator should handle both patterns.

**Files:**
- Modify: `packages/sandbox/src/scene-registry-generator.ts`

- [ ] **Step 1: Update import to use wildcard import with default fallback**

Change the import/registry generation to:
```typescript
for (const file of sceneFiles) {
  const name = basename(file, file.endsWith('.tsx') ? '.tsx' : '.ts');
  const varName = name.replace(/[^a-zA-Z0-9_]/g, '_');
  // Use wildcard import — scenes may export default or named
  imports.push(`import * as ${varName}_mod from './scenes/${name}';`);
  // Prefer default export, fall back to named export matching filename
  registryEntries.push(`  '${file}': (${varName}_mod.default || ${varName}_mod.${varName}) as React.ComponentType<any>,`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/scene-registry-generator.ts
git commit -m "fix(sandbox): handle both default and named exports in scene registry"
```

---

### Task 3: Ensure Dockerfile builds successfully

**Files:**
- Modify: `packages/sandbox/Dockerfile`
- Modify: `packages/sandbox/entrypoint.sh`

- [ ] **Step 1: Read the current Dockerfile**

Read `packages/sandbox/Dockerfile` and verify all COPY paths are correct relative to the build context (repo root).

- [ ] **Step 2: Verify all source paths exist**

Check that these paths exist:
- `packages/sandbox/package.json` ✓
- `packages/sandbox/tsconfig.json` ✓
- `packages/sandbox/src/` ✓
- `packages/sandbox/template/` ✓
- `packages/sandbox/entrypoint.sh` ✓
- `packages/mcp-servers/package.json` ✓
- `packages/mcp-servers/src/` ✓
- `packages/worker/src/prompts/shared/` — verify this path
- `packages/worker/src/prompts/themes/` — verify this path

- [ ] **Step 3: Verify entrypoint.sh has Unix line endings**

```bash
# Check if file has Windows line endings (CRLF)
file packages/sandbox/entrypoint.sh
# If CRLF, convert:
sed -i 's/\r$//' packages/sandbox/entrypoint.sh
```

- [ ] **Step 4: Build the Docker image**

```bash
docker build -f packages/sandbox/Dockerfile -t viona-sandbox:dev .
```

Expected: Image builds successfully. If it fails, fix the errors and retry.

- [ ] **Step 5: Verify the image contents**

```bash
# Check prompt files are in the right place
docker run --rm viona-sandbox:dev ls /app/dist/prompts/
# Expected: animator-system.md, orchestrator-system.md, planner-system.md, etc.

# Check shared modules
docker run --rm viona-sandbox:dev ls /app/prompts/shared/
# Expected: technical-rules.md, motion-design-principles.md, vocabulary.md, quality-checklist.md

# Check theme files
docker run --rm viona-sandbox:dev ls /app/prompts/themes/
# Expected: themes.json, studio/ directory

# Check MCP servers
docker run --rm viona-sandbox:dev ls /app/mcp-servers/
# Expected: asset-server.js, viewport-server.js

# Check template files
docker run --rm viona-sandbox:dev ls /app/template/src/
# Expected: PlayerComposition.tsx, items/, composition/, scene-registry.ts

# Check Claude Code CLI
docker run --rm viona-sandbox:dev which claude
# Expected: path to claude binary
```

- [ ] **Step 6: Commit any Dockerfile fixes**

```bash
git add packages/sandbox/Dockerfile packages/sandbox/entrypoint.sh
git commit -m "fix(sandbox): ensure Dockerfile builds cleanly"
```

---

### Task 4: Test sandbox container boots and serves health check

**Files:**
- None (testing only)

- [ ] **Step 1: Run the container with minimal env vars**

```bash
docker run -d --name sandbox-test \
  -p 18080:8080 -p 18081:8081 \
  -e SANDBOX_SECRET=test-secret \
  -e SANDBOX_ID=test-project \
  -e NODE_ENV=production \
  viona-sandbox:dev
```

- [ ] **Step 2: Check health endpoint**

```bash
# Wait a few seconds for startup
sleep 3
curl http://localhost:18081/health
# Expected: {"status":"ok"}
```

- [ ] **Step 3: Check container logs for errors**

```bash
docker logs sandbox-test
# Expected: "Sandbox starting", "First boot — waiting for init from API",
#           "File server started", "Agent server started"
# Should NOT see: any crash, unhandled rejection, or module-not-found errors
```

- [ ] **Step 4: Clean up test container**

```bash
docker stop sandbox-test && docker rm sandbox-test
```

---

## Chunk 2: Test Workspace Init & MCP Tools

These tasks verify that the workspace initialization flow works and MCP tools function correctly inside the container.

### Task 5: Test /init endpoint with real project data

**Files:**
- Create: `scripts/temp/test-sandbox-init.sh`

- [ ] **Step 1: Create a test init payload**

Create `scripts/temp/test-sandbox-init.sh`:
```bash
#!/bin/bash
# Test sandbox /init endpoint with realistic payload
# Requires: MinIO running locally with a test video uploaded

SANDBOX_URL="http://localhost:18081"
SECRET="test-secret"

# Create a minimal manifest
MANIFEST='{
  "version": 2,
  "fps": 30,
  "durationMs": 30000,
  "canvas": { "width": 1080, "height": 1920 },
  "tracks": [
    { "id": "track-video", "type": "video", "name": "Speaker", "position": 0 }
  ],
  "items": [
    {
      "id": "item-video",
      "type": "video",
      "trackId": "track-video",
      "startMs": 0,
      "endMs": 30000,
      "data": { "src": "source.mp4" },
      "keyframes": []
    }
  ],
  "assets": {}
}'

# Create a test transcript
TRANSCRIPT='{
  "words": [
    { "text": "Hello", "startMs": 500, "endMs": 900, "confidence": 0.99 },
    { "text": "world", "startMs": 1000, "endMs": 1400, "confidence": 0.98 },
    { "text": "this", "startMs": 1500, "endMs": 1800, "confidence": 0.97 },
    { "text": "is", "startMs": 1900, "endMs": 2100, "confidence": 0.99 },
    { "text": "a", "startMs": 2200, "endMs": 2300, "confidence": 0.98 },
    { "text": "test", "startMs": 2400, "endMs": 2800, "confidence": 0.99 }
  ],
  "segments": [
    { "text": "Hello world this is a test", "startMs": 500, "endMs": 2800 }
  ],
  "language": "en"
}'

# Build the init body (no videoUrl — skip MinIO download for this test)
BODY=$(jq -n \
  --argjson manifest "$MANIFEST" \
  --argjson transcript "$TRANSCRIPT" \
  '{
    manifest: $manifest,
    transcript: $transcript,
    userBrief: "This is a test video about greeting the world. Make it energetic with bold text animations.",
    projectMeta: { width: 1080, height: 1920, fps: 30, durationMs: 30000 }
  }')

echo "Sending init..."
curl -s -X POST "$SANDBOX_URL/init" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d "$BODY" | jq .

echo ""
echo "Checking workspace files..."
docker exec sandbox-test ls /workspace/
docker exec sandbox-test ls /workspace/docs/
docker exec sandbox-test cat /workspace/generation-progress.json | jq .
docker exec sandbox-test cat /workspace/docs/transcript.json | jq '.words | length'
```

- [ ] **Step 2: Start container and run the test**

```bash
docker run -d --name sandbox-test \
  -p 18080:8080 -p 18081:8081 \
  -e SANDBOX_SECRET=test-secret \
  -e SANDBOX_ID=test-project \
  -e NODE_ENV=production \
  viona-sandbox:dev

sleep 3
bash scripts/temp/test-sandbox-init.sh
```

Expected:
- `/init` returns `{"ok": true}`
- `/workspace/manifest.json` exists with correct content
- `/workspace/docs/transcript.json` exists with 6 words
- `/workspace/docs/user-brief.md` exists
- `/workspace/generation-progress.json` exists with `phase: "initialized"`
- `/workspace/src/scene-registry.ts` exists (empty stub)

**Note:** The init will fail on video download since we have no MinIO. That's OK — we need to handle this gracefully. If it crashes, fix workspace-init.ts to make `videoUrl` truly optional (skip download if empty/missing).

- [ ] **Step 3: Fix any init errors found**

If the init crashes because videoUrl is empty, modify `workspace-init.ts` to skip the MinIO download when videoUrl is falsy:

```typescript
// Download video from MinIO (only if videoUrl provided)
if (payload.videoUrl) {
  const minio = getMinioClient();
  // ... existing download code
}
```

- [ ] **Step 4: Verify esbuild ran and produced a bundle**

```bash
docker exec sandbox-test ls /workspace/.build/
# Expected: player-composition.cjs.js
```

- [ ] **Step 5: Clean up and commit fixes**

```bash
docker stop sandbox-test && docker rm sandbox-test
git add packages/sandbox/src/workspace-init.ts scripts/temp/test-sandbox-init.sh
git commit -m "fix(sandbox): handle missing videoUrl in init, add init test script"
```

---

### Task 6: Test MCP tool servers inside container

**Files:**
- Create: `scripts/temp/test-sandbox-tools.sh`

- [ ] **Step 1: Create tool test script**

Create `scripts/temp/test-sandbox-tools.sh` that tests manifest tools via the /ops endpoint:

```bash
#!/bin/bash
SANDBOX_URL="http://localhost:18081"
SECRET="test-secret"

echo "=== Test readManifest ==="
curl -s -X POST "$SANDBOX_URL/ops" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{"tool":"readManifest","input":{}}' | jq .

echo ""
echo "=== Test addTrack ==="
curl -s -X POST "$SANDBOX_URL/ops" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{"tool":"addTrack","input":{"type":"overlay","name":"Visuals"}}' | jq .

echo ""
echo "=== Test addItem (scene type) ==="
curl -s -X POST "$SANDBOX_URL/ops" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{"tool":"addItem","input":{"type":"scene","trackId":"REPLACE_WITH_TRACK_ID","startMs":0,"endMs":5000,"data":{"sceneFile":"HookTitle.tsx"}}}' | jq .
```

- [ ] **Step 2: Run init + tool tests**

Boot container → init → run tool tests. Verify each tool returns expected results.

- [ ] **Step 3: Test scene file write tool**

Write a simple scene file and verify esbuild picks it up:

```bash
# Write a test scene
docker exec sandbox-test sh -c 'cat > /workspace/src/scenes/HookTitle.tsx << EOF
import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export const HookTitle: React.FC<{ width: number; height: number; durationInFrames: number; fps: number }> = ({ fps, durationInFrames }) => {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ color: "white", fontSize: 64, transform: \`scale(\${scale})\`, opacity, fontFamily: "sans-serif" }}>
        Hello World
      </h1>
    </div>
  );
};
export default HookTitle;
EOF'

# Wait for esbuild
sleep 3

# Check bundle was rebuilt
docker exec sandbox-test ls -la /workspace/.build/player-composition.cjs.js

# Check scene registry was regenerated
docker exec sandbox-test cat /workspace/src/scene-registry.ts
```

Expected: Scene registry contains `'HookTitle.tsx': HookTitle_mod.default || HookTitle_mod.HookTitle`.

- [ ] **Step 4: Commit test script**

```bash
git add scripts/temp/test-sandbox-tools.sh
git commit -m "test(sandbox): add MCP tool integration test script"
```

---

## Chunk 3: Test Agent SDK Integration

This is the critical chunk — verify that the Claude Agent SDK `query()` function works with our orchestrator configuration and that subagents can be dispatched.

### Task 7: Test orchestrator SDK call with minimal prompt

**Files:**
- Create: `scripts/temp/test-sandbox-prompt.sh`

- [ ] **Step 1: Create a prompt test script**

```bash
#!/bin/bash
# Test the /prompt endpoint — sends a message to the orchestrator
# Requires: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in container env

SANDBOX_URL="http://localhost:18081"
SECRET="test-secret"

echo "Sending prompt to orchestrator..."
curl -N -s -X POST "$SANDBOX_URL/prompt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "prompt": "Hello! What can you help me with? Please respond briefly.",
    "conversationHistory": [],
    "projectContext": {
      "canvasWidth": 1080,
      "canvasHeight": 1920,
      "fps": 30,
      "durationMs": 30000,
      "hasTranscript": true,
      "theme": "studio-dark",
      "projectType": "video"
    }
  }'
```

- [ ] **Step 2: Run with API key**

Start container with ANTHROPIC_API_KEY (or CLAUDE_CODE_OAUTH_TOKEN):

```bash
docker run -d --name sandbox-test \
  -p 18080:8080 -p 18081:8081 \
  -e SANDBOX_SECRET=test-secret \
  -e SANDBOX_ID=test-project \
  -e NODE_ENV=production \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  viona-sandbox:dev

sleep 3
# Run init first
bash scripts/temp/test-sandbox-init.sh
# Then test prompt
bash scripts/temp/test-sandbox-prompt.sh
```

Expected: SSE events stream back with `event: text` containing agent response chunks, followed by `event: done`.

- [ ] **Step 3: Debug any SDK errors**

Common issues to watch for:
- `query is not a function` → SDK import path wrong
- `model "opus" not found` → need full model ID like `claude-opus-4-6`
- `bypassPermissions not supported` → check SDK version/API
- `mcpServers format invalid` → check `createSdkMcpServer` return type
- Agent tool not available → check `allowedTools` list matches registered tools

Read container logs: `docker logs sandbox-test`

Fix any issues found in `orchestrator.ts`, `mcp-servers.ts`, or `agent-server.ts`.

- [ ] **Step 4: Verify the orchestrator can use MCP tools**

Send a prompt that should trigger a tool use:

```bash
curl -N -s -X POST "$SANDBOX_URL/prompt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "prompt": "Read the current manifest and tell me what tracks exist.",
    "conversationHistory": [],
    "projectContext": {
      "canvasWidth": 1080,
      "canvasHeight": 1920,
      "fps": 30,
      "durationMs": 30000,
      "hasTranscript": true,
      "theme": "studio-dark",
      "projectType": "video"
    }
  }'
```

Expected: Agent calls `mcp__manifest__readManifest`, reads the manifest, and responds with track information.

- [ ] **Step 5: Commit fixes**

```bash
git add packages/sandbox/src/orchestrator.ts packages/sandbox/src/mcp-servers.ts packages/sandbox/src/agent-server.ts
git commit -m "fix(sandbox): resolve SDK integration issues from first live test"
```

---

### Task 8: Test planner subagent dispatch

**Files:**
- Create: `scripts/temp/test-sandbox-planner.sh`

- [ ] **Step 1: Create planner test script and send a prompt that triggers planning**

Create `scripts/temp/test-sandbox-planner.sh`:
```bash
#!/bin/bash
SANDBOX_URL="http://localhost:18081"
SECRET="test-secret"

echo "Triggering planner dispatch..."
curl -N -s -X POST "$SANDBOX_URL/prompt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "prompt": "I want to add motion graphics to this video. The speaker is talking about greeting the world. Please analyze the transcript and create a visual plan. Go ahead and plan it — you have my approval to proceed.",
    "conversationHistory": [],
    "projectContext": {
      "canvasWidth": 1080,
      "canvasHeight": 1920,
      "fps": 30,
      "durationMs": 30000,
      "hasTranscript": true,
      "theme": "studio-dark",
      "projectType": "video"
    }
  }'
```

- [ ] **Step 2: Verify planner output**

After the stream completes:

```bash
# Check if SCENE_PLAN.md was created
docker exec sandbox-test cat /workspace/docs/SCENE_PLAN.md

# Check if scenes.json was created
docker exec sandbox-test cat /workspace/scenes.json | jq .

# Check if a scene_plan widget was shown (look in SSE output for event: widget)
```

Expected:
- `SCENE_PLAN.md` exists with beat descriptions, display modes, timing
- `scenes.json` exists with beat array including `sceneFile` and `type` fields
- SSE stream included a `widget` event with `kind: "scene_plan"`

- [ ] **Step 3: Debug planner issues**

Common issues:
- Planner can't read transcript → check `/workspace/docs/transcript.json` exists
- Planner doesn't produce scenes.json → check planner-system.md prompt format
- Widget not shown → planner doesn't have widget tools (correct — orchestrator shows it)
- Planner crashes → check `loadPromptWithShared` loads shared modules

- [ ] **Step 4: Commit fixes**

```bash
git add packages/sandbox/src/
git commit -m "fix(sandbox): resolve planner subagent dispatch issues"
```

---

### Task 9: Test animator subagent dispatch

- [ ] **Step 1: Send a prompt that triggers animation after planning**

Use the previous planner output. Send a follow-up message approving the plan:

```bash
curl -N -s -X POST "$SANDBOX_URL/prompt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "prompt": "The plan looks great! Go ahead and generate all the scenes.",
    "conversationHistory": [
      {"role": "user", "content": "I want to add motion graphics to this video..."},
      {"role": "assistant", "content": "I have created a visual plan with 3 beats..."}
    ],
    "projectContext": {
      "canvasWidth": 1080,
      "canvasHeight": 1920,
      "fps": 30,
      "durationMs": 30000,
      "hasTranscript": true,
      "theme": "studio-dark",
      "projectType": "video"
    }
  }'
```

- [ ] **Step 2: Verify animator output**

```bash
# Check scene files were created
docker exec sandbox-test ls /workspace/src/scenes/
# Expected: HookTitle.tsx (or whatever the planner named them)

# Check bundle rebuilt
docker exec sandbox-test ls -la /workspace/.build/player-composition.cjs.js

# Check manifest has scene items
docker exec sandbox-test cat /workspace/manifest.json | jq '.items[] | select(.type=="scene")'

# Check scene registry
docker exec sandbox-test cat /workspace/src/scene-registry.ts
```

- [ ] **Step 3: Verify scene compiles (tsc check)**

```bash
docker exec sandbox-test npx tsc --noEmit --pretty false 2>&1
# Expected: no errors (or pre-existing ones only)
```

- [ ] **Step 4: Debug and fix any issues**

Common animator issues:
- Scene imports wrong modules → check template node_modules symlink
- Scene uses wrong export pattern → check scene-registry-generator handles it
- esbuild fails → check build output, fix scene code or template config
- Manifest not updated → check orchestrator creates manifest items for animation beats

- [ ] **Step 5: Commit fixes**

```bash
git add packages/sandbox/src/ packages/sandbox/template/
git commit -m "fix(sandbox): resolve animator subagent dispatch issues"
```

---

## Chunk 4: Test Verification Loop & Full Pipeline

### Task 10: Test verifier and healer subagents

- [ ] **Step 1: Verify render_still works inside container**

```bash
# Try rendering a still at frame 0
docker exec sandbox-test npx remotion still \
  --composition=MainComposition \
  --frame=0 \
  --output=/workspace/.build/still-0.png \
  --cwd=/workspace 2>&1

# Check if PNG was created
docker exec sandbox-test ls -la /workspace/.build/still-0.png
```

If `remotion still` fails, debug:
- Missing Chromium → check Dockerfile installs it
- Composition not found → check `remotion.config.ts` and `Root.tsx`
- Bundle errors → check esbuild output

- [ ] **Step 2: Manually trigger verifier**

Send a prompt asking the orchestrator to verify a scene:

```bash
curl -N -s -X POST "$SANDBOX_URL/prompt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "prompt": "Please verify the scene we just created by rendering a screenshot and checking it against the plan.",
    "conversationHistory": [
      {"role": "user", "content": "I want to add motion graphics to this video."},
      {"role": "assistant", "content": "I created a plan and generated the HookTitle scene."}
    ],
    "projectContext": {
      "canvasWidth": 1080, "canvasHeight": 1920, "fps": 30,
      "durationMs": 30000, "hasTranscript": true,
      "theme": "studio-dark", "projectType": "video"
    }
  }'
```

- [ ] **Step 3: Test healer on intentionally broken code**

Inject a TS error into a scene file, then ask the orchestrator to fix it:

```bash
# Break a scene file
docker exec sandbox-test sh -c 'echo "BROKEN CODE HERE" >> /workspace/src/scenes/HookTitle.tsx'

# Ask orchestrator to fix
curl -N -s -X POST "$SANDBOX_URL/prompt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{
    "prompt": "There seems to be a TypeScript error in the scenes. Can you fix it?",
    "conversationHistory": [
      {"role": "user", "content": "I want to add motion graphics to this video."},
      {"role": "assistant", "content": "I created scenes but there may be errors."}
    ],
    "projectContext": {
      "canvasWidth": 1080, "canvasHeight": 1920, "fps": 30,
      "durationMs": 30000, "hasTranscript": true,
      "theme": "studio-dark", "projectType": "video"
    }
  }'
```

- [ ] **Step 4: Commit fixes**

```bash
git add packages/sandbox/src/
git commit -m "fix(sandbox): resolve verifier/healer subagent issues"
```

---

### Task 11: Full end-to-end test through API layer

**Files:**
- Create: `scripts/temp/test-e2e-pipeline.sh`

- [ ] **Step 1: Start the full stack locally**

Ensure running:
- PostgreSQL (with migrations applied)
- MinIO (with a test video uploaded)
- API server (`packages/api`)
- Frontend (`apps/web`)

- [ ] **Step 2: Create a test project with video**

Via the frontend or API:
1. Create a project
2. Upload a short test video (5-10 seconds)
3. Wait for transcription to complete

- [ ] **Step 3: Open the editor and boot sandbox**

1. Open the project in the editor
2. Open the AI Assistant panel
3. The frontend should auto-boot the sandbox via `POST /projects/:id/sandbox`
4. Wait for sandbox to be ready (check console for WebSocket `workspace-ready` event)

- [ ] **Step 4: Send a generation prompt**

In the AI chat panel, type:
> "Add motion graphics to this video. Make it energetic with bold text animations."

Watch for:
1. Orchestrator responds and asks clarifying questions (or proceeds to planning)
2. Planner dispatched → SCENE_PLAN.md created → scene_plan widget shown
3. Approve the plan
4. Animator dispatched for each beat → scene files created → bundle rebuilds → Player updates live
5. Verifier checks screenshots
6. Orchestrator reports completion

- [ ] **Step 5: Verify the final output**

1. Player shows the generated scenes overlaid on the video
2. Manifest has correct tracks and items
3. All scene files compile without errors
4. Bundle is valid and renderable

- [ ] **Step 6: Test researcher and trimmer subagents**

During or after generation, test:
- Researcher: Ask "Find a stock photo of a sunset and add it to the timeline" — verify the orchestrator dispatches the researcher subagent, which uses `mcp__assets__search_unsplash` or `mcp__assets__search_pexels` to find and download an image
- Trimmer: Ask "Remove any dead air or silence from the video" — verify the orchestrator dispatches the trimmer subagent, which analyzes the audio and uses manifest tools to cut/split

These may fail if the MCP server API keys (UNSPLASH_ACCESS_KEY, PEXELS_API_KEY) are not set — that's OK for now, just verify the dispatch mechanism works and the error is about missing API keys, not broken wiring.

- [ ] **Step 7: Test refinement (Phase 4)**

Send follow-up messages:
> "Change the colors on the first scene to blue"
> "Make the intro text bigger"
> "Move the second scene to start 2 seconds later"

Verify:
- Simple timing changes use manifest tools directly (fast)
- Visual changes re-dispatch animator (slower but correct)
- Player updates after each change

- [ ] **Step 8: Document any remaining issues**

Create a list of bugs/improvements found during E2E testing for follow-up.

- [ ] **Step 9: Commit all remaining fixes**

```bash
git add packages/sandbox/ packages/api/src/sandbox/ packages/api/src/agent/
git commit -m "fix(sandbox): resolve issues found in full E2E pipeline test"
```

---

## Chunk 5: Cleanup & Production Readiness

### Task 12: Remove test scripts and finalize

- [ ] **Step 1: Clean up test scripts**

Remove test scripts (only delete files that were actually created):
```bash
rm -f scripts/temp/test-sandbox-init.sh
rm -f scripts/temp/test-sandbox-tools.sh
rm -f scripts/temp/test-sandbox-prompt.sh
rm -f scripts/temp/test-sandbox-planner.sh
```

- [ ] **Step 2: Update the design spec status**

Update `docs/superpowers/specs/2026-03-15-sandbox-agent-pipeline-design.md` header:
```markdown
**Status:** Implemented and tested (v2)
```

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore(sandbox): clean up test scripts, mark spec as implemented"
```
