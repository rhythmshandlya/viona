# YouTube Clip Service Design Document

**Date:** 2026-03-05
**Status:** Draft
**Author:** Claude (with user collaboration)

## Overview

A service that allows users (and AI) to add YouTube video clips to their projects by providing a URL and timestamps. The system streams video for instant preview/iteration, then downloads only the confirmed segment for export.

## Problem Statement

Users want to include YouTube clips in their final exported videos. Current challenges:

1. **No YouTube integration** - No way to add YouTube content to projects
2. **Iteration UX** - Downloading on every timestamp adjustment is slow
3. **YouTube embed limitations** - IFrame embeds have YouTube UI chrome (play button, timeline, logo)
4. **Export compatibility** - YouTube embeds cannot be rendered by Remotion

## Solution Summary

```
┌────────────────────────────────────────────────────────────────┐
│  User pastes YouTube URL                                       │
│              ↓                                                 │
│  Backend extracts direct stream URL (yt-dlp -g)               │
│              ↓                                                 │
│  Backend proxies stream (handles CORS, auth)                  │
│              ↓                                                 │
│  Frontend plays via HTML5 <video> (clean, no YouTube UI)      │
│  - Browser uses HTTP range requests                            │
│  - Only downloads bytes being viewed                           │
│  - User iterates freely with custom trim UI                    │
│              ↓                                                 │
│  On confirm → yt-dlp --download-sections for final segment    │
│              ↓                                                 │
│  Clip added to project like any other video                   │
└────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Stream for preview, download only final segment.

---

## Architecture

### 1. System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌───────────────────────────────┐  │
│  │ YouTubeClipModal│───▶│ StreamingVideoPlayer          │  │
│  │  - URL input    │    │  - HTML5 <video>              │  │
│  │  - Fetch stream │    │  - Range slider trim UI       │  │
│  └─────────────────┘    │  - Frame-accurate preview     │  │
│                         └───────────────────────────────┘  │
│                                    │                        │
│                                    ▼                        │
│                         ┌───────────────────────────────┐  │
│                         │ Confirm & Download            │  │
│                         └───────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND (packages/api)               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              YouTubeClipService                      │   │
│  │  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │ getStreamUrl  │  │ proxyStream   │              │   │
│  │  │ (yt-dlp -g)   │  │ (range reqs)  │              │   │
│  │  └───────────────┘  └───────────────┘              │   │
│  │  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │ extractClip   │  │ getMetadata   │              │   │
│  │  │ (--download-  │  │ (title, dur)  │              │   │
│  │  │  sections)    │  │               │              │   │
│  │  └───────────────┘  └───────────────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              YouTubeSearchService                    │   │
│  │  YouTube Data API v3 → Search → Return previews     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         STORAGE                              │
├─────────────────────────────────────────────────────────────┤
│  /clips/{clipId}.mp4  →  Permanent storage for project      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Data Flow

#### Phase 1: Stream URL Extraction
```
POST /api/youtube/stream-info
Body: { url: "https://youtube.com/watch?v=xxx" }

Response: {
  streamUrl: "/api/youtube/proxy/{token}",
  duration: 342.5,
  title: "Video Title",
  thumbnail: "https://i.ytimg.com/...",
  formats: ["1080p", "720p", "480p"]
}
```

#### Phase 2: Stream Proxy (Preview)
```
GET /api/youtube/proxy/{token}
Headers: Range: bytes=1000000-2000000

Response: (proxied video bytes with range support)
```

#### Phase 3: Clip Extraction (Confirm)
```
POST /api/youtube/extract
Body: {
  url: "https://youtube.com/watch?v=xxx",
  startSeconds: 83,
  endSeconds: 97,
  quality: "1080p"
}

Response: {
  jobId: "abc123",
  status: "processing"
}

// Poll for completion
GET /api/youtube/extract/abc123
Response: {
  status: "complete",
  clipUrl: "https://storage.../clips/xxx.mp4",
  duration: 14,
  fileSize: 2340000
}
```

---

## Data Model

### Types

```typescript
// packages/api/src/services/youtube-clip/types.ts

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  duration: number;           // seconds
  thumbnail: string;
  channel: string;
  uploadDate: string;
  formats: VideoFormat[];
}

