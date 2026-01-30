#!/bin/bash
# Test runner for visual generation agent
# Usage: ./run_test.sh <test_name> <prompt>

set -e

TEST_NAME="${1:-test_$(date +%s)}"
PROMPT="${2:-Create a simple animation showing text 'Hello World' fading in on a dark background}"

# Directories
TEST_DIR="/tmp/clipify-tests/$TEST_NAME"
LOG_FILE="$TEST_DIR/agent.log"
OUTPUT_DIR="$TEST_DIR/output"

# Create directories
mkdir -p "$OUTPUT_DIR"

# Create prompt file
echo "{\"prompt\": \"$PROMPT\"}" > "$TEST_DIR/prompt.json"

echo "=== Running Test: $TEST_NAME ==="
echo "Prompt: $PROMPT"
echo "Log file: $LOG_FILE"
echo ""

# Load API key
if [ -f "packages/worker/.env" ]; then
    export $(grep -v '^#' packages/worker/.env | xargs) 2>/dev/null
fi

# Run Docker container and capture ALL output
docker run --rm \
    -e GEMINI_API_KEY="$GEMINI_API_KEY" \
    -v "$TEST_DIR/prompt.json://tmp/prompt.txt:ro" \
    -v "$OUTPUT_DIR://output" \
    clipify-openhands-sandbox \
    --project-id "$TEST_NAME" \
    --model gemini-2.0-flash \
    --prompt-file "//tmp/prompt.txt" \
    --output-dir "//output" \
    --max-iterations 2 \
    2>&1 | tee "$LOG_FILE"

echo ""
echo "=== Test Complete ==="
echo "Log: $LOG_FILE"
echo "Output: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR/" 2>/dev/null || echo "(no output files)"
