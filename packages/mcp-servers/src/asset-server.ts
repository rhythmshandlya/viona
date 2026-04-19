#!/usr/bin/env node

/**
 * Asset Download MCP Server for the Animator agent.
 *
 * Provides tools:
 *   download_file             - fetch any URL -> save to public/assets/{filename}
 *   search_unsplash           - search Unsplash API, return results
 *   search_pexels             - search Pexels API, return results
 *   download_stock_asset      - download photo or video from Pexels with attribution headers
 *   auto_center_speaker       - adjust video crop to center the speaker's face
 *   get_speaker_position      - canvas-space speaker coordinates for overlay placement
 *   request_segmentation      - queue person matte extraction for time ranges
 *   check_segmentation_status - poll segmentation job status + download mattes
 *   get_depth_compositing_info - check matte availability + compositing instructions
 *
 * Usage:
 *   node asset-server.js --workspace /path/to/remotion-project
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { execFile } from "child_process";
import { promisify } from "util";
import { Open as unzipOpen } from "unzipper";
import { Client as MinioClient } from "minio";
import { parseWorkspace } from "./lib/parse-args.js";
import { errorMessage } from "./lib/errors.js";
import {
  computeCoverTransform,
  computeCenterCrop,
  sourceToCanvas,
} from './utils/cover-transform.js';
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Headers passed to fetch requests. */
type FetchHeaders = Record<string, string>;

/** Matte-derived bounding box data (per-frame, normalized 0-1 coords from alpha channel analysis). */
interface MatteBboxFrame {
  frame: number;
  x: number;  // normalized left edge (0-1)
  y: number;  // normalized top edge (0-1)
  w: number;  // normalized width (0-1)
  h: number;  // normalized height (0-1)
}

interface MatteBboxData {
  fps: number;
  sourceStartMs?: number;  // clip start offset in source timeline (injected by worker)
  frames: MatteBboxFrame[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WORKSPACE = parseWorkspace();
const ASSETS_DIR: string = path.join(WORKSPACE, "public", "assets");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT = 30_000; // 30 s

const UNSPLASH_ACCESS_KEY: string = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_API_KEY: string = process.env.PEXELS_API_KEY || "";

// Segmentation / depth compositing env vars (set by sandbox orchestrator)
const API_INTERNAL_URL: string = process.env.API_CALLBACK_URL || "";
const SANDBOX_SECRET: string = process.env.SANDBOX_SECRET || "";
const PROJECT_ID: string = process.env.PROJECT_ID || "";
// Bare MinIO key for the source video (no `uploads/` prefix). Injected by the
// sandbox orchestrator in packages/api/src/sandbox/routes.ts alongside PROJECT_ID.
// Required by the new inference dispatch API (segment-speaker capability).
const VIDEO_KEY: string = process.env.VIDEO_KEY || "";
const MATTE_DIR: string = path.join(WORKSPACE, "public", "matte");

// MinIO direct download (new inference API returns MinIO keys, not HTTP streams).
// Env vars set by the sandbox orchestrator (see packages/api/src/sandbox/e2b.ts,
// docker.ts, railway.ts).
const MINIO_BUCKET: string = process.env.MINIO_BUCKET || "viona";

let _minioClient: MinioClient | null = null;
function getMinioClient(): MinioClient {
  if (_minioClient) return _minioClient;
  _minioClient = new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined,
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "",
    secretKey: process.env.MINIO_SECRET_KEY || "",
  });
  return _minioClient;
}

/**
 * In-tool mapping: inference jobId → sceneIds supplied by the agent in
 * request_segmentation. The new inference API does not accept or echo sceneIds
 * (it produces one shared matte per call), so we record them locally so that
 * check_segmentation_status can write downloaded files under the expected
 * per-scene paths (public/matte/{sceneId}.mp4 etc.).
 */
interface JobSceneMeta {
  primarySceneId: string;
  allSceneIds: string[];
}
const jobSceneMeta = new Map<string, JobSceneMeta>();

/**
 * Download a MinIO object to a local file. Parity with the helper in
 * packages/sandbox/src/tools/segment-speaker.ts — stream chunks and write.
 */
async function downloadMinioObject(key: string, destPath: string): Promise<void> {
  const minio = getMinioClient();
  const stream = await minio.getObject(MINIO_BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  await writeFile(destPath, Buffer.concat(chunks));
}

/**
 * Open an SSE stream for the given inference jobId and accumulate events
 * until either (a) a terminal `complete`/`error` event arrives, (b) the
 * overall deadline expires, or (c) the server ends the stream.
 *
 * SSE parsing mirrors packages/sandbox/src/tools/segment-speaker.ts: blocks
 * split on `\n\n`, `event:`/`data:` lines extracted via regex, comment lines
 * (starting with `:`, e.g. heartbeats) are skipped by the event/data regex
 * match naturally (no `event:` line → the block is ignored).
 */
interface InferenceTerminalEvent {
  kind: "complete" | "error";
  data: {
    jobId: string;
    status: string;
    output?: {
      matteKey: string;
      fgrKey: string;
      bboxKey: string;
      proxyMatteKey: string;
      proxyFgrKey: string;
    };
    error?: { message?: string } | string | null;
  };
}

async function readInferenceStream(
  jobId: string,
  opts: { deadlineMs: number },
): Promise<InferenceTerminalEvent | null> {
  const url = `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/inference/${jobId}/stream`;
  const remaining = Math.max(0, opts.deadlineMs - Date.now());
  if (remaining === 0) return null;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), remaining);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SANDBOX_SECRET}` },
      signal: abort.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`SSE stream failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const blocks = buf.split("\n\n");
      buf = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/^event: (\w+)$/m);
        const dataMatch = block.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue; // heartbeat `: …` or malformed — skip

        const kind = eventMatch[1];
        let data: any;
        try {
          data = JSON.parse(dataMatch[1]);
        } catch {
          continue;
        }

        if (kind === "complete" || kind === "error") {
          return { kind, data };
        }
        // progress / ready — swallow
      }
    }
    return null; // stream ended without terminal event
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure the assets directory exists. */
async function ensureAssetsDir(): Promise<void> {
  await mkdir(ASSETS_DIR, { recursive: true });
}

