# Stage 1: Build TypeScript
FROM node:20-slim AS builder

WORKDIR /app
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN npm install

COPY packages/sandbox/tsconfig.json ./
COPY packages/sandbox/src/ ./src/
RUN npx tsc

# Copy shared prompt modules from worker (available because build context is repo root)
COPY packages/worker/src/prompts/shared/ /app/prompts/shared/

# Stage 2: Production image
FROM node:20-slim

# System dependencies for Remotion (Chromium), ffmpeg, and Python
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Remotion
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install production dependencies only
COPY packages/sandbox/package.json packages/sandbox/package-lock.json* ./
RUN npm install --production

# Copy compiled JS from builder
COPY --from=builder /app/dist/ /app/dist/

# Copy shared prompt modules
COPY --from=builder /app/prompts/shared/ /app/prompts/shared/

# Copy template files (composition infrastructure, .claude/, configs)
COPY packages/sandbox/template/ /app/template/

# Workspace will be mounted as a volume at /workspace
VOLUME /workspace

EXPOSE 8080 8081
CMD ["node", "dist/entry.js"]
