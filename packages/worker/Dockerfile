# syntax=docker/dockerfile:1

# ============================================
# Worker Service Dockerfile
# Includes Node.js and Python for Claude Agent SDK
# ============================================

# Base stage with pnpm
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches/

# Copy package.json files for all packages needed
COPY packages/shared/package.json ./packages/shared/
COPY packages/renderer/package.json ./packages/renderer/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @reelify/worker...

# ============================================
# Build stage
# ============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/renderer/node_modules ./packages/renderer/node_modules
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules

# Copy source files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches/
COPY packages/shared ./packages/shared
COPY packages/renderer ./packages/renderer
COPY packages/worker ./packages/worker

# Build packages in order
RUN pnpm --filter @reelify/shared build && \
    pnpm --filter @reelify/renderer build && \
    pnpm --filter @reelify/worker build

# ============================================
# Production stage
# ============================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV RAILWAY_ENVIRONMENT=true

# Install Python 3.10+ for Claude Agent SDK
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment and install Python deps
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python requirements
COPY packages/worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy package files for production install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches/
COPY packages/shared/package.json ./packages/shared/
COPY packages/renderer/package.json ./packages/renderer/
COPY packages/worker/package.json ./packages/worker/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @reelify/worker... --prod

# Copy built files
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist
COPY --from=builder /app/packages/worker/src/agents ./packages/worker/src/agents
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/renderer/dist ./packages/renderer/dist

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# Create directories with correct permissions
RUN mkdir -p /tmp/workspace /tmp/template && \
    chown -R worker:nodejs /tmp/workspace /tmp/template

USER worker

WORKDIR /app/packages/worker

# Set Python path for Claude Agent SDK
ENV PYTHON_PATH="/opt/venv/bin/python3"

CMD ["node", "dist/index.js"]
