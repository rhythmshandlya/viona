# @reelify/renderer

Remotion composition library for Cllipify video generation.

## Overview

This package provides:
- Reusable Remotion components for video composition
- Animation presets and utilities
- Shared visual elements (backgrounds, text styles, etc.)

## Exports

### Main (`@reelify/renderer`)
```typescript
import { ... } from '@reelify/renderer';
```

### Animations (`@reelify/renderer/animations`)
```typescript
import { fadeIn, slideUp, scaleIn } from '@reelify/renderer/animations';
```

## Architecture

```
src/
├── index.ts              # Main exports
├── compositions/         # Remotion compositions
├── components/           # Reusable React components
│   ├── backgrounds/      # Background elements
│   ├── text/             # Text and caption components
│   └── shapes/           # Shape primitives
├── animations/
│   └── index.ts          # Animation presets
└── utils/                # Helper utilities
```

## Usage in Compositions

Components from this package are used by the worker's visual generator:

```tsx
import { SubtitleDisplay, AnimatedBackground } from '@reelify/renderer';

export const MyComposition: React.FC = () => {
  return (
    <AbsoluteFill>
      <AnimatedBackground type="gradient" />
      <SubtitleDisplay words={words} />
    </AbsoluteFill>
  );
};
```

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```

## Remotion Template

The worker uses a template based on this package at:
- `packages/worker/remotion-template/`

The template includes all components and is bundled during visual generation.

## Dependencies

- **remotion** - Video composition framework
- **@remotion/bundler** - Bundle creation
- **@remotion/renderer** - Video rendering
- **react** - UI components
- **@reelify/shared** - Shared types
