# Local Development Setup

Complete guide for setting up Viona on your local machine (Windows, macOS, or Linux).

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | >= 20.0.0 | JavaScript runtime |
| pnpm | >= 9.0.0 | Package manager |
| Docker | Latest | Infrastructure services |
| Python | 3.10+ | Claude Agent SDK, WhisperX |
| FFmpeg | Latest | Audio/video processing |
| Miniconda | Latest | Python environment (recommended) |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/viona.git
cd viona
pnpm install

# 2. Start infrastructure
docker-compose up -d

# 3. Copy environment files
cp .env.example .env
cp packages/api/.env.example packages/api/.env
cp packages/worker/.env.example packages/worker/.env

# 4. Run database migrations
pnpm db:migrate

# 5. Start all services (bucket is auto-created on first API start)
pnpm dev
```

**Access:**
- Web App: http://localhost:3000
- API: http://localhost:4000
- MinIO Console: http://localhost:9001

---

## Detailed Setup

### Step 1: Install Node.js and pnpm

```bash
# Install Node.js 20+ from https://nodejs.org
node --version  # Should be >= 20.0.0

# Install pnpm
npm install -g pnpm
pnpm --version  # Should be >= 9.0.0
```

### Step 2: Install Dependencies

```bash
cd viona
pnpm install
```

### Step 3: Start Infrastructure

Docker Compose provides PostgreSQL, Redis, and MinIO:

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Services:**
| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | 5432 | reelify / reelify123 |
| Redis | 6379 | - |
| MinIO API | 9000 | reelify / reelify123 |
| MinIO Console | 9001 | reelify / reelify123 |

### Step 4: MinIO Bucket (Auto-Created)

The `viona` bucket is **automatically created** when the API starts for the first time.

You can view it in the MinIO Console:
1. Open http://localhost:9001
2. Login with `reelify` / `reelify123`
3. The bucket uses prefixes for organization:
   - `uploads/` - User uploaded videos
   - `outputs/` - Generated outputs (videos, bundles)
   - `templates/` - Remotion template files

### Step 5: Configure Environment

```bash
# Copy example files
cp .env.example .env
cp packages/api/.env.example packages/api/.env
cp packages/worker/.env.example packages/worker/.env
```

Default values work out of the box for local development.

### Step 6: Run Database Migrations

```bash
pnpm db:migrate
```

### Step 7: Start Development Servers

```bash
# Start all services (web, api, worker)
pnpm dev

# Or start individually
pnpm dev:web      # Next.js on port 3000
pnpm dev:api      # Fastify on port 4000
pnpm dev:worker   # Background worker
```

---

## Python Setup (for AI Visual Generation)

The worker requires Python for the Claude Agent SDK which powers AI visual generation.

### Using Miniconda (Recommended)

```bash
# Install Miniconda from https://docs.conda.io/en/latest/miniconda.html

# Create environment
conda create -n viona python=3.10 -y
conda activate viona

# Install dependencies
cd packages/worker
pip install -r requirements.txt
```

Set the Python path in your `.env`:

```bash
# Windows
PYTHON_PATH=C:\Users\<you>\miniconda3\envs\viona\python.exe

# macOS/Linux
PYTHON_PATH=/Users/<you>/miniconda3/envs/viona/bin/python
```

### Using venv (Alternative)

```bash
cd packages/worker

# Create virtual environment
python -m venv .venv

# Activate
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## WhisperX Setup (Local Transcription)

For local transcription (instead of OpenAI API), install WhisperX:

```bash
# Activate your Python environment first
cd packages/worker

# Windows
pnpm run whisperx:setup:win

# macOS/Linux
pnpm run whisperx:setup
```

Or manually:

```bash
pip install -r scripts/requirements.txt
```

**GPU Support (NVIDIA):**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

**Configuration:**
```bash
# In packages/worker/.env
TRANSCRIPTION_MODE=local
WHISPER_MODEL=large-v2
WHISPER_DEVICE=auto
WHISPER_COMPUTE_TYPE=float16
```

---

## Audio Enhancement Setup

For local audio enhancement (noise reduction, loudness normalization):

```bash
# Windows
pnpm run enhance:setup:win

# macOS/Linux
pnpm run enhance:setup
```

**Configuration:**
```bash
# In packages/worker/.env
AUDIO_ENHANCEMENT_ENABLED=true
```

---

## Claude Agent SDK Setup

The worker uses Claude Agent SDK for AI visual generation.

### Get API Key

1. Go to https://console.anthropic.com
2. Create an API key
3. Add to environment:

