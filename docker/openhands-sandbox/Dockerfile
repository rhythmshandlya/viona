# OpenHands Sandbox for Clipify Visual Generation
# Optimized for running AI agents that generate Remotion code
# With iterative refinement feedback loop

FROM python:3.12-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Node.js and npm
    curl \
    # Downloading assets
    wget \
    # Git for version control
    git \
    # Linux dependencies for chrome-headless-shell (required by Remotion)
    # See: https://www.remotion.dev/docs/miscellaneous/linux-dependencies
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libgbm-dev \
    libcups2 \
    libcairo2 \
    libpango-1.0-0 \
    libatk-bridge2.0-0 \
    # Fonts for rendering - comprehensive font collection
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fonts-roboto \
    fonts-open-sans \
    fontconfig \
    # Build tools
    build-essential \
    # Base64 encoding for image transfer
    coreutils \
    # JSON processing
    jq \
    # Image manipulation
    imagemagick \
    # Unzip/archive handling
    unzip \
    zip \
    # Patch command for diff patching
    patch \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and Remotion CLI globally
RUN npm install -g pnpm @remotion/cli typescript

# Install OpenHands SDK and LLM dependencies
RUN pip install --no-cache-dir \
    openhands-sdk \
    openhands-tools \
    litellm \
    google-generativeai \
    anthropic \
    openai \
    pydantic \
    pytest

# =============================================================================
# PRE-BAKE REMOTION PROJECT
# Install dependencies inside Docker (not from Windows node_modules)
# =============================================================================

WORKDIR /opt/remotion-template

# Copy only package files (not node_modules - they're platform-specific)
COPY templates/openhands-sandbox/package.json ./
COPY templates/openhands-sandbox/tsconfig.json ./

# Install dependencies inside Docker (for Linux)
# Using npm install since package-lock.json may not exist
RUN npm install

# Copy source files
COPY templates/openhands-sandbox/src/ ./src/
COPY templates/openhands-sandbox/public/ ./public/
COPY templates/openhands-sandbox/remotion.config.ts ./
COPY templates/openhands-sandbox/eslint.config.mjs ./
COPY templates/openhands-sandbox/postcss.config.mjs ./

# Pre-download Remotion's chrome-headless-shell browser
RUN npx remotion browser ensure

# Verify TypeScript compiles
RUN npx tsc --noEmit

# =============================================================================
# PRE-WARM WEBPACK BUNDLE CACHE
# The first Remotion render is slow because Webpack needs to bundle everything.
# By doing a render during Docker build, we warm up the Webpack cache in
# node_modules/.cache, which persists in the Docker image.
# Subsequent renders (even with different compositions) are much faster.
# =============================================================================
RUN echo "Pre-warming Webpack bundle cache..." && \
    npx remotion still ./src/index.ts placeholder /tmp/prewarm.png --frame=0 --log=error 2>&1 || true && \
    rm -f /tmp/prewarm.png && \
    echo "Webpack cache warmed"

# =============================================================================
# COPY OPENHANDS FILES
# =============================================================================

# Copy skills
COPY skills/ /opt/openhands/skills/

# Copy custom tools package
COPY tools/ /opt/openhands/tools/

# Copy tests
COPY tests/ /opt/openhands/tests/

# Copy agent script
COPY visual_generator.py /opt/openhands/visual_generator.py

# Copy entrypoint script
COPY entrypoint.sh /opt/openhands/entrypoint.sh
RUN chmod +x /opt/openhands/entrypoint.sh

# Create output directory for bundle export (this is what gets mounted)
RUN mkdir -p /output

# Working directory is the internal Remotion project (NOT mounted)
WORKDIR /opt/remotion-template

# Environment variables
ENV PYTHONPATH="/opt/openhands"
ENV REMOTION_PROJECT_DIR="/opt/remotion-template"
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Chrome flags for Docker environment
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"

ENTRYPOINT ["/opt/openhands/entrypoint.sh"]
