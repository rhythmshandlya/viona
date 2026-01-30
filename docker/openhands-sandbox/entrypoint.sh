#!/bin/bash
set -e

echo "=== Clipify Visual Generation Sandbox ==="

# =============================================================================
# WORKSPACE: /opt/remotion-template (internal to Docker)
# - node_modules already installed during Docker build
# - Webpack cache pre-warmed during Docker build
# - No copying needed - everything runs on Docker's internal filesystem
#
# MOUNTS:
# - /output: For exporting source files (mounted from host)
# - /bundles: For exporting compiled bundle (mounted from host)
# - /tmp/prompt.txt: Input prompt file (read-only mount)
#
# END GOAL: Agent must produce a working bundle before exiting.
# The bundle is created inside the container and exported to /bundles.
# =============================================================================

WORKSPACE="/opt/remotion-template"
cd "$WORKSPACE"

echo "Workspace: $WORKSPACE (internal)"
echo "✓ Node modules ready (pre-installed)"
echo "✓ Webpack cache ready (pre-warmed)"

# Reset Root.tsx to clean state for each run
# This prevents stale imports from previous agent runs
mkdir -p "$WORKSPACE/src"

cat > "$WORKSPACE/src/Root.tsx" << 'ROOT_EOF'
import "./index.css";
import React from "react";
import { Composition } from "remotion";

// Placeholder composition - will be auto-generated after code generation
const Placeholder: React.FC = () => (
  <div style={{ backgroundColor: '#1a1a2e', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ color: '#fff', fontSize: 32 }}>Waiting for composition...</span>
  </div>
);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="placeholder"
      component={Placeholder}
      durationInFrames={30}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
ROOT_EOF
echo "✓ Root.tsx reset"

# Clean up any old composition directories from previous runs
find "$WORKSPACE/src" -maxdepth 1 -type d -name "proj_*" -exec rm -rf {} \; 2>/dev/null || true

# Copy skills if not present
if [ ! -d "$WORKSPACE/.openhands" ]; then
    mkdir -p "$WORKSPACE/.openhands"
    cp -r /opt/openhands/skills "$WORKSPACE/.openhands/"
fi

# =============================================================================
# PRE-WARM BROWSER
# Webpack is already cached, so this just initializes the browser (~5s)
# =============================================================================
echo "Pre-warming browser..."
PREWARM_START=$(date +%s)

if timeout 60s npx remotion still ./src/index.ts placeholder /tmp/prewarm.png --frame=0 2>&1 | tail -3; then
    PREWARM_END=$(date +%s)
    echo "✓ Browser ready ($((PREWARM_END - PREWARM_START))s)"
    rm -f /tmp/prewarm.png
else
    echo "⚠ Browser pre-warm failed (will retry on first render)"
fi

echo "=== Ready ==="
echo ""

# Run visual generator with internal workspace
# The --workspace argument is handled by the script, defaulting to REMOTION_PROJECT_DIR env var
exec python /opt/openhands/visual_generator.py "$@"
