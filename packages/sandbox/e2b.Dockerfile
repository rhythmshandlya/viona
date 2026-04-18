# E2B sandbox template — optimized fork of packages/sandbox/Dockerfile
# Differences vs Dockerfile:
#   - Swaps Debian `chromium` apt pkg for Chrome Headless Shell (pre-fetched via Remotion)
#   - Drops python3, unzip (unused at runtime)
#   - Drops Docker HEALTHCHECK (E2B uses its own readiness probe)
#   - Bumps base node:20-slim -> node:22-bookworm-slim

# Stage 1: Build sandbox TypeScript
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN sed -i '/"@viona\/shared"/d' package.json && npm install

COPY packages/sandbox/tsconfig.json ./
COPY packages/sandbox/src/ ./src/

RUN mkdir -p node_modules/@viona/shared && \
    printf '{"name":"@viona/shared","version":"0.0.0","exports":{"./progress-types":{"types":"./progress-types.d.ts"},"./progress-types.js":{"types":"./progress-types.d.ts"}}}\n' > node_modules/@viona/shared/package.json && \
    printf 'export interface AgentSubtask { id: string; title: string; status: string; tools?: string[]; }\nexport interface AgentTask { id: string; title: string; status: string; agent?: string; subtasks?: AgentSubtask[]; }\nexport interface AgentPlan { title: string; tasks: AgentTask[]; }\nexport interface ProgressPayload { phase: string; percent?: number; message: string; agentName?: string; trackName?: string; estimatedTimeRemaining?: number; }\n' > node_modules/@viona/shared/progress-types.d.ts

RUN npx tsc

RUN find src/prompts -type f \( -name '*.md' -o -name '*.xml' \) ! -name '*.old' \
    -exec sh -c 'dest="dist/${1#src/}" && mkdir -p "$(dirname "$dest")" && cp "$1" "$dest"' _ {} \;

COPY packages/worker/src/prompts/composition.md /app/prompts/composition.md
COPY packages/worker/src/prompts/strategies/ /app/prompts/strategies/
COPY packages/worker/src/prompts/themes/ /app/prompts/themes/

# Stage 1b: Build MCP servers
FROM node:22-bookworm-slim AS mcp-builder

WORKDIR /mcp
COPY packages/mcp-servers/package.json packages/mcp-servers/package-lock.json* ./
RUN npm install

COPY packages/mcp-servers/tsconfig.json ./
COPY packages/mcp-servers/src/ ./src/
RUN npx tsc

# Stage 2: Production image
FROM node:22-bookworm-slim

# Chrome Headless Shell shared libs (replaces Debian `chromium` pkg — saves ~400MB)
# + ffmpeg, git (checkpoint), gosu (entrypoint privilege drop)
# + fonts-liberation for basic font rendering in Remotion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    fonts-liberation \
    git \
    gosu \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libgbm-dev \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon-dev \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user early so --chown on COPY avoids expensive recursive chown
RUN groupadd -r sandbox && useradd -r -g sandbox -m -s /bin/bash sandbox

WORKDIR /app

# Install production dependencies only (strip type-only workspace dep)
COPY --chown=sandbox:sandbox packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN sed -i '/"@viona\/shared"/d' package.json && npm install --omit=dev && chown -R sandbox:sandbox node_modules

# Install Claude Code CLI (required by @anthropic-ai/claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install MCP dependencies (use node directly, not .CMD shims)
RUN npm install -g mcp-remote better-icons

# Copy compiled JS from builder
COPY --chown=sandbox:sandbox --from=builder /app/dist/ /app/dist/

# Copy composition rules and genre strategies
COPY --chown=sandbox:sandbox --from=builder /app/prompts/composition.md /app/prompts/composition.md
COPY --chown=sandbox:sandbox --from=builder /app/prompts/strategies/ /app/prompts/strategies/
COPY --chown=sandbox:sandbox --from=builder /app/prompts/themes/ /app/prompts/themes/

# Copy MCP server compiled files
COPY --chown=sandbox:sandbox --from=mcp-builder /mcp/dist/ /app/mcp-servers/
COPY --chown=sandbox:sandbox packages/mcp-servers/package.json /app/mcp-servers/
RUN cd /app/mcp-servers && npm install --omit=dev && chown -R sandbox:sandbox /app/mcp-servers/node_modules

# Copy template files (composition infrastructure, .claude/, configs)
COPY --chown=sandbox:sandbox packages/sandbox/template/ /app/template/

# Install workspace template dependencies + pre-fetch Chrome Headless Shell
# (avoids first-render download; Remotion caches into node_modules)
RUN cd /app/template && npm install && \
    npx remotion browser ensure && \
    chown -R sandbox:sandbox /app/template/node_modules /home/sandbox/.cache 2>/dev/null || true

# Workspace dir (E2B provides the filesystem; no external volume needed)
# chmod 777 so the process runs fine as either root (gosu->sandbox) or E2B's `user`
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace && chmod 777 /workspace

# Entrypoint fixes workspace permissions then drops to sandbox user
COPY --chown=sandbox:sandbox packages/sandbox/entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Config baked into the template at build time because E2B's snapshot-restore
# model freezes PID 1's env — envs injected via Sandbox.create() only reach
# NEW child processes, not the already-running start_cmd. For a test/dev
# deployment, baking deployment-specific config here is acceptable; for
# stricter production use, switch to passing config in the /init request body.
ARG SANDBOX_SECRET=""
ARG MINIO_ENDPOINT=""
ARG MINIO_PORT="443"
ARG MINIO_USE_SSL="true"
ARG MINIO_ACCESS_KEY=""
ARG MINIO_SECRET_KEY=""
ARG MINIO_BUCKET="cllipify"
ARG MINIO_PUBLIC_ENDPOINT=""
ARG MINIO_PUBLIC_PORT="443"
ARG MINIO_PUBLIC_USE_SSL="true"
ARG API_CALLBACK_URL=""

ENV SANDBOX_SECRET=$SANDBOX_SECRET \
    MINIO_ENDPOINT=$MINIO_ENDPOINT \
    MINIO_PORT=$MINIO_PORT \
    MINIO_USE_SSL=$MINIO_USE_SSL \
    MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY \
    MINIO_SECRET_KEY=$MINIO_SECRET_KEY \
    MINIO_BUCKET=$MINIO_BUCKET \
    MINIO_PUBLIC_ENDPOINT=$MINIO_PUBLIC_ENDPOINT \
    MINIO_PUBLIC_PORT=$MINIO_PUBLIC_PORT \
    MINIO_PUBLIC_USE_SSL=$MINIO_PUBLIC_USE_SSL \
    API_CALLBACK_URL=$API_CALLBACK_URL \
    API_INTERNAL_URL=$API_CALLBACK_URL

EXPOSE 8080 8081
CMD ["/app/entrypoint.sh"]