```bash
# In packages/worker/.env
ANTHROPIC_API_KEY=sk-ant-...
```

### Configuration

```bash
# Model settings (in packages/worker/.env)
CLAUDE_AGENT_MODEL=claude-sonnet-4-20250514
CLAUDE_AGENT_MAX_THINKING_TOKENS=10000
CLAUDE_AGENT_MAX_TURNS=100
CLAUDE_AGENT_TIMEOUT=2700
```

---

## Environment Variables Reference

### Root `.env`

```bash
NODE_ENV=development
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# Storage (MinIO)
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_USE_SSL=false
S3_BUCKET=viona
S3_REGION=us-east-1
```

### API `.env`

```bash
PORT=4000
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# Same S3 settings as root
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_USE_SSL=false
S3_BUCKET=viona
```

### Worker `.env`

```bash
DATABASE_URL=postgresql://reelify:reelify123@localhost:5432/reelify
REDIS_URL=redis://localhost:6379

# Storage
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_USE_SSL=false
S3_BUCKET=viona

# Transcription
TRANSCRIPTION_MODE=local
WHISPER_MODEL=large-v2
WHISPER_LANGUAGE=en
WHISPER_DEVICE=auto

# Audio Enhancement
AUDIO_ENHANCEMENT_ENABLED=true

# Claude Agent SDK
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_AGENT_MODEL=claude-sonnet-4-20250514
```

### Web `.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

---

## Common Issues

### "Bucket not found" Error

The bucket should be auto-created when the API starts. If not:
1. Check MinIO is running: `docker-compose ps`
2. Restart MinIO: `docker-compose restart minio`
3. Restart API: The bucket is created on API startup

### "Python not found" Error

Set `PYTHON_PATH` in `packages/worker/.env`:

```bash
# Windows (Miniconda)
PYTHON_PATH=C:\Users\<you>\miniconda3\envs\viona\python.exe

# macOS/Linux (Miniconda)
PYTHON_PATH=/Users/<you>/miniconda3/envs/viona/bin/python
```

### WhisperX CUDA Errors

If you have an NVIDIA GPU but get CUDA errors:

```bash
# Install CUDA-enabled PyTorch
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Or use CPU mode
WHISPER_DEVICE=cpu
```

### Port Already in Use

```bash
# Find process using port
# Windows
netstat -ano | findstr :4000
# macOS/Linux
lsof -i :4000

# Kill process
# Windows
taskkill /PID <pid> /F
# macOS/Linux
kill -9 <pid>
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps

# Restart if needed
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### MinIO Connection Failed

```bash
# Check MinIO is running
docker-compose ps

# Restart if needed
docker-compose restart minio

# Check logs
docker-compose logs minio
```

---

## Development Workflow

### Starting Fresh

```bash
# Stop everything
docker-compose down
pnpm dev  # Ctrl+C to stop

# Clean and restart
docker-compose down -v  # Remove volumes
docker-compose up -d
pnpm db:migrate
pnpm dev
```

### Rebuilding Packages

```bash
# Build all
pnpm build

# Build specific package
pnpm --filter @viona/shared build
pnpm --filter @viona/api build
pnpm --filter @viona/worker build
pnpm --filter web build
```

### Running Tests

```bash
# Worker tests
cd packages/worker
pnpm test
```

### Database Operations

```bash
# Run migrations
pnpm db:migrate

# Reset database
docker-compose down -v
docker-compose up -d
pnpm db:migrate
```

---

## File Structure

```
viona/
├── .env                          # Root environment
├── .env.example                  # Template
├── docker-compose.yml            # Infrastructure
├── .minio-data/                  # MinIO data (gitignored)
│
├── apps/
│   ├── web/                      # Next.js 15 frontend
│   │   ├── .env.local            # Frontend env
│   │   └── src/
│   │
│   ├── landing/                  # Astro landing page
│   │
│   └── templates/                # Template builder app
│
├── packages/
│   ├── api/                      # Fastify backend
│   │   ├── .env                  # API env
│   │   ├── agent/                # Creative Director agent
│   │   └── src/
│   │
│   ├── worker/                   # Job processor
│   │   ├── .env                  # Worker env
│   │   ├── agents/               # AI agents (visual generator, etc.)
│   │   ├── remotion-template/    # Template files
│   │   ├── workspace/            # Generated projects
│   │   ├── bundles/              # Output bundles
│   │   └── src/
│   │
│   ├── shared/                   # Shared types & storage
│   ├── renderer/                 # Remotion components
│   └── templates/                # Template registry & definitions
│
└── docs/
    ├── LOCAL_SETUP.md            # This file
    ├── RAILWAY_DEPLOYMENT.md     # Production deployment
    └── plans/                    # Feature & architecture plans
