#!/bin/bash
set -e

echo "Setting up audio enhancement dependencies..."
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$WORKER_DIR"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS, Architecture: $ARCH"
echo

# Create virtual environment if it doesn't exist
# Prefer Python 3.11 or 3.10 for compatibility
PYTHON_CMD="python3"
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo "Using Python 3.11"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
    echo "Using Python 3.10"
fi

if [ ! -d "venv-enhance" ]; then
  echo "[1/3] Creating Python virtual environment..."
  $PYTHON_CMD -m venv venv-enhance
else
  echo "[1/3] Virtual environment already exists."
fi

echo "[2/3] Upgrading pip..."
venv-enhance/bin/pip install --upgrade pip

echo "[3/3] Installing dependencies..."
# Install PyTorch first with proper backend
if [ "$OS" = "Darwin" ]; then
    echo "Installing PyTorch for macOS..."
    venv-enhance/bin/pip install torch torchaudio
else
    # Linux - try CUDA, fallback to CPU
    if venv-enhance/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 2>/dev/null; then
        echo "CUDA PyTorch installed."
    else
        echo "Installing CPU PyTorch..."
        venv-enhance/bin/pip install torch torchaudio
    fi
fi

# Install remaining requirements
venv-enhance/bin/pip install -r scripts/requirements-enhance.txt

echo
echo "Audio enhancement setup complete!"
echo "Python: $WORKER_DIR/venv-enhance/bin/python"
