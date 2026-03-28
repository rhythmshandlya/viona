# Sandbox Railway Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the sandbox pipeline to deploy on Railway by building sandbox services from the GitHub repo (no external registry), fixing internal networking, and updating config/docs.

**Architecture:** The Railway provider currently uses `source: { image }` which requires pushing to an external Docker registry. We change to `source: { repo }` so Railway builds the sandbox from the GitHub repo's `packages/sandbox/Dockerfile`. After `serviceCreate`, we call `serviceInstanceUpdate` to set the Dockerfile path, then deploy. We also fix internal networking to prefer `RAILWAY_PRIVATE_DOMAIN` over the public domain.

**Tech Stack:** TypeScript, Railway GraphQL API, Fastify, Docker

---

### Task 1: Update config.ts with sandbox repo settings

**Files:**
- Modify: `packages/api/src/config.ts:94-108`

- [ ] **Step 1: Add repo/branch config and fix callback URL helper**

Replace the sandbox config block (lines 94-108) with:

```typescript
  // Sandbox configuration
  sandbox: {
    provider: (process.env.SANDBOX_PROVIDER || 'docker') as 'railway' | 'docker',
    image: process.env.SANDBOX_IMAGE || 'viona-sandbox:latest',
    idleTimeoutMs: parseInt(process.env.SANDBOX_IDLE_TIMEOUT_MS || '600000', 10),  // 10 min
    checkpointIntervalMs: parseInt(process.env.SANDBOX_CHECKPOINT_MS || '60000', 10),  // 60s
    maxConcurrent: parseInt(process.env.SANDBOX_MAX_CONCURRENT || '100', 10),
    reconnectionGraceMs: 30_000,  // 30s grace period before idle timer starts
    // Railway-specific (production)
    railway: {
      apiToken: process.env.RAILWAY_API_TOKEN || '',
      projectId: process.env.RAILWAY_PROJECT_ID || '',
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '',
      repo: process.env.SANDBOX_REPO || 'rhythmshandlya/clippify',
      branch: process.env.SANDBOX_BRANCH || 'main',
    },
    /** Callback URL that sandbox containers use to reach this API instance. */
    get callbackUrl(): string {
      if (process.env.RAILWAY_PRIVATE_DOMAIN) {
        return `http://${process.env.RAILWAY_PRIVATE_DOMAIN}`;
      }
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
      }
      return process.env.API_CALLBACK_URL || `http://host.docker.internal:4000`;
    },
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/config.ts
git commit -m "feat(api): add sandbox repo/branch config and callbackUrl helper"
```

---

### Task 2: Update railway.ts to build from GitHub repo

**Files:**
- Modify: `packages/api/src/sandbox/railway.ts`

- [ ] **Step 1: Change serviceCreate to use repo source**

Replace the `serviceCreate` mutation block (lines 34-47) with:

```typescript
      // 1. Create service from GitHub repo
      const serviceResult = await railwayGql(`
        mutation($input: ServiceCreateInput!) {
          serviceCreate(input: $input) { id name }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          name: `sandbox-${projectId.slice(0, 8)}`,
          source: config.sandbox.image !== 'viona-sandbox:latest'
            ? { image: config.sandbox.image }
            : { repo: config.sandbox.railway.repo },
          branch: config.sandbox.railway.branch,
        },
      });
      serviceId = serviceResult.serviceCreate.id;

      // 1b. Configure build settings (Dockerfile path, root directory)
      await railwayGql(`
        mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
          serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
        }
      `, {
        serviceId,
        environmentId: config.sandbox.railway.environmentId,
        input: {
          dockerfilePath: 'packages/sandbox/Dockerfile',
          healthcheckPath: '/health',
          healthcheckTimeout: 60,
          restartPolicyType: 'ON_FAILURE',
          restartPolicyMaxRetries: 3,
        },
      });
```

- [ ] **Step 2: Fix API_CALLBACK_URL to use config helper**

Replace line 53:
```typescript
        API_CALLBACK_URL: process.env.RAILWAY_INTERNAL_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
```
With:
```typescript
        API_CALLBACK_URL: config.sandbox.callbackUrl,
```

- [ ] **Step 3: Increase health check timeout for builds**

Replace the waitForReady call on line 159:
```typescript
      await this.waitForReady(internalUrl, 120_000);
```
With:
```typescript
      // Repo-based builds take longer than image pulls — 5 min timeout
      await this.waitForReady(internalUrl, 300_000);
```

Also update the volume instance polling loop (line 105) from 60 iterations to 150:
```typescript
      for (let i = 0; i < 150; i++) {
```

And update the error message (line 123-125):
```typescript
      if (!volumeInstanceId) {
        throw new Error('Volume instance not created after 300s');
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/sandbox/railway.ts
git commit -m "feat(sandbox): deploy from GitHub repo instead of Docker registry"
```

---

### Task 3: Update deployment docs

**Files:**
- Modify: `docs/RAILWAY_DEPLOYMENT.md`

- [ ] **Step 1: Add sandbox section to deployment guide**

Add a new section after the Worker Service section (after line ~83). Insert:

