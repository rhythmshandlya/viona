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
# PRE-BAKE REMOTION DEPENDENCIES
# This ensures the workspace is ready immediately without network calls
# =============================================================================

# Create the Remotion project template with pre-installed dependencies
WORKDIR /opt/remotion-template

# Copy package.json and install dependencies during build
COPY templates/remotion-project/package.json ./package.json
COPY templates/remotion-project/tsconfig.json ./tsconfig.json

# Install all Remotion dependencies (this gets cached in the Docker layer)
RUN pnpm install

# Pre-download Remotion's chrome-headless-shell browser
# This avoids the download at runtime
RUN npx remotion browser ensure

# Create src directory with base files
RUN mkdir -p src public
COPY templates/remotion-project/src/index.tsx ./src/index.tsx
COPY templates/remotion-project/src/index.css ./src/index.css
COPY templates/remotion-project/public/.gitkeep ./public/.gitkeep

# =============================================================================
# COPY OPENHANDS FILES
# =============================================================================

# Copy skills and templates
COPY skills/ /opt/openhands/skills/
COPY templates/ /opt/openhands/templates/
COPY AGENTS.md /opt/openhands/AGENTS.md

# Copy custom tools package
COPY tools/ /opt/openhands/tools/

# Copy tests
COPY tests/ /opt/openhands/tests/

# Copy agent script
COPY visual_generator.py /opt/openhands/visual_generator.py

# Create entrypoint script
COPY entrypoint.sh /opt/openhands/entrypoint.sh
RUN chmod +x /opt/openhands/entrypoint.sh

# Set working directory to workspace (will be mounted as volume)
WORKDIR /workspace

# Environment variables
ENV PYTHONPATH="/opt/openhands"
ENV REMOTION_PROJECT_DIR=/workspace
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Chrome flags for Docker environment
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"

ENTRYPOINT ["/opt/openhands/entrypoint.sh"]
