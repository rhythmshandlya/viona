# @reelify/shared

Shared TypeScript types, utilities, and services for the Cllipify monorepo.

## Overview

This package provides:
- TypeScript type definitions used across all packages
- Storage service abstraction for S3-compatible storage
- Common utilities and constants

## Exports

### Main (`@reelify/shared`)
```typescript
import { ... } from '@reelify/shared';
```

### Types (`@reelify/shared/types`)
```typescript
import { Project, TranscriptWord, Visual, TimelineItem } from '@reelify/shared/types';
```

Key types:
- `Project` - Project entity with all metadata
- `TranscriptWord` - Word-level transcript with timing
- `Visual` - Generated visual composition
- `TimelineItem` - Timeline entry for video

### Storage (`@reelify/shared/storage`)
```typescript
import { getStorage, StorageService } from '@reelify/shared/storage';

const storage = getStorage();
await storage.uploadFile('uploads/video.mp4', buffer);
const url = await storage.getPresignedUrl('uploads/video.mp4');
```

Storage abstraction that works with:
- MinIO (local development)
- Railway Buckets (production)
- Any S3-compatible storage

## Architecture

```
src/
├── index.ts          # Main exports
├── types/
│   └── index.ts      # TypeScript type definitions
└── storage.ts        # Storage service abstraction
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

## Storage Configuration

The storage service auto-configures based on environment:

**Local (MinIO):**
```bash
S3_ENDPOINT=localhost
S3_PORT=9000
S3_ACCESS_KEY=reelify
S3_SECRET_KEY=reelify123
S3_BUCKET=cllipify
```

**Production (Railway):**
```bash
BUCKET_ENDPOINT=storage.railway.app
BUCKET_ACCESS_KEY_ID=xxx
BUCKET_SECRET_ACCESS_KEY=xxx
BUCKET_NAME=xxx
```

## Bucket Structure

Single bucket with prefix-based organization:
```
cllipify/
├── uploads/       # User uploaded files
├── outputs/       # Generated outputs
│   ├── videos/    # Rendered videos
│   └── bundles/   # Remotion bundles
└── templates/     # Remotion template files
```

## Dependencies

- **minio** - S3-compatible storage client