```markdown
### Sandbox Pipeline (Dynamic)

The sandbox is **not** a static Railway service — the API dynamically creates sandbox services on-demand via Railway's GraphQL API. Each project gets its own ephemeral container + persistent volume.

**Required API service env vars for sandbox:**

| Variable | Description | Required |
|----------|-------------|----------|
| `SANDBOX_PROVIDER` | Set to `railway` for production | Yes |
| `SANDBOX_REPO` | GitHub repo name (default: `rhythmshandlya/clippify`) | No |
| `SANDBOX_BRANCH` | Git branch to build from (default: `main`) | No |
| `RAILWAY_API_TOKEN` | Railway API token (Account → Tokens) | Yes |
| `RAILWAY_PROJECT_ID` | Railway project ID | Yes (auto-injected) |
| `RAILWAY_ENVIRONMENT_ID` | Railway environment ID | Yes |
| `ANTHROPIC_API_KEY` | Passed to sandbox containers for Claude Agent SDK | Yes |

**How it works:**
1. User opens a project in the editor → API calls Railway's `serviceCreate` with `source: { repo }`
2. Railway builds the sandbox from `packages/sandbox/Dockerfile`
3. A volume is mounted at `/workspace` for the project files
4. After 10 min idle, the sandbox is suspended (volume backed up, service destroyed)
5. On next open, the volume is restored from backup

**Optimization (optional):** For faster sandbox creation (~30s vs ~3-5min), push the sandbox image to GHCR and set `SANDBOX_IMAGE=ghcr.io/<user>/viona-sandbox:latest` on the API service.
```

- [ ] **Step 2: Update architecture diagram**

Replace the architecture diagram at the top (lines 7-17) with:

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Railway Project                            │
├─────────────┬─────────────┬─────────────┬──────────────────┬────────┤
│   Web App   │   API       │   Worker    │  Infrastructure  │Sandbox │
│  (Next.js)  │  (Fastify)  │  (Node+Py)  │                  │(dynamic│
│   Port 3000 │  Port 4000  │   No port   │  PostgreSQL      │ per-   │
│             │             │             │  Redis           │project)│
│             │             │             │  Storage Bucket  │        │
└─────────────┴─────────────┴─────────────┴──────────────────┴────────┘
```

- [ ] **Step 3: Add sandbox env vars to API Environment Variables table**

In the Environment Variables Reference section, add to the API Service table:

```markdown
| `SANDBOX_PROVIDER` | `railway` for production | Yes (prod) |
| `RAILWAY_API_TOKEN` | Railway API token for sandbox management | Yes (prod) |
| `RAILWAY_ENVIRONMENT_ID` | Railway environment ID | Yes (prod) |
| `ANTHROPIC_API_KEY` | Claude API key (passed to sandboxes) | Yes |
```

- [ ] **Step 4: Commit**

```bash
git add docs/RAILWAY_DEPLOYMENT.md
git commit -m "docs: add sandbox pipeline to Railway deployment guide"
```

---

### Task 4: Update deploy script

**Files:**
- Modify: `scripts/deploy.ps1`

- [ ] **Step 1: Add sandbox env var reminder to deploy script**

Add after the deploy services section (after line 47):

```powershell
Write-Host "`n🔧 Sandbox Pipeline:" -ForegroundColor Cyan
Write-Host "   Sandbox services are created dynamically by the API." -ForegroundColor White
Write-Host "   Ensure these env vars are set on the API service:" -ForegroundColor White
Write-Host "     SANDBOX_PROVIDER=railway" -ForegroundColor Gray
Write-Host "     RAILWAY_API_TOKEN=<your-token>" -ForegroundColor Gray
Write-Host "     RAILWAY_ENVIRONMENT_ID=<env-id>" -ForegroundColor Gray
Write-Host "     ANTHROPIC_API_KEY=<your-key>" -ForegroundColor Gray
```

- [ ] **Step 2: Commit**

```bash
git add scripts/deploy.ps1
git commit -m "docs(deploy): add sandbox env var reminders to deploy script"
```

---

### Task 5: Build and verify locally

- [ ] **Step 1: Build the entire API package**

Run: `cd packages/api && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify sandbox Dockerfile builds (optional sanity check)**

Run: `docker build -f packages/sandbox/Dockerfile -t viona-sandbox:test .`
Expected: Image builds successfully (confirms the Dockerfile path is correct)

- [ ] **Step 3: Final commit with all changes**

If any uncommitted changes remain, commit them.

---

### Task 6: Deploy to Railway

This task is manual — requires Railway CLI and credentials.

- [ ] **Step 1: Set environment variables on Railway API service**

Via Railway dashboard or CLI, set on the **API** service:
```
SANDBOX_PROVIDER=railway
RAILWAY_API_TOKEN=<generate at railway.com → Account → Tokens>
RAILWAY_ENVIRONMENT_ID=<from Railway dashboard URL or API>
ANTHROPIC_API_KEY=<your Anthropic key>
```

- [ ] **Step 2: Push changes and deploy**

```bash
git push origin feat/agent-pipeline-overhaul
# Then deploy via Railway dashboard or CLI
```

- [ ] **Step 3: Verify sandbox creation**

Open a project in the editor. The API should:
1. Call Railway API to create a sandbox service
2. Railway builds from `packages/sandbox/Dockerfile`
3. Sandbox becomes ready, editor shows preview