export interface VideoFormat {
  quality: string;            // "1080p", "720p", etc.
  formatId: string;
  filesize?: number;
  hasAudio: boolean;
}

export interface StreamToken {
  videoId: string;
  directUrl: string;
  expiresAt: number;          // Unix timestamp
  format: string;
}

export interface ClipRequest {
  url: string;
  startSeconds: number;
  endSeconds: number;
  quality?: string;           // Default: best available
  projectId?: string;         // For associating with project
}

export interface ClipResult {
  clipId: string;
  clipUrl: string;
  duration: number;
  fileSize: number;
  thumbnail: string;
  sourceUrl: string;
  sourceTitle: string;
  startSeconds: number;
  endSeconds: number;
}
```

### Schema for AI Configuration

```typescript
// packages/api/src/services/youtube-clip/schema.ts
import { z } from 'zod';

export const youtubeUrlSchema = z.string()
  .url()
  .refine(
    (url) => /youtube\.com|youtu\.be/.test(url),
    'Must be a valid YouTube URL'
  );

export const timestampSchema = z.number()
  .min(0)
  .describe('Time in seconds');

export const clipRequestSchema = z.object({
  url: youtubeUrlSchema.describe('YouTube video URL'),
  startSeconds: timestampSchema.describe('Start time in seconds'),
  endSeconds: timestampSchema.describe('End time in seconds'),
  quality: z.enum(['1080p', '720p', '480p', '360p', 'best'])
    .default('best')
    .describe('Video quality'),
});

// For AI-driven clip search
export const clipSearchSchema = z.object({
  query: z.string()
    .min(2)
    .describe('Search query for YouTube'),
  maxResults: z.number()
    .min(1)
    .max(20)
    .default(5),
  duration: z.enum(['short', 'medium', 'long', 'any'])
    .default('any')
    .describe('Filter by video duration'),
});

export type ClipRequest = z.infer<typeof clipRequestSchema>;
export type ClipSearch = z.infer<typeof clipSearchSchema>;
```

### Timeline Item Type

```typescript
// Extend existing TimelineItemType
export type TimelineItemType =
  | 'video'
  | 'audio'
  | 'caption'
  | 'text'
  | 'image'
  | 'visual'
  | 'broll'
  | 'youtube-clip';  // New type

export interface YouTubeClipItemData {
  clipId: string;
  clipUrl: string;              // Downloaded clip URL
  sourceUrl: string;            // Original YouTube URL
  sourceTitle: string;
  startSeconds: number;         // Original timestamp (for reference)
  endSeconds: number;
  duration: number;
  thumbnail: string;
  volume: number;
  playbackRate: number;
}
```

---

## Implementation Details

### 1. YouTube Clip Service

```typescript
// packages/api/src/services/youtube-clip/service.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { uploadToStorage } from '../storage';
import { YouTubeVideoInfo, StreamToken, ClipResult } from './types';

const execAsync = promisify(exec);

export class YouTubeClipService {
  private streamTokens: Map<string, StreamToken> = new Map();

  /**
   * Get video metadata without downloading
   */
  async getVideoInfo(url: string): Promise<YouTubeVideoInfo> {
    const { stdout } = await execAsync(
      `yt-dlp -j --no-download "${url}"`
    );
    const info = JSON.parse(stdout);

    return {
      videoId: info.id,
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      channel: info.channel,
      uploadDate: info.upload_date,
      formats: info.formats
        .filter((f: any) => f.vcodec !== 'none')
        .map((f: any) => ({
          quality: f.format_note || f.height + 'p',
          formatId: f.format_id,
          filesize: f.filesize,
          hasAudio: f.acodec !== 'none',
        })),
    };
  }

