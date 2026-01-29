# Remotion Sandbox for OpenHands
# Custom Docker image with Node.js, Python, Chromium for Remotion screenshot capability

FROM nikolaik/python-nodejs:python3.12-nodejs22

# Install Chromium and dependencies for Remotion screenshots
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xvfb \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Puppeteer/Remotion
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

# Install Remotion CLI globally
RUN npm install -g @remotion/cli@4.0.0

# Install OpenHands SDK
RUN pip install --no-cache-dir openhands-ai

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Default command
CMD ["bash"]
