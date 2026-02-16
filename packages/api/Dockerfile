# syntax=docker/dockerfile:1

# ============================================
# API Service Dockerfile
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
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @viona/api...

# ============================================
# Build stage
# ============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy source files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches/
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Build shared first, then api
RUN pnpm --filter @viona/shared build && \
    pnpm --filter @viona/api build

# ============================================
# Production stage
# ============================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files for production install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches/
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @viona/api... --prod

# Install Claude Code CLI for Creative Director agent (Agent SDK spawns claude subprocess)
RUN npm install -g @anthropic-ai/claude-code

# Copy built files
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api

# Create home directory for claude CLI cache
RUN mkdir -p /home/api && chown -R api:nodejs /home/api
ENV HOME="/home/api"

USER api

WORKDIR /app/packages/api

EXPOSE 4000

CMD ["node", "dist/index.js"]