  /**
   * Get direct stream URL for preview
   */
  async getStreamUrl(url: string, quality?: string): Promise<StreamToken> {
    const format = quality ? `-f "bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best"` : '-f best';

    const { stdout } = await execAsync(
      `yt-dlp -g ${format} "${url}"`
    );

    const [videoUrl, audioUrl] = stdout.trim().split('\n');

    const token: StreamToken = {
      videoId: this.extractVideoId(url),
      directUrl: videoUrl,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
      format: quality || 'best',
    };

    const tokenId = uuid();
    this.streamTokens.set(tokenId, token);

    return { ...token, tokenId };
  }

  /**
   * Proxy stream with range request support
   */
  async proxyStream(tokenId: string, rangeHeader?: string): Promise<Response> {
    const token = this.streamTokens.get(tokenId);
    if (!token || Date.now() > token.expiresAt) {
      throw new Error('Stream token expired or invalid');
    }

    const headers: HeadersInit = {};
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await fetch(token.directUrl, { headers });

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Content-Range': response.headers.get('Content-Range') || '',
      },
    });
  }

  /**
   * Download specific segment using yt-dlp --download-sections
   */
  async extractClip(
    url: string,
    startSeconds: number,
    endSeconds: number,
    quality?: string
  ): Promise<ClipResult> {
    const clipId = uuid();
    const outputPath = `/tmp/clips/${clipId}.mp4`;
    const thumbnailPath = `/tmp/clips/${clipId}.jpg`;

    // Format timestamps for yt-dlp
    const timeRange = `*${this.formatTimestamp(startSeconds)}-${this.formatTimestamp(endSeconds)}`;
    const format = quality
      ? `-f "bestvideo[height<=${quality.replace('p', '')}]+bestaudio/best"`
      : '-f best';

    // Download only the specified section
    await execAsync(`
      yt-dlp ${format} \
        --download-sections "${timeRange}" \
        --force-keyframes-at-cuts \
        --write-thumbnail \
        --convert-thumbnails jpg \
        -o "${outputPath}" \
        "${url}"
    `);

    // Get source info
    const info = await this.getVideoInfo(url);

    // Upload to permanent storage
    const clipUrl = await uploadToStorage(outputPath, `clips/${clipId}.mp4`);
    const thumbnail = await uploadToStorage(thumbnailPath, `clips/${clipId}.jpg`);

    // Cleanup temp files
    await execAsync(`rm -f ${outputPath} ${thumbnailPath}`);

    return {
      clipId,
      clipUrl,
      duration: endSeconds - startSeconds,
      fileSize: 0, // TODO: Get from upload
      thumbnail,
      sourceUrl: url,
      sourceTitle: info.title,
      startSeconds,
      endSeconds,
    };
  }

  private formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private extractVideoId(url: string): string {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    throw new Error('Invalid YouTube URL');
  }
}

export const youtubeClipService = new YouTubeClipService();
```

### 2. API Routes

```typescript
// packages/api/src/routes/youtube-clips.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { youtubeClipService } from '../services/youtube-clip/service';
import { clipRequestSchema, youtubeUrlSchema } from '../services/youtube-clip/schema';
import { clipQueue } from '../services/queue';

const app = new Hono();

// Get video info and stream URL
app.post(
  '/stream-info',
  zValidator('json', z.object({ url: youtubeUrlSchema, quality: z.string().optional() })),
  async (c) => {
    const { url, quality } = c.req.valid('json');

    const [info, stream] = await Promise.all([
      youtubeClipService.getVideoInfo(url),
      youtubeClipService.getStreamUrl(url, quality),
    ]);

    return c.json({
      ...info,
      streamUrl: `/api/youtube/proxy/${stream.tokenId}`,
      expiresAt: stream.expiresAt,
    });
  }
);

// Proxy video stream with range support
app.get('/proxy/:tokenId', async (c) => {
  const tokenId = c.req.param('tokenId');
  const rangeHeader = c.req.header('Range');

  try {
    const response = await youtubeClipService.proxyStream(tokenId, rangeHeader);
    return response;
  } catch (error) {
    return c.json({ error: 'Stream expired or invalid' }, 410);
  }
});

