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
RUN pnpm install --frozen-lockfile --filter @viona/worker...

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
RUN pnpm --filter @viona/shared build && \
    pnpm --filter @viona/renderer build && \
    pnpm --filter @viona/worker build

# ============================================
# Production stage
# ============================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV RAILWAY_ENVIRONMENT=true

# Install Python 3.10+ for Claude Agent SDK, FFmpeg, fonts, and Chrome dependencies for Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    unzip \
    # Chrome/Chromium dependencies for Remotion headless rendering
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install fonts used by subtitle presets
# Inter from GitHub releases (more reliable than Google Fonts API)
RUN mkdir -p /usr/share/fonts/truetype/inter && \
    curl -L "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -o /tmp/inter.zip && \
    unzip /tmp/inter.zip -d /tmp/inter && \
    find /tmp/inter -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/inter/ \; && \
    rm -rf /tmp/inter /tmp/inter.zip

# Google Fonts used by presets — download via CSS API (fonts.gstatic.com TTF URLs).
# The old fonts.google.com/download?family=X URLs are BROKEN (return HTML, not ZIP).
# We fetch the CSS with a non-browser User-Agent to get direct TTF links.
RUN mkdir -p /usr/share/fonts/truetype/google && \
    for FONT_QUERY in \
      "Montserrat:wght@400;500;600;700;800;900" \
      "Poppins:wght@400;500;600;700;800;900" \
      "Anton" \
      "Nunito:wght@400;600;700;800;900" \
      "Playfair+Display:wght@400;500;600;700;800;900" \
      "JetBrains+Mono:wght@400;500;600;700;800" \
      "Rubik:wght@400;500;600;700;800;900" \
      "Lora:wght@400;500;600;700" \
      "Merriweather:wght@400;700;900" \
      "Bebas+Neue" \
      "Space+Grotesk:wght@400;500;600;700" \
      "DM+Sans:wght@400;500;600;700" \
      "Outfit:wght@400;500;600;700;800" \
      "Fira+Code:wght@400;500;600;700" \
      "Source+Sans+3:wght@400;600;700" \
      "Roboto:wght@400;500;700" \
      "Oswald:wght@400;500;600;700" \
      "Lato:wght@400;700;900" \
      "Open+Sans:wght@400;500;600;700;800" \
      "EB+Garamond:wght@400;500;600;700;800" \
    ; do \
      CSS=$(curl -sL "https://fonts.googleapis.com/css2?family=${FONT_QUERY}&display=swap" -H "User-Agent: wget/1.0") && \
      echo "$CSS" | grep -o 'https://fonts\.gstatic\.com/[^)]*\.ttf' | while read -r TTF_URL; do \
        FILENAME=$(echo "$TTF_URL" | md5sum | cut -d' ' -f1).ttf && \
        curl -sL "$TTF_URL" -o "/usr/share/fonts/truetype/google/${FILENAME}"; \
      done; \
    done && \
    fc-cache -fv

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
RUN pnpm install --frozen-lockfile --filter @viona/worker... --prod

# Install Claude Code CLI globally for visual generation OAuth
RUN npm install -g @anthropic-ai/claude-code

# Copy built files
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist
# Copy agents folder to where the compiled JS expects it (../agents from dist/)
COPY --from=builder /app/packages/worker/src/agents ./packages/worker/agents
COPY --from=builder /app/packages/worker/scripts ./packages/worker/scripts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/renderer/dist ./packages/renderer/dist
# Copy renderer source files for Remotion bundler (remotion-entry.tsx, components, animations)
# Remotion's bundle() needs the original TSX files to create the browser bundle
COPY --from=builder /app/packages/renderer/src ./packages/renderer/src

# Copy remotion template (source only, deps installed on first use)
COPY --from=builder /app/packages/worker/remotion-template/package.json ./packages/worker/remotion-template/
COPY --from=builder /app/packages/worker/remotion-template/package-lock.json ./packages/worker/remotion-template/
COPY --from=builder /app/packages/worker/remotion-template/tsconfig.json ./packages/worker/remotion-template/
COPY --from=builder /app/packages/worker/remotion-template/remotion.config.ts ./packages/worker/remotion-template/
COPY --from=builder /app/packages/worker/remotion-template/postcss.config.mjs ./packages/worker/remotion-template/
COPY --from=builder /app/packages/worker/remotion-template/src ./packages/worker/remotion-template/src
# Copy .claude directory with CLAUDE.md and skills
COPY --from=builder /app/packages/worker/remotion-template/.claude ./packages/worker/remotion-template/.claude

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker

# Create directories with correct permissions
RUN mkdir -p /tmp/workspace /tmp/template /tmp/bundles /home/worker && \
    chown -R worker:nodejs /tmp/workspace /tmp/template /tmp/bundles /home/worker

# Create .remotion cache directory with correct permissions for Remotion bundler
RUN mkdir -p /app/packages/worker/node_modules/.remotion && \
    chown -R worker:nodejs /app/packages/worker/node_modules/.remotion

# Set home directory for npm cache
ENV HOME="/home/worker"

USER worker

WORKDIR /app/packages/worker

# Set Python path for Claude Agent SDK
ENV PYTHON_PATH="/opt/venv/bin/python3"
# Set template path to bundled template (skips S3 download)
ENV WORKSPACE_TEMPLATE_PATH="/app/packages/worker/remotion-template"

CMD ["node", "dist/index.js"]
