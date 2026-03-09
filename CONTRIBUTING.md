# Contributing to Viona

Thanks for your interest in contributing! This guide will help you get the project running locally on Windows, macOS, or Linux.

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | >= 20.0.0 | [nodejs.org](https://nodejs.org/) |
| **pnpm** | >= 9.0.0 | `npm install -g pnpm` |
| **Docker** | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |
| **FFmpeg** | Latest | See [FFmpeg Installation](#ffmpeg-installation) |
| **Python** | >= 3.10 | [python.org](https://www.python.org/) (optional, for transcription) |

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/viona.git
cd viona

# 2. Install dependencies
pnpm install

# 3. Copy environment files
cp packages/api/.env.example packages/api/.env
cp packages/worker/.env.example packages/worker/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Start infrastructure (PostgreSQL, Redis, MinIO)
docker compose up -d

# 5. Run database migrations
pnpm db:migrate

# 6. Start development servers
pnpm dev
```

This starts:
- **Web**: http://localhost:3000
- **API**: http://localhost:4000
- **MinIO Console**: http://localhost:9001 (user: `reelify`, pass: `reelify123`)

## Platform-Specific Setup

### Windows

**PowerShell setup:**
```powershell
# Clone and enter directory
git clone https://github.com/your-org/viona.git
cd viona

# Install dependencies
pnpm install

# Copy environment files
Copy-Item packages/api/.env.example packages/api/.env
Copy-Item packages/worker/.env.example packages/worker/.env
Copy-Item apps/web/.env.example apps/web/.env.local

# Start Docker services
docker compose up -d

# Run migrations and start
pnpm db:migrate
pnpm dev
```

**Python virtual environment (Windows):**
```powershell
cd packages/worker/scripts
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Update your `packages/worker/.env`:
```
PYTHON_PATH=./scripts/.venv/Scripts/python.exe
```

### macOS / Linux

**Bash setup:**
```bash
# Clone and enter directory
git clone https://github.com/your-org/viona.git
cd viona

# Install dependencies
pnpm install

# Copy environment files
cp packages/api/.env.example packages/api/.env
cp packages/worker/.env.example packages/worker/.env
cp apps/web/.env.example apps/web/.env.local

# Start Docker services
docker compose up -d

# Run migrations and start
pnpm db:migrate
pnpm dev
```

**Python virtual environment (macOS/Linux):**
```bash
cd packages/worker/scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Update your `packages/worker/.env`:
```
PYTHON_PATH=./scripts/.venv/bin/python
```

## FFmpeg Installation

FFmpeg is required for audio/video processing.

### Windows
```powershell
# Using Chocolatey
choco install ffmpeg

# Or using winget
winget install FFmpeg
```

### macOS
```bash
# Using Homebrew
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

### Linux (Fedora)
```bash
sudo dnf install ffmpeg
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm dev:web` | Start frontend only |
| `pnpm dev:api` | Start API only |
| `pnpm dev:worker` | Start worker only |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm docker:up` | Start Docker infrastructure |
| `pnpm docker:down` | Stop Docker infrastructure |
| `pnpm docker:logs` | View Docker logs |

## Project Structure

```
viona/
├── apps/
│   ├── web/                 # Next.js 15 frontend
│   └── landing/             # Landing page
├── packages/
│   ├── api/                 # Fastify REST API + Creative Director agent
│   ├── worker/              # Background job processors
│   ├── renderer/            # Remotion compositions
│   └── shared/              # Shared TypeScript types
├── docker-compose.yml       # Local infrastructure
└── package.json             # Root workspace config
```

## Environment Variables

All environment variables are documented in the `.env.example` files:

- `packages/api/.env.example` - API server configuration
- `packages/worker/.env.example` - Worker configuration
- `apps/web/.env.example` - Frontend configuration

**Important:** The `BUNDLE_OUTPUT_DIR` must be the same in both API and worker configs.

## Troubleshooting

### Docker Issues

**"Cannot connect to Docker daemon"**
- Ensure Docker Desktop is running
- On Linux, ensure your user is in the `docker` group: `sudo usermod -aG docker $USER`

**Port conflicts**
- PostgreSQL (5432), Redis (6379), MinIO (9000, 9001) must be available
- Stop conflicting services or change ports in `docker-compose.yml`

### Database Issues

**"Connection refused" errors**
- Wait a few seconds after `docker compose up -d` for services to start
- Check Docker logs: `pnpm docker:logs`

**Migration errors**
- Ensure PostgreSQL is running: `docker compose ps`
- Try restarting: `docker compose restart postgres`

### Windows-Specific Issues

**"pnpm: command not found"**
- Restart your terminal after installing pnpm
- Or use: `npx pnpm install`

**Long file paths**
- Enable long paths in Git: `git config --system core.longpaths true`
- Run as Administrator if needed

**Python not found**
- Ensure Python is in your PATH
- Use the full path in `PYTHON_PATH` environment variable

### FFmpeg Issues

**"FFmpeg not found"**
- Ensure FFmpeg is in your system PATH
- Verify installation: `ffmpeg -version`

## Development Workflow

### Creating a Branch

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Making Changes

1. Make your changes
2. Run linting: `pnpm lint`
3. Run type checking: `pnpm typecheck`
4. Test your changes locally

### Submitting a Pull Request

1. Push your branch: `git push origin feature/your-feature-name`
2. Create a Pull Request on GitHub
3. Fill in the PR template
4. Wait for review

## Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript and React
- **Formatting**: Use consistent indentation (2 spaces)
- **Imports**: Use `@/` alias for `src/` directory

## Getting Help

- Open an issue on GitHub
- Check existing issues for solutions
- Read the [README](README.md) for architecture details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
