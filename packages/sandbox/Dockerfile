# Stage 1: Build sandbox TypeScript
FROM node:20-slim AS builder

WORKDIR /app
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN npm install

COPY packages/sandbox/tsconfig.json ./
COPY packages/sandbox/src/ ./src/
RUN npx tsc

# Copy prompt .md files (tsc only compiles .ts, not .md)
RUN mkdir -p dist/prompts && cp src/prompts/*.md dist/prompts/

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

# Install production dependencies only
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN npm install --production

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

# Copy MCP server compiled files
COPY --from=mcp-builder /mcp/dist/ /app/mcp-servers/

# Install MCP server runtime deps alongside the compiled files
COPY packages/mcp-servers/package.json /app/mcp-servers/
RUN cd /app/mcp-servers && npm install --production

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
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080 8081
CMD ["/app/entrypoint.sh"]
