# Viona Web App

Next.js 15 frontend for the Viona video editing platform.

## Overview

The web app provides:
- Video upload and project management dashboard
- Timeline-based video editor with multi-track support
- Real-time preview with Remotion Player
- AI visual generation controls and preview
- Creative Director agent sidebar (conversational AI assistant)
- Professional subtitle styling with 15+ animation presets
- Export with configurable layout modes (PiP, split, spatial overlay)

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework (App Router) |
| React 19 | UI library |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling |
| Zustand | State management |
| Remotion | Video composition & preview |
| Radix UI | Accessible components |

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

## Key Directories

```
src/
├── app/                    # Next.js App Router pages
├── features/
│   └── editor-v2/          # Main video editor
│       ├── components/     # Editor UI components
│       ├── store/          # Zustand editor store
│       └── hooks/          # Editor-specific hooks
├── components/             # Shared UI components
│   └── ui/                 # Radix-based primitives
├── lib/                    # Utilities & API client
└── store/                  # Global stores
```
