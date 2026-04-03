#!/usr/bin/env node

/**
 * Asset Download MCP Server for the Animator agent.
 *
 * Provides tools:
 *   download_file             - fetch any URL -> save to public/assets/{filename}
 *   search_unsplash           - search Unsplash API, return results
 *   search_pexels             - search Pexels API, return results
 *   download_stock_photo      - download from Unsplash/Pexels with attribution headers
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
import { Open as unzipOpen } from "unzipper";
import { parseWorkspace } from "./lib/parse-args.js";
import { errorMessage } from "./lib/errors.js";
import {
  computeCoverTransform,
  computeCenterCrop,
  sourceToCanvas,
} from './utils/cover-transform.js';

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
const MATTE_DIR: string = path.join(WORKSPACE, "public", "matte");

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
      "Search Pexels for stock photos. Returns a list of results with download URLs. Requires PEXELS_API_KEY env var.",
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
    },
  },
  async ({ query, count }: { query: string; count: number }) => {
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
            text: `Error searching Pexels: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// -- download_stock_photo ---------------------------------------------------
server.registerTool(
  "download_stock_photo",
  {
    description:
      "Download a stock photo from Unsplash or Pexels with proper attribution headers and save to public/assets/. Use after search_unsplash or search_pexels to download a chosen photo.",
    inputSchema: {
      url: z
        .string()
        .url()
        .describe("The photo download URL from search results"),
      filename: z
        .string()
        .describe("Target filename (e.g. 'hero-photo.jpg')"),
      source: z
        .enum(["unsplash", "pexels"])
        .describe("Which stock photo service the URL is from"),
    },
  },
  async ({
    url,
    filename,
    source,
  }: {
    url: string;
    filename: string;
    source: "unsplash" | "pexels";
  }) => {
    try {
      const validUrl = validateUrl(url);
      const safeName = sanitizeFilename(filename);
      await ensureAssetsDir();

      const headers: FetchHeaders = {};
      if (source === "unsplash" && UNSPLASH_ACCESS_KEY) {
        // Trigger Unsplash download tracking endpoint if it's a download_location URL
        if (validUrl.includes("api.unsplash.com")) {
          await fetch(validUrl, {
            headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT),
          }).catch(() => {});
        }
        headers["Authorization"] = `Client-ID ${UNSPLASH_ACCESS_KEY}`;
      }
      if (source === "pexels" && PEXELS_API_KEY) {
        headers["Authorization"] = PEXELS_API_KEY;
      }

      const buf = await safeFetch(validUrl, headers);
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
              source,
              attribution:
                source === "unsplash"
                  ? "Photo from Unsplash (https://unsplash.com)"
                  : "Photo from Pexels (https://pexels.com)",
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error downloading stock photo: ${errorMessage(err)}`,
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

      // 3. Compute average body center in source pixels from matte bbox
      let sumX = 0, sumY = 0;
      for (const mf of allBboxFrames) {
        // Matte bbox is normalized 0-1 — convert to source pixels
        sumX += (mf.x + mf.w / 2) * videoW;
        sumY += (mf.y + mf.h / 2) * videoH;
      }
      const faceCenterX = sumX / allBboxFrames.length;
      const faceCenterY = sumY / allBboxFrames.length;

      // 4. Find all video items and update crop
      const updated: Array<{ itemId: string; trackId: string; cropX: number; cropY: number }> = [];

      for (const item of manifest.items || []) {
        if (item.type !== "video") continue;

        // Item dimensions come from item.transform (not item.width/height)
        const t = item.transform || {};
        const itemW = typeof t.width === 'number' ? t.width : canvas.width;
        const itemH = typeof t.height === 'number' ? t.height : canvas.height;

        const crop = computeCenterCrop(
          faceCenterX, faceCenterY,
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
            faceCenter: {
              x: Math.round(faceCenterX),
              y: Math.round(faceCenterY),
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
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);

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

      const result = {
        canvas: { width: canvas.width, height: canvas.height },
        speaker: {
          bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight },
          center: { x: centerX, y: centerY },
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

// Deprecated alias — backward compat for prompts still referencing old name
server.registerTool(
  "get_speaker_grid",
  {
    description: "[Deprecated — use get_speaker_position] Get speaker position data for overlay placement.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          deprecated: true,
          message: "Use get_speaker_position instead for canvas-space coordinates.",
          hint: "Call get_speaker_position with { startMs, endMs }",
        }),
      }],
    };
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
      "Returns jobIds for polling with check_segmentation_status. Requires API_INTERNAL_URL " +
      "and PROJECT_ID env vars (set by sandbox orchestrator).",
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

      const res = await fetch(`${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SANDBOX_SECRET}`,
        },
        body: JSON.stringify({ ranges }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`API returned ${res.status}: ${(err as any).error || res.statusText}`);
      }

      const data = await res.json() as { jobIds: string[]; estimatedDurationMs: number };

      // Build expected matte paths for the caller
      const mattePaths = ranges.map(r => ({
        sceneId: r.sceneId,
        mattePath: `public/matte/${r.sceneId}.mp4`,
        staticFile: `matte/${r.sceneId}.mp4`,
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            jobIds: data.jobIds,
            estimatedDurationMs: data.estimatedDurationMs,
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
      "the matte video is automatically downloaded to public/matte/{sceneId}.mp4. " +
      "Returns per-job status, allComplete flag, and anyFailed flag.",
    inputSchema: {
      jobIds: z.array(z.string()).min(1).describe("Job IDs returned by request_segmentation"),
    },
  },
  async ({ jobIds }: { jobIds: string[] }) => {
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

      const params = new URLSearchParams({ jobIds: jobIds.join(",") });
      const res = await fetch(
        `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/status?${params}`,
        {
          headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`API returned ${res.status}: ${(err as any).error || res.statusText}`);
      }

      const data = await res.json() as {
        jobs: Array<{
          jobId: string;
          status: string;
          progress: number;
          sceneId: string | null;
          outputKey: string | null;
          error: string | null;
        }>;
        allComplete: boolean;
        anyFailed: boolean;
      };

      // Download completed mattes to local workspace.
      // One job produces ONE matte/fgr/bbox (shared across all overlay scenes)
      // plus N bg images (one per scene). All scenes reference the same matte.
      await mkdir(MATTE_DIR, { recursive: true });
      const downloaded: string[] = [];

      for (const job of data.jobs) {
        if (job.status === "complete" && job.sceneId) {
          const primarySceneId = job.sceneId;
          // allSceneIds from job metadata — all overlay scenes sharing this matte
          const allSceneIds: string[] = (job as any).allSceneIds ?? [primarySceneId];

          // Download matte/fgr/bbox ONCE using the primary scene ID
          const localMattePath = path.join(MATTE_DIR, `${primarySceneId}.mp4`);
          const localBboxPath = path.join(MATTE_DIR, `${primarySceneId}-bbox.json`);
          const localFgrPath = path.join(MATTE_DIR, `${primarySceneId}-fgr.mp4`);

          // Download matte video (skip if already exists)
          try {
            await stat(localMattePath);
          } catch {
            try {
              const matteRes = await fetch(
                `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/matte`,
                {
                  headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
                  signal: AbortSignal.timeout(60_000),
                }
              );
              if (matteRes.ok) {
                const buf = Buffer.from(await matteRes.arrayBuffer());
                await writeFile(localMattePath, buf);
              }
            } catch (dlErr) {
              console.error(`[asset-server] Failed to download matte for ${primarySceneId}:`, dlErr);
            }
          }

          // Download bbox JSON (skip if already exists)
          try {
            await stat(localBboxPath);
          } catch {
            try {
              const bboxRes = await fetch(
                `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/bbox`,
                {
                  headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
                  signal: AbortSignal.timeout(15_000),
                }
              );
              if (bboxRes.ok) {
                const text = await bboxRes.text();
                await writeFile(localBboxPath, text);
              }
            } catch {
              // Bbox download is best-effort — speaker position falls back to defaults
            }
          }

          // Download foreground video (skip if already exists)
          try {
            await stat(localFgrPath);
          } catch {
            try {
              const fgrRes = await fetch(
                `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/fgr`,
                {
                  headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
                  signal: AbortSignal.timeout(60_000),
                }
              );
              if (fgrRes.ok) {
                const buf = Buffer.from(await fgrRes.arrayBuffer());
                await writeFile(localFgrPath, buf);
              }
            } catch {
              // Foreground download is best-effort
            }
          }

          // Download per-scene background images
          for (const sid of allSceneIds) {
            const localBgPath = path.join(WORKSPACE, "public", `bg-${sid}.png`);
            try {
              await stat(localBgPath);
            } catch {
              try {
                const bgRes = await fetch(
                  `${API_INTERNAL_URL}/internal/sandbox/${PROJECT_ID}/segment/${job.jobId}/bg?sceneId=${sid}`,
                  {
                    headers: { "Authorization": `Bearer ${SANDBOX_SECRET}` },
                    signal: AbortSignal.timeout(30_000),
                  }
                );
                if (bgRes.ok) {
                  const buf = Buffer.from(await bgRes.arrayBuffer());
                  await writeFile(localBgPath, buf);
                }
              } catch {
                // Background download is best-effort
              }
            }
          }

          // All scenes share the same matte/fgr/bbox (full-video), only bg differs
          for (const sid of allSceneIds) {
            downloaded.push(sid);
          }
        }
      }

      // Build response: all scenes reference the primary matte/fgr, own bg
      const primarySceneId = downloaded.length > 0
        ? (data.jobs.find(j => j.status === "complete")?.sceneId ?? downloaded[0])
        : null;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...data,
            downloaded,
            mattePaths: downloaded.map(id => ({
              sceneId: id,
              // All scenes share the primary scene's matte/fgr (full-video coverage)
              mattePath: `public/matte/${primarySceneId}.mp4`,
              fgrPath: `public/matte/${primarySceneId}-fgr.mp4`,
              bgPath: `public/bg-${id}.png`,
              staticFile: `matte/${primarySceneId}.mp4`,
              fgrStaticFile: `matte/${primarySceneId}-fgr.mp4`,
              bgStaticFile: `bg-${id}.png`,
            })),
          }),
        }],
      };
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
      try {
        const entries = await readdir(MATTE_DIR);
        matteFiles = entries.filter(f => f.endsWith(".mp4"));
      } catch {
        // Directory doesn't exist — no mattes available
      }

      // Segmentation is available whenever the sandbox has API access
      const segmentationEnabled = !!(API_INTERNAL_URL && PROJECT_ID);

      const scenes = matteFiles.map(f => {
        const sceneId = f.replace(".mp4", "");
        return {
          sceneId,
          mattePath: `public/matte/${f}`,
          staticFile: `matte/${f}`,
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
                description: "Place graphics behind the speaker using the person track's alpha matte compositing.",
                usage: [
                  "1. The person track automatically handles matte compositing — no manual setup needed.",
                  "2. Place behind-speaker animations on the scene-bg track (position 1).",
                  "3. Place in-front-of-speaker animations on the scene-fg track (position 3).",
                  "4. The person matte layer (position 2) composites the speaker between the two.",
                  "5. Use SPEAKER.bboxPx and VISIBLE_ZONES constants for spatial positioning.",
                ],
              },
              depthParallax: {
                description: "Create depth-of-field parallax with foreground/background separation.",
                usage: [
                  "1. Render background elements on scene-bg with slower parallax speed.",
                  "2. The person matte layer provides the natural depth separator.",
                  "3. Add foreground elements on scene-fg for additional depth layering.",
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
