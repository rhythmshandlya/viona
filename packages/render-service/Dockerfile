# syntax=docker/dockerfile:1

# ============================================
# Render Service Dockerfile
# Headless Remotion video renderer (BullMQ worker)
# Needs full Chrome (H.264 codec) + ffmpeg + fonts
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

# Copy package.json for render-service
COPY packages/render-service/package.json ./packages/render-service/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @viona/render-service...

# ============================================
# Build stage
# ============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/render-service/node_modules ./packages/render-service/node_modules

# Copy source files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/render-service ./packages/render-service

# Build TypeScript
RUN pnpm --filter @viona/render-service build

# ============================================
# Production stage
# ============================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV RAILWAY_ENVIRONMENT=true

# Install ffmpeg, fonts, curl, ca-certs, Chrome deps, and Google Chrome in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    unzip \
    gnupg \
    wget \
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
    && curl -fsSL https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install fonts used by subtitle presets
# Inter from GitHub releases
RUN mkdir -p /usr/share/fonts/truetype/inter && \
    curl -L "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -o /tmp/inter.zip && \
    unzip /tmp/inter.zip -d /tmp/inter && \
    find /tmp/inter -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/inter/ \; && \
    rm -rf /tmp/inter /tmp/inter.zip

# Google Fonts used by presets — download via CSS API (fonts.gstatic.com TTF URLs)
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

# Copy package files for production install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/render-service/package.json ./packages/render-service/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter @viona/render-service... --prod

# Copy built files
COPY --from=builder /app/packages/render-service/dist ./packages/render-service/dist

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 renderworker

# Create tmp directories with correct permissions
RUN mkdir -p /tmp/render-work /home/renderworker && \
    chown -R renderworker:nodejs /tmp/render-work /home/renderworker

ENV HOME="/home/renderworker"

USER renderworker

WORKDIR /app/packages/render-service

CMD ["node", "dist/index.js"]
