# Stage 1: Build TypeScript
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Copy shared prompt modules from worker
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
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy compiled JS from builder
COPY --from=builder /app/dist/ /app/dist/

# Copy shared prompt modules
COPY --from=builder /app/prompts/shared/ /app/prompts/shared/

# Copy orchestrator prompt .md files
COPY --from=builder /app/dist/prompts/ /app/dist/prompts/

# Copy template files (composition infrastructure, .claude/, configs)
COPY template/ /app/template/

# Workspace will be mounted as a volume at /workspace
VOLUME /workspace

EXPOSE 8080 8081
CMD ["node", "dist/entry.js"]
