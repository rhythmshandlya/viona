#!/bin/bash
set -e

echo "Setting up WhisperX environment..."
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/3] Creating Python virtual environment..."
python3 -m venv .venv

echo "[2/3] Installing PyTorch with CUDA 12.1..."
if .venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121; then
    echo "CUDA PyTorch installed."
else
    echo "WARNING: CUDA install failed. Falling back to CPU-only PyTorch..."
    .venv/bin/pip install torch torchaudio
fi

echo "[3/3] Installing WhisperX and dependencies..."
.venv/bin/pip install "whisperx @ git+https://github.com/m-bain/whisperX.git"

echo
echo "WhisperX setup complete!"
echo "Python: $SCRIPT_DIR/.venv/bin/python"
