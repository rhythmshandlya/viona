#!/bin/bash
set -e

echo "Setting up WhisperX environment..."
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS, Architecture: $ARCH"
echo

echo "[1/4] Creating Python virtual environment..."
# WhisperX requires Python <3.14, prefer 3.11 or 3.10
PYTHON_CMD="python3"
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo "Using Python 3.11"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
    echo "Using Python 3.10"
fi
$PYTHON_CMD -m venv .venv

echo "[2/4] Upgrading pip..."
.venv/bin/pip install --upgrade pip

echo "[3/4] Installing PyTorch..."
if [ "$OS" = "Darwin" ]; then
    # macOS - use default PyTorch (includes MPS support for Apple Silicon)
    echo "Installing PyTorch for macOS..."
    .venv/bin/pip install torch torchaudio
    if [ "$ARCH" = "arm64" ]; then
        echo "Apple Silicon detected - MPS acceleration will be available."
    else
        echo "Intel Mac detected - CPU mode will be used."
    fi
elif [ "$OS" = "Linux" ]; then
    # Linux - try CUDA first, fallback to CPU
    echo "Installing PyTorch with CUDA 12.1..."
    if .venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121; then
        echo "CUDA PyTorch installed."
    else
        echo "WARNING: CUDA install failed. Falling back to CPU-only PyTorch..."
        .venv/bin/pip install torch torchaudio
    fi
else
    echo "Unknown OS. Installing default PyTorch..."
    .venv/bin/pip install torch torchaudio
fi

echo "[4/4] Installing WhisperX and dependencies..."
.venv/bin/pip install "whisperx @ git+https://github.com/m-bain/whisperX.git"

echo
echo "WhisperX setup complete!"
echo "Python: $SCRIPT_DIR/.venv/bin/python"
echo
echo "To use in your .env file, set:"
echo "PYTHON_PATH=$SCRIPT_DIR/.venv/bin/python"