/** Block private / loopback IPs and non-http(s) schemes. */
function validateUrl(raw: string): string {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  // Block obvious private ranges
  const blocked: RegExp[] = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^\[::1\]/,
    /^169\.254\./,
  ];
  if (blocked.some((re) => re.test(host))) {
    throw new Error(`Blocked private/loopback host: ${host}`);
  }
  return parsed.href;
}

/** Sanitise a filename - strip path separators, allow only safe characters. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
}

/** Image extensions we'll look for when extracting from ZIP archives. */
const IMAGE_EXTENSIONS = new Set<string>([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
]);

/**
 * If `buf` is a ZIP archive, extract the first image file and return it.
 * Returns the original buffer unchanged if it's not a ZIP.
 */
async function extractImageFromZip(buf: Buffer): Promise<Buffer> {
  // ZIP magic bytes: PK\x03\x04
  if (
    buf.length < 4 ||
    buf[0] !== 0x50 ||
    buf[1] !== 0x4b ||
    buf[2] !== 0x03 ||
    buf[3] !== 0x04
  ) {
    return buf;
  }

  try {
    const directory = await unzipOpen.buffer(buf);
    // Sort to prefer JPG/PNG over vector formats (EPS, AI), largest image first
    const imageFiles = directory.files
      .filter((f) => {
        const ext = path.extname(f.path).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext) && f.uncompressedSize > 0;
      })
      .sort((a, b) => b.uncompressedSize - a.uncompressedSize);

    if (imageFiles.length === 0) {
      // ZIP contains only vector files (EPS, AI) - no raster image to extract.
      const allFiles = directory.files.map((f) => f.path);
      throw new Error(
        `ZIP contains no raster images (files: ${allFiles.join(", ")})`
      );
    }

    const extracted = await imageFiles[0].buffer();
    console.error(
      `[asset-server] Extracted ${imageFiles[0].path} (${extracted.length} bytes) from ZIP archive`
    );
    return extracted;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[asset-server] ZIP extraction failed: ${message}`);
    throw err;
  }
}

/** Probe width/height of an image or video file via ffprobe. Returns null on failure. */
async function probeDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      filePath,
    ], { timeout: 15_000 });
    const json = JSON.parse(stdout);
    const stream = json?.streams?.[0];
    if (stream?.width && stream?.height) {
      return { width: stream.width, height: stream.height };
    }
  } catch {
    // ffprobe not available or failed — return null
  }
  return null;
}

/** Probe duration of a video file via ffprobe. Returns null on failure. */
async function probeVideoDurationMs(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath,
    ], { timeout: 15_000 });
    const json = JSON.parse(stdout);
    const duration = parseFloat(json?.format?.duration);
    if (!isNaN(duration)) {
      return Math.round(duration * 1000);
    }
  } catch {
    // ffprobe not available or failed — return null
  }
  return null;
}

/** Fetch a URL with size and timeout guards. */
async function safeFetch(
  url: string,
  extraHeaders: FetchHeaders = {}
): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "VionaAssetServer/1.0",
        ...extraHeaders,
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${contentLength} bytes (max ${MAX_FILE_SIZE})`
      );
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FILE_SIZE) {
      throw new Error(`Downloaded file too large: ${buf.length} bytes`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "assets",
  version: "1.0.0",
});