// Queue clip extraction job
app.post(
  '/extract',
  zValidator('json', clipRequestSchema),
  async (c) => {
    const { url, startSeconds, endSeconds, quality } = c.req.valid('json');

    const job = await clipQueue.add('extract-youtube-clip', {
      url,
      startSeconds,
      endSeconds,
      quality,
    });

    return c.json({ jobId: job.id, status: 'processing' });
  }
);

// Get extraction job status
app.get('/extract/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const job = await clipQueue.getJob(jobId);

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  if (job.returnvalue) {
    return c.json({ status: 'complete', ...job.returnvalue });
  }

  const state = await job.getState();
  return c.json({
    status: state,
    progress: job.progress,
  });
});

export default app;
```

### 3. Queue Processor

```typescript
// packages/api/src/services/queue/youtube-clip-processor.ts
import { Job } from 'bullmq';
import { youtubeClipService } from '../youtube-clip/service';

export async function processYouTubeClip(job: Job) {
  const { url, startSeconds, endSeconds, quality } = job.data;

  await job.updateProgress(10);

  const result = await youtubeClipService.extractClip(
    url,
    startSeconds,
    endSeconds,
    quality
  );

  await job.updateProgress(100);

  return result;
}
```

---

## Frontend Components

### 1. YouTube Clip Modal

```typescript
// apps/web/src/components/YouTubeClipModal.tsx

interface YouTubeClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClipAdded: (clip: YouTubeClipItemData) => void;
}

function YouTubeClipModal({ isOpen, onClose, onClipAdded }: YouTubeClipModalProps) {
  const [url, setUrl] = useState('');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [range, setRange] = useState({ start: 0, end: 30 });
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Fetch stream info when URL changes
  const handleFetchStream = async () => {
    setLoading(true);
    const info = await api.post('/youtube/stream-info', { url });
    setStreamInfo(info);
    setRange({ start: 0, end: Math.min(30, info.duration) });
    setLoading(false);
  };

  // Extract final clip
  const handleConfirm = async () => {
    setExtracting(true);
    const { jobId } = await api.post('/youtube/extract', {
      url,
      startSeconds: range.start,
      endSeconds: range.end,
    });

    // Poll for completion
    const result = await pollJob(jobId);

    onClipAdded({
      clipId: result.clipId,
      clipUrl: result.clipUrl,
      sourceUrl: url,
      sourceTitle: streamInfo.title,
      startSeconds: range.start,
      endSeconds: range.end,
      duration: result.duration,
      thumbnail: result.thumbnail,
      volume: 1,
      playbackRate: 1,
    });

    setExtracting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add YouTube Clip</h2>

        {/* URL Input */}
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <button
            onClick={handleFetchStream}
            disabled={!url || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>

        {/* Video Preview & Trim UI */}
        {streamInfo && (
          <VideoTrimmer
            streamUrl={streamInfo.streamUrl}
            duration={streamInfo.duration}
            range={range}
            onRangeChange={setRange}
          />
        )}

        {/* Confirm Button */}
        {streamInfo && (
          <button
            onClick={handleConfirm}
            disabled={extracting}
            className="w-full py-3 bg-green-500 text-white rounded-lg"
          >
            {extracting
              ? 'Downloading clip...'
              : `Add ${formatDuration(range.end - range.start)} clip`
            }
          </button>
        )}
      </div>
    </Modal>
  );
}
```

### 2. Video Trimmer Component

```typescript
// apps/web/src/components/VideoTrimmer.tsx

interface VideoTrimmerProps {
  streamUrl: string;
  duration: number;
  range: { start: number; end: number };
  onRangeChange: (range: { start: number; end: number }) => void;
}

function VideoTrimmer({ streamUrl, duration, range, onRangeChange }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Loop within selected range
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= range.end) {
        video.currentTime = range.start;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [range]);

  const handlePreview = () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = range.start;
    video.play();
    setIsPlaying(true);
  };

  return (
    <div className="space-y-4">
      {/* Clean HTML5 Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={streamUrl}
          className="w-full h-full"
          onEnded={() => setIsPlaying(false)}
        />
      </div>

      {/* Timeline with range handles */}
      <RangeSlider
        min={0}
        max={duration}
        value={[range.start, range.end]}
        onChange={([start, end]) => onRangeChange({ start, end })}
        step={0.1}
        formatLabel={formatTimestamp}
      />

      {/* Timestamp inputs */}
      <div className="flex items-center gap-4">
        <TimestampInput
          label="Start"
          value={range.start}
          onChange={(v) => onRangeChange({ ...range, start: v })}
          max={range.end - 1}
        />
        <span className="text-gray-400">→</span>
        <TimestampInput
          label="End"
          value={range.end}
          onChange={(v) => onRangeChange({ ...range, end: v })}
          min={range.start + 1}
          max={duration}
        />
        <div className="ml-auto text-sm text-gray-500">
          Duration: {formatDuration(range.end - range.start)}
        </div>
      </div>

      {/* Preview button */}
      <button
        onClick={handlePreview}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
        Preview Selection
      </button>
    </div>
  );
}
```

---

## AI Integration

### Tool Definition

```typescript
// For AI to add YouTube clips
const addYouTubeClipTool = {
  name: 'add_youtube_clip',
  description: 'Add a YouTube video clip to the project timeline',
  parameters: clipRequestSchema,
  execute: async (params: ClipRequest) => {
    const { jobId } = await api.post('/youtube/extract', params);
    const result = await pollJob(jobId);
    return result;
  },
};