```

---

## Extended Troubleshooting

### Windows-Specific Issues

#### PowerShell Execution Policy
```powershell
# If scripts won't run, allow execution:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Long Path Names
Windows has a 260 character path limit. Enable long paths:
```powershell
# Run as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

#### Docker Desktop Not Starting
1. Ensure WSL2 is installed: `wsl --install`
2. Restart Docker Desktop
3. Check Windows features: Hyper-V, WSL2, Containers enabled

#### Line Ending Issues
Git may convert line endings. Fix with:
```bash
git config --global core.autocrlf input
```

### macOS-Specific Issues

#### Xcode Command Line Tools
```bash
xcode-select --install
```

#### Homebrew Python Conflicts
```bash
# Use Miniconda instead of Homebrew Python
brew uninstall python  # Optional
# Install Miniconda from https://docs.conda.io/en/latest/miniconda.html
```

#### Port 5432 Already in Use (Local PostgreSQL)
```bash
# Check what's using the port
lsof -i :5432

# Stop local PostgreSQL
brew services stop postgresql
```

### Linux-Specific Issues

#### Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

#### Missing Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y build-essential python3-dev ffmpeg

# Fedora
sudo dnf install -y gcc python3-devel ffmpeg
```

### Node.js Issues

#### pnpm Install Fails
```bash
# Clear cache and retry
pnpm store prune
rm -rf node_modules
pnpm install
```

#### Memory Issues During Build
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
pnpm build
```

#### Wrong Node Version
```bash
# Install nvm and switch versions
# https://github.com/nvm-sh/nvm
nvm install 20
nvm use 20
```

### Python Issues

#### Wrong Python Version
```bash
# Check version
python --version

# If < 3.10, install newer version
# Use Miniconda or pyenv for version management
```

#### pip Install Permission Denied
```bash
# Use virtual environment instead of system Python
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

#### CUDA Out of Memory
```bash
# Use smaller model
WHISPER_MODEL=base

# Or use CPU mode
WHISPER_DEVICE=cpu
```

### Docker Issues

#### Containers Won't Start
```bash
# Check Docker is running
docker info

# Remove old containers and volumes
docker-compose down -v
docker system prune -f
docker-compose up -d
```

#### MinIO Access Denied
```bash
# Reset MinIO data
docker-compose down
rm -rf .minio-data
docker-compose up -d
```

#### Container Logs
```bash
# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f minio
docker-compose logs -f redis
```

### Visual Generation Issues

#### "Not logged in" Error (Claude CLI)
In production, set these environment variables:
```bash
CLAUDE_OAUTH_ACCESS_TOKEN=your-token
CLAUDE_OAUTH_REFRESH_TOKEN=your-refresh-token
CLAUDE_OAUTH_EXPIRES_AT=timestamp
```

#### Bundle Permission Denied
Check workspace permissions:
```bash
# Development
chmod -R 755 packages/worker/workspace
chmod -R 755 packages/worker/bundles
```

#### TypeScript Errors in Generated Code
The worker has a self-heal phase that automatically fixes TypeScript errors. If it fails:
1. Check the error in worker logs
2. The template may need updates

### Network Issues

#### CORS Errors
Check API CORS configuration in `packages/api/src/index.ts`

#### WebSocket Connection Failed
```bash
# Ensure API is running
curl http://localhost:4000/health

# Check WebSocket URL in web app
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

---

## Docker Compose Variables

You can customize docker-compose with environment variables:

```bash
# In your .env or shell
POSTGRES_PORT=5433          # Default: 5432
POSTGRES_USER=myuser        # Default: reelify
POSTGRES_PASSWORD=mypass    # Default: reelify123
POSTGRES_DB=mydb            # Default: reelify

MINIO_API_PORT=9002         # Default: 9000
MINIO_CONSOLE_PORT=9003     # Default: 9001
MINIO_ROOT_USER=myadmin     # Default: reelify
MINIO_ROOT_PASSWORD=mypass  # Default: reelify123

REDIS_PORT=6380             # Default: 6379
```

---

## Next Steps

1. **Upload a test video** at http://localhost:3000
2. **Process it** to test transcription
3. **Generate visuals** to test Claude Agent SDK
4. **Render** to test video output

For production deployment, see [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md).
