#!/bin/bash
# Build the OpenHands sandbox Docker image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building clipify-openhands-sandbox image..."

docker build -t clipify-openhands-sandbox:latest .

echo ""
echo "Build complete!"
echo "Image: clipify-openhands-sandbox:latest"
echo ""
echo "To test the image:"
echo "  docker run --rm -it clipify-openhands-sandbox:latest python --version"