// -- download_file ----------------------------------------------------------
server.registerTool(
  "download_file",
  {
    description:
      "Download a file from a URL and save it to public/assets/{filename} for use with Remotion's staticFile(). Use this after getting a download URL from Freepik or any other source.",
    inputSchema: {
      url: z.string().url().describe("The URL to download from"),
      filename: z
        .string()
        .describe(
          "Target filename (e.g. 'icon-cloud.svg', 'illustration.png'). Will be sanitised."
        ),
    },
  },
  async ({ url, filename }: { url: string; filename: string }) => {
    try {
      const validUrl = validateUrl(url);
      const safeName = sanitizeFilename(filename);
      await ensureAssetsDir();

      const rawBuf = await safeFetch(validUrl);
      // Freepik (and some other APIs) return ZIP archives containing the actual
      // image plus vector source files. Auto-extract the image if it's a ZIP.
      const buf = await extractImageFromZip(rawBuf);
      const dest = path.join(ASSETS_DIR, safeName);
      await writeFile(dest, buf);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: `public/assets/${safeName}`,
              staticFile: `assets/${safeName}`,
              size: buf.length,
              extractedFromZip: buf !== rawBuf,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: "text" as const, text: `Error downloading file: ${errorMessage(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// -- search_unsplash --------------------------------------------------------
server.registerTool(
  "search_unsplash",
  {
    description:
      "Search Unsplash for stock photos. Returns a list of results with download URLs. Requires UNSPLASH_ACCESS_KEY env var.",
    inputSchema: {
      query: z
        .string()
        .describe("Search query (e.g. 'team collaboration office')"),
      count: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Number of results (default 5, max 10)"),
    },
  },
  async ({ query, count }: { query: string; count: number }) => {
    try {
      if (!UNSPLASH_ACCESS_KEY) {
        return {
          content: [
            {
              type: "text" as const,
              text: "UNSPLASH_ACCESS_KEY not configured. Please set the environment variable.",
            },
          ],
          isError: true,
        };
      }

      const params = new URLSearchParams({
        query,
        per_page: String(count || 5),
        orientation: "landscape",
      });
      const res = await fetch(
        `https://api.unsplash.com/search/photos?${params}`,
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
            "Accept-Version": "v1",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        }
      );

      if (!res.ok)
        throw new Error(`Unsplash API ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as {
        results?: Array<{
          id: string;
          description?: string;
          alt_description?: string;
          urls?: { regular?: string; small?: string };
          links?: { download_location?: string };
          user?: { name?: string };
          width: number;
          height: number;
        }>;
      };

      const results = (data.results || []).map((photo) => ({
        id: photo.id,
        description:
          photo.description || photo.alt_description || "No description",
        urls: {
          regular: photo.urls?.regular,
          small: photo.urls?.small,
          download: photo.links?.download_location,
        },
        photographer: photo.user?.name || "Unknown",
        width: photo.width,
        height: photo.height,
      }));

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(results, null, 2) },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching Unsplash: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// -- search_pexels ----------------------------------------------------------
server.registerTool(
  "search_pexels",
  {
    description:
      "Search Pexels for stock photos or videos. Returns a list of results with download URLs. Requires PEXELS_API_KEY env var.",
    inputSchema: {
      query: z
        .string()
        .describe("Search query (e.g. 'nature landscape sunset')"),
      count: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Number of results (default 5, max 10)"),
      mediaType: z
        .enum(["photo", "video"])
        .optional()
        .default("photo")
        .describe("Whether to search for photos or videos (default: photo)"),
    },
  },
  async ({ query, count, mediaType }: { query: string; count: number; mediaType: "photo" | "video" }) => {
    try {
      if (!PEXELS_API_KEY) {
        return {
          content: [
            {
              type: "text" as const,
              text: "PEXELS_API_KEY not configured. Please set the environment variable.",
            },
          ],
          isError: true,
        };
      }

      const params = new URLSearchParams({
        query,
        per_page: String(count || 5),
        orientation: "landscape",
      });

      if (mediaType === "video") {
        const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
          headers: { Authorization: PEXELS_API_KEY },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });

        if (!res.ok)
          throw new Error(`Pexels Videos API ${res.status}: ${res.statusText}`);

        const data = (await res.json()) as {
          videos?: Array<{
            id: number;
            url?: string;
            width: number;
            height: number;
            duration: number;
            user?: { name?: string };
            video_files?: Array<{
              id: number;
              quality?: string;
              file_type?: string;
              width?: number;
              height?: number;
              link?: string;
            }>;
          }>;
        };

        const results = (data.videos || []).map((video) => {
          // Pick best HD mp4: filter to video/mp4, sort by width descending
          const mp4Files = (video.video_files || [])
            .filter((f) => f.file_type === "video/mp4" && f.link)
            .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
          const hdFile = mp4Files.find((f) => (f.width ?? 0) >= 1280) ?? mp4Files[0];
          const sdFile = mp4Files[mp4Files.length - 1]; // lowest quality as fallback
          return {
            id: video.id,
            description: video.url || "No description",
            urls: {
              original: hdFile?.link,
              hd: hdFile?.link,
              sd: sdFile?.link,
            },
            photographer: video.user?.name || "Unknown",
            width: video.width,
            height: video.height,
            duration: video.duration,
            mediaType: "video" as const,
          };
        });

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      } else {
        const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
          headers: { Authorization: PEXELS_API_KEY },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });

        if (!res.ok)
          throw new Error(`Pexels API ${res.status}: ${res.statusText}`);
        const data = (await res.json()) as {
          photos?: Array<{
            id: number;
            alt?: string;
            src?: { original?: string; large?: string; medium?: string };
            photographer?: string;
            width: number;
            height: number;
          }>;
        };

        const results = (data.photos || []).map((photo) => ({
          id: photo.id,
          description: photo.alt || "No description",
          urls: {
            original: photo.src?.original,
            large: photo.src?.large,
            medium: photo.src?.medium,
          },
          photographer: photo.photographer || "Unknown",
          width: photo.width,
          height: photo.height,
          mediaType: "photo" as const,
        }));

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      }
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching Pexels: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// -- download_stock_asset ---------------------------------------------------
server.registerTool(
  "download_stock_asset",
  {
    description:
      "Download a stock photo or video from Pexels with proper attribution and save to public/assets/broll/. Use after search_pexels to download a chosen photo or video.",
    inputSchema: {
      url: z
        .string()
        .url()
        .describe("The asset download URL from search results"),
      filename: z
        .string()
        .describe("Target filename (e.g. 'hero-photo.jpg' or 'broll-city.mp4')"),
      source: z
        .enum(["pexels", "unsplash"])
        .default("pexels")
        .describe("Stock service the URL is from"),
      photographer: z
        .string()
        .optional()
        .describe("Photographer or creator name for attribution (from search results)"),
    },
  },
  async ({
    url,
    filename,
    source,
    photographer,
  }: {
    url: string;
    filename: string;
    source: "pexels" | "unsplash";
    photographer?: string;
  }) => {
    try {
      const validUrl = validateUrl(url);
      const safeName = sanitizeFilename(filename);
      const brollDir = path.join(ASSETS_DIR, "broll");
      await mkdir(brollDir, { recursive: true });

      const headers: FetchHeaders = {};
      if (source === "pexels" && PEXELS_API_KEY) {
        headers["Authorization"] = PEXELS_API_KEY;
      }
      if (source === "unsplash" && UNSPLASH_ACCESS_KEY) {
        headers["Authorization"] = `Client-ID ${UNSPLASH_ACCESS_KEY}`;
      }

      const buf = await safeFetch(validUrl, headers);
      const dest = path.join(brollDir, safeName);
      await writeFile(dest, buf);

      // Detect media type from extension
      const ext = path.extname(safeName).toLowerCase();
      const isVideo = [".mp4", ".webm", ".mov"].includes(ext);
      const mediaType = isVideo ? "video" : "image";

      // Probe dimensions and duration
      const dims = await probeDimensions(dest);
      const durationMs = isVideo ? await probeVideoDurationMs(dest) : null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              path: `public/assets/broll/${safeName}`,
              staticFile: `assets/broll/${safeName}`,
              size: buf.length,
              source,
              mediaType,
              width: dims?.width ?? null,
              height: dims?.height ?? null,
              durationMs,
              photographer: photographer || "Unknown",
              attribution: source === "unsplash"
                ? `${isVideo ? "Video" : "Photo"} from Unsplash (https://unsplash.com)${photographer ? ` by ${photographer}` : ""}`
                : `${isVideo ? "Video" : "Photo"} from Pexels (https://pexels.com)${photographer ? ` by ${photographer}` : ""}`,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error downloading stock asset: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// -- auto_center_speaker ----------------------------------------------------
server.registerTool(
  "auto_center_speaker",
  {
    description:
      "Automatically adjust the video item's crop to center the speaker. " +
      "Reads matte bbox data from segmentation and the manifest, computes optimal " +
      "objectPosition percentages, and writes updated crop values back to the manifest. " +
      "Call this after placing video items and after segmentation mattes are available.",
    inputSchema: {},
  },
  async () => {
    try {
      // 1. Read matte bbox data to find speaker center
      const matteDir = path.join(WORKSPACE, "public", "matte");
      let allBboxFrames: MatteBboxFrame[] = [];
      let srcW = 0, srcH = 0;
      try {
        const matteFiles = await readdir(matteDir);
        const bboxFiles = matteFiles.filter(f => f.endsWith('-bbox.json'));
        for (const bboxFile of bboxFiles) {
          const data: MatteBboxData = JSON.parse(await readFile(path.join(matteDir, bboxFile), "utf-8"));
          if (data.frames && data.frames.length > 0) {
            allBboxFrames.push(...data.frames);
          }
        }
      } catch {
        // No matte data available
      }

      if (allBboxFrames.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              adjusted: false,
              reason: "No matte bbox data available. Call request_segmentation first. Keeping default crop.",
            }),
          }],
        };
      }

      // 2. Read manifest to get source video dimensions
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };
      const videoW = canvas.sourceWidth || canvas.width;
      const videoH = canvas.sourceHeight || canvas.height;

      // 3. Compute face-biased center for crop anchoring.
      // Matte bbox is full-body — body center is ~waist level.
      // For talking-head video, crop should center on the face (~top 25% of bbox).
      let sumX = 0, sumFaceY = 0;
      for (const mf of allBboxFrames) {
        sumX += (mf.x + mf.w / 2) * videoW;
        // Face is approximately at top 25% of the body bbox
        sumFaceY += (mf.y + mf.h * 0.25) * videoH;
      }
      const bodyCenterX = sumX / allBboxFrames.length;
      const bodyCenterY = sumFaceY / allBboxFrames.length;

      // 4. Find all video items and update crop
      const updated: Array<{ itemId: string; trackId: string; cropX: number; cropY: number }> = [];

      for (const item of manifest.items || []) {
        if (item.type !== "video") continue;

        // Item dimensions come from item.transform (not item.width/height)
        const t = item.transform || {};
        const itemW = typeof t.width === 'number' ? t.width : canvas.width;
        const itemH = typeof t.height === 'number' ? t.height : canvas.height;

        const crop = computeCenterCrop(
          bodyCenterX, bodyCenterY,
          videoW, videoH,
          itemW, itemH,
        );

        // Update item crop in manifest
        if (!item.data) item.data = {};
        item.data.crop = {
          x: Math.round(crop.x * 10) / 10,
          y: Math.round(crop.y * 10) / 10,
          scale: item.data.crop?.scale ?? 1,
        };

        updated.push({
          itemId: item.id,
          trackId: item.trackId,
          cropX: item.data.crop.x,
          cropY: item.data.crop.y,
        });
      }

      if (updated.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ adjusted: false, reason: "No video items found in manifest." }),
          }],
        };
      }

      // 4. Write updated manifest
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            adjusted: true,
            bodyCenter: {
              x: Math.round(bodyCenterX),
              y: Math.round(bodyCenterY),
              sourceSize: { width: videoW, height: videoH },
            },
            items: updated,
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error auto-centering speaker: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Speaker position tool — canvas-space coordinates from matte-derived bbox
// ---------------------------------------------------------------------------

