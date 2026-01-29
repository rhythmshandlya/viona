#!/bin/bash
set -e

echo "=== Clipify Visual Generation Sandbox ==="
echo "Initializing workspace..."

# Copy pre-baked Remotion project to workspace (with node_modules!)
# This is instant because we're copying from the Docker image, not downloading
if [ ! -f "/workspace/package.json" ]; then
    echo "Setting up Remotion project with pre-installed dependencies..."
    cp -r /opt/remotion-template/* /workspace/
    cp -r /opt/remotion-template/node_modules /workspace/
    # Ensure public folder exists for static assets
    mkdir -p /workspace/public
    echo "✓ Remotion dependencies ready (pre-baked)"
else
    # Workspace already has package.json, but might be missing node_modules
    if [ ! -d "/workspace/node_modules" ]; then
        echo "Copying pre-baked node_modules..."
        cp -r /opt/remotion-template/node_modules /workspace/
        echo "✓ Dependencies restored"
    fi
    # Ensure src/index.css exists
    if [ ! -f "/workspace/src/index.css" ]; then
        cp /opt/remotion-template/src/index.css /workspace/src/
    fi
    # Ensure public folder exists
    mkdir -p /workspace/public
fi

# Copy skills to workspace if not present
if [ ! -d "/workspace/.openhands" ]; then
    mkdir -p /workspace/.openhands
    cp -r /opt/openhands/skills /workspace/.openhands/
fi

# Copy AGENTS.md if not present
if [ ! -f "/workspace/AGENTS.md" ]; then
    cp /opt/openhands/AGENTS.md /workspace/
fi

# Copy Remotion config for Docker environment
if [ ! -f "/workspace/remotion.config.ts" ]; then
    cp /opt/openhands/templates/remotion.config.ts /workspace/
fi

# Verify TypeScript can resolve dependencies
echo "Verifying TypeScript setup..."
if [ -f "/workspace/node_modules/react/package.json" ]; then
    echo "✓ React types available"
else
    echo "⚠ React not found, copying from template..."
    cp -r /opt/remotion-template/node_modules /workspace/
fi

if [ -f "/workspace/node_modules/remotion/package.json" ]; then
    echo "✓ Remotion available"
fi

if [ -f "/workspace/node_modules/zod/package.json" ]; then
    echo "✓ Zod available"
fi

echo "=== Workspace ready ==="
echo ""

# Run the visual generator agent
exec python /opt/openhands/visual_generator.py "$@"
