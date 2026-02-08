# syntax=docker/dockerfile:1

# ============================================
# Landing Page Dockerfile (Astro Static Site)
# ============================================

# Build stage
FROM node:20-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/landing/package.json ./apps/landing/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter landing

# Copy source files
COPY apps/landing ./apps/landing

# Build the static site
RUN pnpm --filter landing build

# ============================================
# Production stage - Nginx
# ============================================
FROM nginx:alpine AS runner

# Copy nginx config
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