server.registerTool(
  "get_speaker_position",
  {
    description:
      "Get the speaker's full-body position on the canvas for a given time range, " +
      "derived from segmentation matte bounding boxes. Returns pixel coordinates in " +
      "canvas space, accounting for objectFit:cover and crop transforms. Includes " +
      "speaker bounds, center point, available space in each direction, and concrete " +
      "safe placement rects for overlay elements. IMPORTANT: call request_segmentation " +
      "first for overlay scenes — this tool reads matte bbox data produced by " +
      "segmentation. If no matte is available, returns generous default bounds.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    try {
      // 1. Read manifest for video item geometry and canvas size
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };

      // Source video dimensions — check manifest sourceWidth/sourceHeight, fall back to canvas
      const srcW: number = manifest.canvas?.sourceWidth ?? canvas.width;
      const srcH: number = manifest.canvas?.sourceHeight ?? canvas.height;

      // Find video item active during [startMs, endMs]
      let videoItem: any = null;
      let bestOverlap = 0;
      for (const item of manifest.items || []) {
        if (item.type !== "video") continue;
        const itemStart = item.startMs ?? 0;
        const itemEnd = item.endMs ?? (itemStart + (item.durationMs ?? 0));
        const overlapStart = Math.max(startMs, itemStart);
        const overlapEnd = Math.min(endMs, itemEnd);
        const overlap = overlapEnd - overlapStart;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          videoItem = item;
        }
      }

      // Video item dimensions from item.transform
      const vt = videoItem?.transform || {};
      const itemW = typeof vt.width === 'number' ? vt.width : canvas.width;
      const itemH = typeof vt.height === 'number' ? vt.height : canvas.height;
      const itemX = typeof vt.x === 'number' ? vt.x : 0;
      const itemY = typeof vt.y === 'number' ? vt.y : 0;
      const cropX = videoItem?.data?.crop?.x ?? 50;
      const cropY = videoItem?.data?.crop?.y ?? 50;
      const cropScale = videoItem?.data?.crop?.scale ?? 1;

      // 2. Compute cover transform
      // When no video item exists (overlay scene — V0 cut), the matte bbox
      // is still in source-normalized coords. Use canvas as the item frame
      // with default 50/50 crop — the matte-to-canvas mapping is direct.
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);

      if (!videoItem) {
        console.error(`[asset-server] No video item for range ${startMs}-${endMs}ms — using canvas frame (likely overlay scene with V0 cut)`);
      }

      // 3. Scan public/matte/ for bbox JSON files matching the time range
      const matteDir = path.join(WORKSPACE, "public", "matte");
      let matteBbox: MatteBboxData | null = null;
      try {
        const matteFiles = await readdir(matteDir);
        const bboxFiles = matteFiles.filter(f => f.endsWith('-bbox.json'));
        for (const bboxFile of bboxFiles) {
          const data: MatteBboxData = JSON.parse(await readFile(path.join(matteDir, bboxFile), "utf-8"));
          if (data.frames && data.frames.length > 0) {
            const fps = data.fps || 30;
            const offset = data.sourceStartMs ?? 0;
            const firstMs = offset + (data.frames[0].frame / fps) * 1000;
            const lastMs = offset + (data.frames[data.frames.length - 1].frame / fps) * 1000;
            if (firstMs <= endMs && lastMs >= startMs) {
              matteBbox = data;
              break;
            }
          }
        }
      } catch {
        // Matte dir not available — will use defaults
      }

      let boundsTop: number;
      let boundsBottom: number;
      let boundsLeft: number;
      let boundsRight: number;
      let source: 'matte' | 'defaults';

      if (matteBbox && matteBbox.frames.length > 0) {
        // 4. Matte bbox found — compute speaker bounds from averaged frames in the time range
        const mFps = matteBbox.fps || 30;
        const mOffset = matteBbox.sourceStartMs ?? 0;
        const matteFrames = matteBbox.frames.filter(mf => {
          const ms = mOffset + (mf.frame / mFps) * 1000;
          return ms >= startMs && ms <= endMs;
        });

        // Fall back to all frames if none match the exact range
        const framesToUse = matteFrames.length > 0 ? matteFrames : matteBbox.frames;

        let mLeft = 0, mTop = 0, mRight = 0, mBottom = 0;
        for (const mf of framesToUse) {
          mLeft += mf.x * srcW;
          mTop += mf.y * srcH;
          mRight += (mf.x + mf.w) * srcW;
          mBottom += (mf.y + mf.h) * srcH;
        }
        mLeft /= framesToUse.length;
        mTop /= framesToUse.length;
        mRight /= framesToUse.length;
        mBottom /= framesToUse.length;

        // Transform to canvas space
        const topLeftMatte = sourceToCanvas(mLeft, mTop, transform, itemX, itemY);
        const bottomRightMatte = sourceToCanvas(mRight, mBottom, transform, itemX, itemY);

        boundsLeft = Math.max(0, Math.round(Math.min(topLeftMatte.x, bottomRightMatte.x)));
        boundsTop = Math.max(0, Math.round(Math.min(topLeftMatte.y, bottomRightMatte.y)));
        boundsRight = Math.min(canvas.width, Math.round(Math.max(topLeftMatte.x, bottomRightMatte.x)));
        boundsBottom = Math.min(canvas.height, Math.round(Math.max(topLeftMatte.y, bottomRightMatte.y)));
        source = 'matte';

        console.error(`[asset-server] Using matte-derived speaker bounds (${framesToUse.length} frames)`);
      } else {
        // 5. No matte bbox — return generous default center-screen bounds
        boundsLeft = Math.round(canvas.width * 0.25);
        boundsTop = Math.round(canvas.height * 0.05);
        boundsRight = Math.round(canvas.width * 0.75);
        boundsBottom = Math.round(canvas.height * 0.90);
        source = 'defaults';

        console.error(`[asset-server] No matte bbox available — using default speaker bounds`);
      }

      const centerX = Math.round((boundsLeft + boundsRight) / 2);
      const centerY = Math.round((boundsTop + boundsBottom) / 2);

      // 6. Compute available space (20px margin)
      const margin = 20;
      const availableSpace = {
        above: { from: 0, to: Math.max(0, boundsTop - margin), height: Math.max(0, boundsTop - margin) },
        below: { from: Math.min(canvas.height, boundsBottom + margin), to: canvas.height, height: Math.max(0, canvas.height - boundsBottom - margin) },
        left: { from: 0, to: Math.max(0, boundsLeft - margin), width: Math.max(0, boundsLeft - margin) },
        right: { from: Math.min(canvas.width, boundsRight + margin), to: canvas.width, width: Math.max(0, canvas.width - boundsRight - margin) },
      };

      // 7. Generate safe placements
      const safePlacements: Array<{ name: string; rect: { x: number; y: number; width: number; height: number } }> = [];
      const minDimPct = 0.10;

      if (availableSpace.above.height > canvas.height * minDimPct) {
        safePlacements.push({
          name: "top-strip",
          rect: { x: 0, y: 0, width: canvas.width, height: availableSpace.above.to },
        });
      }
      if (availableSpace.below.height > canvas.height * minDimPct) {
        safePlacements.push({
          name: "lower-third",
          rect: { x: 0, y: availableSpace.below.from, width: canvas.width, height: availableSpace.below.height },
        });
      }
      if (availableSpace.left.width > canvas.width * minDimPct) {
        safePlacements.push({
          name: "left-panel",
          rect: { x: 0, y: 0, width: availableSpace.left.to, height: canvas.height },
        });
      }
      if (availableSpace.right.width > canvas.width * minDimPct) {
        safePlacements.push({
          name: "right-panel",
          rect: { x: availableSpace.right.from, y: 0, width: availableSpace.right.width, height: canvas.height },
        });
      }
      if (safePlacements.length === 0) {
        safePlacements.push({
          name: "top-strip-tight",
          rect: { x: 0, y: 0, width: canvas.width, height: Math.max(50, boundsTop) },
        });
      }

      // Normalized 0-1 coordinates (for scene-local conversion downstream)
      const normalized = {
        bbox: {
          x: boundsLeft / canvas.width,
          y: boundsTop / canvas.height,
          w: (boundsRight - boundsLeft) / canvas.width,
          h: (boundsBottom - boundsTop) / canvas.height,
        },
        center: {
          x: centerX / canvas.width,
          y: centerY / canvas.height,
        },
      };

      const result = {
        canvas: { width: canvas.width, height: canvas.height },
        speaker: {
          bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight },
          center: { x: centerX, y: centerY },
          normalized,
        },
        availableSpace,
        safePlacements,
        source,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error getting speaker position: ${errorMessage(err)}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Segmentation tools — request/poll person matte extraction from worker
