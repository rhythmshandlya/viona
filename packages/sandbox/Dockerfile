# Stage 1: Build sandbox TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Install deps — strip workspace:* (type-only, erased at compile time)
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN sed -i '/"@viona\/shared"/d' package.json && npm install

COPY packages/sandbox/tsconfig.json ./
COPY packages/sandbox/src/ ./src/

# Stub @viona/shared types (import type only — erased at compile time)
RUN mkdir -p node_modules/@viona/shared && \
    printf '{"name":"@viona/shared","version":"0.0.0","exports":{"./progress-types":{"types":"./progress-types.d.ts"},"./progress-types.js":{"types":"./progress-types.d.ts"}}}\n' > node_modules/@viona/shared/package.json && \
    printf 'export interface AgentSubtask { id: string; title: string; status: string; tools?: string[]; }\nexport interface AgentTask { id: string; title: string; status: string; agent?: string; subtasks?: AgentSubtask[]; }\nexport interface AgentPlan { title: string; tasks: AgentTask[]; }\nexport interface ProgressPayload { phase: string; percent?: number; message: string; agentName?: string; trackName?: string; estimatedTimeRemaining?: number; }\n' > node_modules/@viona/shared/progress-types.d.ts

RUN npx tsc

# Copy prompt files (tsc only compiles .ts, not .md/.xml)
RUN find src/prompts -type f \( -name '*.md' -o -name '*.xml' \) ! -name '*.old' \
    -exec sh -c 'dest="dist/${1#src/}" && mkdir -p "$(dirname "$dest")" && cp "$1" "$dest"' _ {} \;

# Copy shared prompt modules from worker (available because build context is repo root)
COPY packages/worker/src/prompts/shared/ /app/prompts/shared/

# Copy theme files from worker
COPY packages/worker/src/prompts/themes/ /app/prompts/themes/

# Stage 1b: Build MCP servers
FROM node:20-slim AS mcp-builder

WORKDIR /mcp
COPY packages/mcp-servers/package.json packages/mcp-servers/package-lock.json* ./
RUN npm install

COPY packages/mcp-servers/tsconfig.json ./
COPY packages/mcp-servers/src/ ./src/
RUN npx tsc

# Stage 2: Production image
FROM node:20-slim

# System dependencies for Remotion (Chromium), ffmpeg, and Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Remotion
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install production dependencies only (strip type-only workspace dep)
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN sed -i '/"@viona\/shared"/d' package.json && npm install --omit=dev

# Install Claude Code CLI (required by @anthropic-ai/claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install MCP dependencies (use node directly, not .CMD shims)
RUN npm install -g mcp-remote better-icons

# Environment variables for MCP servers (optional):
# FREEPIK_API_KEY — Freepik icon/illustration search
# PEXELS_API_KEY — Pexels stock photo search
# UNSPLASH_ACCESS_KEY — Unsplash stock photo search

# Copy compiled JS from builder
COPY --from=builder /app/dist/ /app/dist/

# Copy shared prompt modules
COPY --from=builder /app/prompts/shared/ /app/prompts/shared/

# Copy theme design system files
COPY --from=builder /app/prompts/themes/ /app/prompts/themes/

# Copy MCP server compiled files
COPY --from=mcp-builder /mcp/dist/ /app/mcp-servers/

# Install MCP server runtime deps alongside the compiled files
COPY packages/mcp-servers/package.json /app/mcp-servers/
RUN cd /app/mcp-servers && npm install --omit=dev

# Copy template files (composition infrastructure, .claude/, configs)
COPY packages/sandbox/template/ /app/template/

# Create non-root user (claude CLI blocks --dangerously-skip-permissions as root)
RUN groupadd -r sandbox && useradd -r -g sandbox -m -s /bin/bash sandbox

# Install gosu for entrypoint privilege drop
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

# Workspace will be mounted as a volume at /workspace
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace
VOLUME /workspace

# Give sandbox user ownership of app files
RUN chown -R sandbox:sandbox /app

# Entrypoint fixes volume permissions then drops to sandbox user
COPY packages/sandbox/entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

EXPOSE 8080 8081
CMD ["/app/entrypoint.sh"]