// For AI to search YouTube
const searchYouTubeTool = {
  name: 'search_youtube',
  description: 'Search YouTube for relevant video clips',
  parameters: clipSearchSchema,
  execute: async (params: ClipSearch) => {
    const results = await api.post('/youtube/search', params);
    return results;
  },
};
```

### AI Usage Examples

```
User: "Add a clip of a rocket launch"
AI:
  1. Calls search_youtube({ query: "rocket launch SpaceX" })
  2. Presents options to user
  3. User picks one
  4. AI calls add_youtube_clip({ url, startSeconds: 45, endSeconds: 60 })

User: "Add this clip from 1:30 to 2:15: https://youtube.com/watch?v=xxx"
AI:
  1. Calls add_youtube_clip({ url, startSeconds: 90, endSeconds: 135 })
```

---

## Dependencies

### System Requirements
- **yt-dlp**: Latest version with `--download-sections` support
- **FFmpeg**: Required by yt-dlp for segment extraction
- **BullMQ/Redis**: For job queue (clip extraction is async)

### npm Packages
```json
{
  "dependencies": {
    "bullmq": "^5.x",
    "zod": "^3.x"
  }
}
```

### Environment Variables
```env
# Optional: YouTube Data API key for search functionality
YOUTUBE_API_KEY=xxx

# Storage configuration
STORAGE_BUCKET=clips
```

---

## Security Considerations

1. **Rate Limiting**: Limit stream proxy and extraction requests per user
2. **Token Expiry**: Stream tokens expire after 5 minutes
3. **URL Validation**: Only accept valid YouTube URLs
4. **Storage Cleanup**: Auto-delete clips after project deletion
5. **Abuse Prevention**: Monitor for excessive downloads

---

## Success Criteria

1. Stream URL extraction < 2 seconds
2. Preview playback starts within 1 second of seeking
3. Clip extraction completes within 2x clip duration
4. Clean HTML5 player (no YouTube branding visible)
5. Frame-accurate trimming (±0.5 seconds)
6. AI can successfully search and add clips

---

## Implementation Order

1. **Phase 1: Backend Service**
   - YouTubeClipService (getVideoInfo, getStreamUrl, proxyStream, extractClip)
   - API routes (/stream-info, /proxy, /extract)
   - Queue processor

2. **Phase 2: Frontend Components**
   - YouTubeClipModal
   - VideoTrimmer with range slider
   - Integration with timeline

3. **Phase 3: AI Integration**
   - Tool definitions for AI
   - YouTube search integration (optional)

4. **Phase 4: Polish**
   - Error handling
   - Progress indicators
   - Quality selection UI

---

## Out of Scope (Future)

- Multi-clip extraction (download multiple segments at once)
- Clip library (save clips for reuse across projects)
- YouTube playlist support
- Live stream clipping
- Automatic clip suggestions based on transcript
