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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @reelify/api...

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
RUN pnpm --filter @reelify/shared build && \
    pnpm --filter @reelify/api build

# ============================================
# Production stage
# ============================================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api
USER api

# Copy built files
COPY --from=builder --chown=api:nodejs /app/packages/api/dist ./dist
COPY --from=builder --chown=api:nodejs /app/packages/api/package.json ./package.json
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/packages/shared/dist ./node_modules/@reelify/shared/dist
COPY --from=builder --chown=api:nodejs /app/packages/shared/package.json ./node_modules/@reelify/shared/package.json

EXPOSE 4000

CMD ["node", "dist/index.js"]
