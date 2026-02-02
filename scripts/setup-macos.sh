#!/bin/bash
set -e

echo "============================================"
echo "  Reelify/Clippify - macOS Setup Script"
echo "============================================"
echo

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."
echo

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo "✓ pnpm: $PNPM_VERSION"
else
    print_warning "pnpm is not installed. Installing..."
    npm install -g pnpm
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Python: $PYTHON_VERSION"
else
    print_error "Python 3 is not installed. Please install Python 3.10+ from https://python.org"
    exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo "✓ Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
else
    print_error "Docker is not installed. Please install Docker Desktop from https://docker.com"
    exit 1
fi

# Check ffmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✓ ffmpeg: installed"
else
    print_warning "ffmpeg is not installed. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        print_error "Homebrew is not installed. Please install ffmpeg manually or install Homebrew first."
        exit 1
    fi
fi

echo
print_step "Installing Node.js dependencies..."
pnpm install

echo
print_step "Starting Docker services (PostgreSQL, Redis, MinIO)..."
docker-compose up -d

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 5

echo
print_step "Creating environment files..."

# Create .env for web
if [ ! -f "apps/web/.env" ]; then
    cp apps/web/.env.example apps/web/.env
    echo "  Created apps/web/.env"
else
    echo "  apps/web/.env already exists"
fi

# Create .env for api
if [ ! -f "packages/api/.env" ]; then
    cp packages/api/.env.example packages/api/.env
    echo "  Created packages/api/.env"
else
    echo "  packages/api/.env already exists"
fi

# Create .env for worker with macOS-specific settings
if [ ! -f "packages/worker/.env" ]; then
    cp packages/worker/.env.example packages/worker/.env
    echo "  Created packages/worker/.env"
else
    echo "  packages/worker/.env already exists"
fi

echo
print_step "Running database migrations..."
pnpm db:migrate

echo
print_step "Setting up WhisperX Python environment..."
cd packages/worker
bash scripts/setup-whisperx.sh
cd "$PROJECT_DIR"

echo
print_step "Setting up audio enhancement Python environment..."
cd packages/worker
bash scripts/setup-enhance.sh
cd "$PROJECT_DIR"

echo
print_step "Building OpenHands sandbox Docker image..."
pnpm docker:build-sandbox || print_warning "Sandbox build failed - visual generation may not work"

echo
echo "============================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "============================================"
echo
echo "To start the development servers, run:"
echo "  pnpm dev"
echo
echo "Or start individual services:"
echo "  pnpm dev:web     # Frontend (http://localhost:3000)"
echo "  pnpm dev:api     # API (http://localhost:4000)"
echo "  pnpm dev:worker  # Background worker"
echo
echo "If using Claude Max for AI visuals, start the proxy:"
echo "  pnpm --filter @reelify/worker proxy"
echo
echo "MinIO Console: http://localhost:9001"
echo "  Username: reelify"
echo "  Password: reelify123"
echo