// ---------------------------------------------------------------------------

server.registerTool(
  "request_segmentation",
  {
    description:
      "Request background segmentation (person alpha matte extraction) for one or more " +
      "time ranges. Each range produces a separate matte video saved to public/matte/{sceneId}.mp4. " +
      "Returns jobIds for polling with check_segmentation_status. Requires API_INTERNAL_URL, " +
      "PROJECT_ID, and VIDEO_KEY env vars (set by sandbox orchestrator).",
    inputSchema: {
      ranges: z.array(z.object({
        startMs: z.number().describe("Start of time range in milliseconds"),
        endMs: z.number().describe("End of time range in milliseconds"),
        sceneId: z.string().describe("Scene identifier (e.g. 'scene-1'). Used as output filename."),
      })).min(1).describe("Time ranges to segment"),
    },
  },
  async ({ ranges }: { ranges: Array<{ startMs: number; endMs: number; sceneId: string }> }) => {
    try {
      if (!API_INTERNAL_URL || !PROJECT_ID) {
        return {
          content: [{
            type: "text" as const,
            text: "Segmentation not available: API_INTERNAL_URL or PROJECT_ID env vars not set.",
          }],
          isError: true,
        };
      }
      if (!VIDEO_KEY) {
        return {
          content: [{
            type: "text" as const,
            text: "Segmentation not available: VIDEO_KEY env var not set. The sandbox orchestrator " +
              "must inject it alongside PROJECT_ID.",
          }],
          isError: true,
        };
      }

      // New inference API: one job per dispatch call. We pass the full ranges
      // array (stripped of sceneId — new schema doesn't accept it) and keep
      // per-scene metadata locally so check_segmentation_status can name
      // downloaded files consistently with the old behavior (primary sceneId
      // as the shared matte/fgr/bbox filename, per-scene bg — though bg is
      // now deprecated, see TODO in check_segmentation_status).
      const apiRanges = ranges.map(r => ({ startMs: r.startMs, endMs: r.endMs }));
      const allSceneIds = ranges.map(r => r.sceneId);
      const primarySceneId = ranges[0].sceneId;

      const res = await fetch(`${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/inference`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SANDBOX_SECRET}`,
        },
        body: JSON.stringify({
          capability: "segment-speaker",
          input: {
            videoKey: VIDEO_KEY,
            ranges: apiRanges,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`API returned ${res.status}: ${(err as any).error || res.statusText}`);
      }

      const data = await res.json() as { jobId: string };
      const jobIds = [data.jobId];
      jobSceneMeta.set(data.jobId, { primarySceneId, allSceneIds });

      // Rough estimate — the new API doesn't echo one back. Preserve the old
      // shape so the agent's downstream reasoning (if any) still works.
      const estimatedDurationMs = 60_000 + ranges.length * 15_000;

      // All scenes share the same matte/fgr (full-video pass). Return the old
      // mattePaths shape for prompt compatibility.
      const mattePaths = ranges.map(r => ({
        sceneId: r.sceneId,
        mattePath: `public/matte/${primarySceneId}.mp4`,
        fgrPath: `public/matte/${primarySceneId}-fgr.mp4`,
        staticFile: `matte/${primarySceneId}.mp4`,
        fgrStaticFile: `matte/${primarySceneId}-fgr.mp4`,
        bgStaticFile: `bg-${r.sceneId}.png`,
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            jobIds,
            estimatedDurationMs,
            mattePaths,
            nextStep: "Poll with check_segmentation_status({ jobIds }) until allComplete is true.",
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error requesting segmentation: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "check_segmentation_status",
  {
    description:
      "Check the status of previously requested segmentation jobs. When a job completes, " +
      "the matte/fgr/bbox files are automatically downloaded to public/matte/{sceneId}.mp4 " +
      "(and -fgr.mp4, -bbox.json). Returns per-job status, allComplete flag, and anyFailed flag. " +
      "Set waitForCompletion=true to wait up to timeoutMs (default 180s) for the job to finish via " +
      "the inference SSE stream. This avoids repeated tool calls — the tool handles waiting internally.",
    inputSchema: {
      jobIds: z.array(z.string()).min(1).describe("Job IDs returned by request_segmentation"),
      waitForCompletion: z.boolean().optional().default(false).describe(
        "If true, wait on the SSE stream until all jobs finish or timeoutMs elapses. " +
        "If false, do a short (5s) read of the stream and return whatever state has arrived."
      ),
      timeoutMs: z.number().optional().default(180_000).describe("Max wait time in ms when waitForCompletion=true (default 180s)"),
    },
  },
  async ({ jobIds, waitForCompletion = false, timeoutMs = 180_000 }: { jobIds: string[]; waitForCompletion?: boolean; timeoutMs?: number }) => {
    try {
      if (!API_INTERNAL_URL || !PROJECT_ID) {
        return {
          content: [{
            type: "text" as const,
            text: "Segmentation not available: API_INTERNAL_URL or PROJECT_ID env vars not set.",
          }],
          isError: true,
        };
      }

      const startTime = Date.now();
      // Without waitForCompletion, use a short snapshot window (5s): the new
      // API has no "get current state" endpoint — the SSE stream is the only
      // status channel. If already terminal in DB, the server emits and closes
      // immediately; otherwise we just report `running` and let the agent
      // call again.
      const deadlineMs = waitForCompletion
        ? startTime + timeoutMs
        : startTime + 5_000;

      // Read each job's SSE stream in parallel. readInferenceStream returns
      // null if the stream ended without a terminal event (e.g. still running
      // and snapshot window elapsed).
      const results = await Promise.all(
        jobIds.map(async (jobId) => {
          try {
            const terminal = await readInferenceStream(jobId, { deadlineMs });
            return { jobId, terminal, err: null as Error | null };
          } catch (err) {
            return { jobId, terminal: null, err: err as Error };
          }
        }),
      );

      // Assemble a jobs[] shape compatible with the old response. Values per
      // job: status is 'complete'|'failed'|'running'; outputKey is the matte
      // MinIO key on completion; sceneId is the primary scene recorded at
      // request time.
      await mkdir(MATTE_DIR, { recursive: true });
      const downloaded: string[] = [];
      const jobs: Array<{
        jobId: string;
        status: "complete" | "failed" | "running";
        progress: number;
        sceneId: string | null;
        outputKey: string | null;
        error: string | null;
      }> = [];

      for (const r of results) {
        const meta = jobSceneMeta.get(r.jobId) ?? null;
        const primarySceneId = meta?.primarySceneId ?? null;
        const allSceneIds = meta?.allSceneIds ?? (primarySceneId ? [primarySceneId] : []);

        if (r.err) {
          jobs.push({
            jobId: r.jobId,
            status: "failed",
            progress: 0,
            sceneId: primarySceneId,
            outputKey: null,
            error: r.err.message,
          });
          continue;
        }

        if (!r.terminal) {
          // No terminal event in the snapshot window — still running.
          jobs.push({
            jobId: r.jobId,
            status: "running",
            progress: 0,
            sceneId: primarySceneId,
            outputKey: null,
            error: null,
          });
          continue;
        }

        if (r.terminal.kind === "error" || r.terminal.data.status !== "completed") {
          const errMsg = typeof r.terminal.data.error === "string"
            ? r.terminal.data.error
            : r.terminal.data.error?.message ?? r.terminal.data.status;
          jobs.push({
            jobId: r.jobId,
            status: "failed",
            progress: 0,
            sceneId: primarySceneId,
            outputKey: null,
            error: errMsg ?? "unknown error",
          });
          continue;
        }

        // Terminal complete — download artifacts from MinIO directly.
        const output = r.terminal.data.output;
        if (!output || !primarySceneId) {
          jobs.push({
            jobId: r.jobId,
            status: "failed",
            progress: 100,
            sceneId: primarySceneId,
            outputKey: null,
            error: !output
              ? "complete event missing output keys"
              : "no sceneId metadata found for jobId (request_segmentation must be called from the same process)",
          });
          continue;
        }

        const localMattePath = path.join(MATTE_DIR, `${primarySceneId}.mp4`);
        const localFgrPath = path.join(MATTE_DIR, `${primarySceneId}-fgr.mp4`);
        const localBboxPath = path.join(MATTE_DIR, `${primarySceneId}-bbox.json`);
        const localProxyMattePath = path.join(MATTE_DIR, `${primarySceneId}-proxy.mp4`);
        const localProxyFgrPath = path.join(MATTE_DIR, `${primarySceneId}-fgr-proxy.mp4`);

        const downloadPairs: Array<[string, string]> = [
          [output.matteKey, localMattePath],
          [output.fgrKey, localFgrPath],
          [output.bboxKey, localBboxPath],
          [output.proxyMatteKey, localProxyMattePath],
          [output.proxyFgrKey, localProxyFgrPath],
        ];

        for (const [key, destPath] of downloadPairs) {
          let exists = false;
          try { await stat(destPath); exists = true; } catch { /* needs download */ }
          if (exists) continue;
          try {
            await downloadMinioObject(key, destPath);
          } catch (dlErr) {
            console.error(`[asset-server] Failed to download ${key} → ${destPath}:`, dlErr);
          }
        }

        // If proxies were not provided by the pipeline (older runs) fall back
        // to generating them locally. The new RVM pipeline produces proxies
        // upstream, so this usually no-ops.
        for (const fullPath of [localMattePath, localFgrPath]) {
          let srcExists = false;
          try { await stat(fullPath); srcExists = true; } catch { /* not downloaded */ }
          if (!srcExists) continue;
          const proxyPath = fullPath.replace(".mp4", "-proxy.mp4");
          let proxyExists = false;
          try { await stat(proxyPath); proxyExists = true; } catch { /* not yet generated */ }
          if (proxyExists) continue;
          try {
            await execFileAsync("ffmpeg", [
              "-i", fullPath, "-vf", "scale=-2:480",
              "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
              "-y", proxyPath,
            ], { timeout: 30_000 });
          } catch { /* non-critical */ }
        }

        // TODO: per-scene background images (bg-{sceneId}.png) are no longer
        // auto-generated by the inference pipeline — the legacy worker job
        // produced them via OpenAI inside the segmentation job, but the new
        // `segment-speaker` capability is pure RVM (matte + fgr + bbox only).
        // Scenes that relied on bg-{sceneId}.png must request backgrounds via
        // a separate tool (not yet implemented — planned future capability).
        // We keep the mattePaths.bgStaticFile field in the response for
        // prompt compatibility, but the file will not exist on disk.

        // All scenes sharing this matte reference the same primary files.
        for (const sid of allSceneIds) {
          downloaded.push(sid);
        }

        jobs.push({
          jobId: r.jobId,
          status: "complete",
          progress: 100,
          sceneId: primarySceneId,
          outputKey: output.matteKey,
          error: null,
        });
      }

      const allComplete = jobs.length > 0 && jobs.every(j => j.status === "complete");
      const anyFailed = jobs.some(j => j.status === "failed");

      // Re-sync assets to MinIO so presigned URLs include newly downloaded matte files.
      // (Assets are in the local sandbox workspace; sync-assets uploads them back
      // under the project's asset prefix for the editor frontend to fetch.)
      if (downloaded.length > 0) {
        try {
          await fetch("http://localhost:8081/sync-assets", {
            method: "POST",
            signal: AbortSignal.timeout(30_000),
          });
        } catch {
          // Non-critical — editing still works via proxy fallback
        }
      }

      // Build response. Preserve the old top-level keys exactly:
      //   { jobs, allComplete, anyFailed, downloaded, pollCount, elapsedMs, mattePaths }
      // pollCount is kept for shape stability (always 1 now — we read the
      // stream once rather than poll).
      const primarySceneIdForPaths = downloaded.length > 0
        ? (jobs.find(j => j.status === "complete")?.sceneId ?? downloaded[0])
        : null;

      const uniqueScenes = Array.from(new Set(downloaded));
      const result = {
        jobs,
        allComplete,
        anyFailed,
        downloaded: uniqueScenes,
        downloadedScenes: uniqueScenes,
        pollCount: 1,
        elapsedMs: Date.now() - startTime,
        mattePaths: uniqueScenes.map(id => ({
          sceneId: id,
          mattePath: `public/matte/${primarySceneIdForPaths}.mp4`,
          fgrPath: `public/matte/${primarySceneIdForPaths}-fgr.mp4`,
          bgPath: `public/bg-${id}.png`,
          staticFile: `matte/${primarySceneIdForPaths}.mp4`,
          fgrStaticFile: `matte/${primarySceneIdForPaths}-fgr.mp4`,
          bgStaticFile: `bg-${id}.png`,
        })),
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error checking segmentation status: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_depth_compositing_info",
  {
    description:
      "Check if person segmentation mattes are available and get compositing instructions. " +
      "Returns which scenes have mattes, the file paths, and usage instructions for " +
      "depth-aware compositing (placing graphics behind the speaker). " +
      "Call this before implementing scenes that need depth layering.",
    inputSchema: {},
  },
  async () => {
    try {
      // Check if matte directory exists and list available mattes
      let matteFiles: string[] = [];
      let entries: string[] = [];
      try {
        entries = await readdir(MATTE_DIR);
        matteFiles = entries.filter(f => f.endsWith(".mp4") && !f.endsWith("-fgr.mp4"));
      } catch {
        // Directory doesn't exist — no mattes available
      }

      // Segmentation is available whenever the sandbox has API access
      const segmentationEnabled = !!(API_INTERNAL_URL && PROJECT_ID);

      const scenes = matteFiles.map(f => {
        const sceneId = f.replace(".mp4", "");
        const hasFgr = entries.includes(`${sceneId}-fgr.mp4`);
        return {
          sceneId,
          mattePath: `public/matte/${f}`,
          staticFile: `matte/${f}`,
          fgrPath: hasFgr ? `public/matte/${sceneId}-fgr.mp4` : null,
          fgrStaticFile: hasFgr ? `matte/${sceneId}-fgr.mp4` : null,
          bgPath: `public/bg-${sceneId}.png`,
          bgStaticFile: `bg-${sceneId}.png`,
        };
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            available: matteFiles.length > 0,
            segmentationEnabled,
            scenes,
            totalMattes: matteFiles.length,
            techniques: matteFiles.length > 0 ? {
              behindSpeaker: {
                description: "Place graphics behind the speaker using the matte compositing stack.",
                usage: [
                  "1. V1 (position 1): Clean background image — replaces source video behind everything.",
                  "2. V2 (position 2): Behind-speaker animations — rendered between bg and matte.",
                  "3. V3 (position 3): Matte item (fgr + alpha) — composites the speaker cutout.",
                  "4. V4 (position 4): In-front-of-speaker animations — rendered on top of speaker.",
                  "5. Use SPEAKER.bboxPx and VISIBLE_ZONES constants for spatial positioning.",
                ],
              },
              depthParallax: {
                description: "Create depth-of-field parallax with foreground/background separation.",
                usage: [
                  "1. Place background elements on V2 (position 2) with slower parallax speed.",
                  "2. The matte on V3 (position 3) provides the natural depth separator.",
                  "3. Add foreground elements on V4 (position 4) for additional depth layering.",
                ],
              },
            } : null,
            hint: matteFiles.length === 0 && segmentationEnabled
              ? "No mattes yet. Use request_segmentation to generate them for specific scenes."
              : matteFiles.length === 0
              ? "Segmentation not available in this workspace."
              : undefined,
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error getting depth compositing info: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  await ensureAssetsDir();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[asset-server] Running, workspace=${WORKSPACE}, assets=${ASSETS_DIR}`
  );
}

main().catch((err: unknown) => {
  console.error("[asset-server] Fatal:", err);
  process.exit(1);
});
