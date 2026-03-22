#!/usr/bin/env node

/**
 * Asset Download MCP Server for the Animator agent.
 *
 * Provides tools:
 *   download_file        - fetch any URL -> save to public/assets/{filename}
 *   search_unsplash      - search Unsplash API, return results
 *   search_pexels        - search Pexels API, return results
 *   download_stock_photo - download from Unsplash/Pexels with attribution headers
 *   auto_center_speaker  - adjust video crop to center the speaker's face
 *   get_speaker_position - canvas-space speaker coordinates for overlay placement
 *   get_shot_boundaries  - detected camera cuts aligned with transcript
 *
 * Usage:
 *   node asset-server.js --workspace /path/to/remotion-project
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile, mkdir, readFile } from "node:fs/promises";
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

/** Bounding box for a detected face in pixel coordinates. */
interface FaceBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single frame of head tracking data. */
interface HeadTrackingFrame {
  frame?: number;
  timestamp_ms: number;
  face?: {
    bbox: FaceBbox;
    landmarks?: Record<string, { x: number; y: number }>;
  } | null;
  body?: {
    left_shoulder?: { x: number; y: number; visible?: boolean };
    right_shoulder?: { x: number; y: number; visible?: boolean };
    left_hand?: { x: number; y: number; visible?: boolean };
    right_hand?: { x: number; y: number; visible?: boolean };
  } | null;
  confidence?: number;
  detection_failed?: boolean;
}

/** Full head tracking data file structure. */
interface HeadTrackingData {
  video?: {
    width?: number;
    height?: number;
  };
  frames: HeadTrackingFrame[];
  shots?: Array<{
    frame: number;
    timestamp_ms: number;
    score: number;
    signals: string[];
  }>;
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
      "Automatically adjust the video item's crop to center the speaker's face. " +
      "Reads head tracking data and the manifest, computes optimal objectPosition " +
      "percentages, and writes updated crop values back to the manifest. " +
      "Call this after placing video items in the timeline (Phase 5 Layout).",
    inputSchema: {},
  },
  async () => {
    try {
      // 1. Read head tracking data
      const trackingPath = path.join(WORKSPACE, "docs", "speaker-grid.json");
      let trackingData: HeadTrackingData;
      try {
        trackingData = JSON.parse(await readFile(trackingPath, "utf-8"));
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              adjusted: false,
              reason: "No head tracking data available at docs/speaker-grid.json",
            }),
          }],
        };
      }

      const frames = trackingData.frames || [];
      const videoW = trackingData.video?.width || 1;
      const videoH = trackingData.video?.height || 1;

      // Filter to frames with face detections
      const withFace = frames.filter((f) => f.face?.bbox);
      if (withFace.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              adjusted: false,
              reason: "No face detections found in tracking data. Keeping default crop.",
            }),
          }],
        };
      }

      // 2. Compute average face center in source pixels
      let sumX = 0, sumY = 0;
      for (const f of withFace) {
        const b = f.face!.bbox;
        sumX += b.x + b.width / 2;
        sumY += b.y + b.height / 2;
      }
      const faceCenterX = sumX / withFace.length;
      const faceCenterY = sumY / withFace.length;

      // 3. Read manifest to find video items and canvas dimensions
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };

      // Find all video items (manifest uses flat items[] array with trackId references)
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
// Speaker position tool — canvas-space coordinates with cover-crop transform
// ---------------------------------------------------------------------------

interface SpeakerPositionResult {
  canvas: { width: number; height: number };
  videoTransform: {
    sourceSize: { width: number; height: number };
    coverScale: number;
    crop: { x: number; y: number; scale: number };
    visibleRegion: { x: number; y: number; width: number; height: number };
  };
  speaker: {
    bounds: { top: number; bottom: number; left: number; right: number };
    face: { x: number; y: number; width: number; height: number };
    shoulderLine: number;
    hands: {
      left: { x: number; y: number; active: boolean };
      right: { x: number; y: number; active: boolean };
    };
    movement: "minimal" | "moderate" | "large";
  } | null;
  availableSpace: {
    above: { from: number; to: number; height: number };
    below: { from: number; to: number; height: number };
    left: { from: number; to: number; width: number };
    right: { from: number; to: number; width: number };
  };
  safePlacements: Array<{ name: string; rect: { x: number; y: number; width: number; height: number } }>;
  confidence: number;
}

server.registerTool(
  "get_speaker_position",
  {
    description:
      "Get the speaker's exact position on the canvas for a given time range. " +
      "Returns pixel coordinates in canvas space, accounting for objectFit:cover " +
      "and crop transforms. Includes face bbox, body bounds, shoulder line, hand " +
      "positions, available space in each direction, and concrete safe placement " +
      "rects for overlay elements. Use this when implementing overlay scenes to " +
      "avoid placing visuals on top of the speaker.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    try {
      // 1. Read head tracking data
      const trackingPath = path.join(WORKSPACE, "docs", "speaker-grid.json");
      let trackingData: HeadTrackingData;
      try {
        trackingData = JSON.parse(await readFile(trackingPath, "utf-8"));
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Head tracking data not available.",
              hint: "Design overlay with generous margins on all sides.",
            }),
          }],
          isError: true,
        };
      }

      const srcW = trackingData.video?.width || 1920;
      const srcH = trackingData.video?.height || 1080;

      // 2. Read manifest for video item geometry and canvas
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };

      // Find video item active during [startMs, endMs]
      // Manifest uses flat items[] array with trackId references
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

      // Video item dimensions from item.transform (not item.width/height)
      const vt = videoItem?.transform || {};
      const itemW = typeof vt.width === 'number' ? vt.width : canvas.width;
      const itemH = typeof vt.height === 'number' ? vt.height : canvas.height;
      const itemX = typeof vt.x === 'number' ? vt.x : 0;
      const itemY = typeof vt.y === 'number' ? vt.y : 0;
      const cropX = videoItem?.data?.crop?.x ?? 50;
      const cropY = videoItem?.data?.crop?.y ?? 50;
      const cropScale = videoItem?.data?.crop?.scale ?? 1;

      // 3. Compute cover transform
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);

      // Visible region in source pixels
      const visOffsetX = transform.offsetX / transform.baseCoverScale;
      const visOffsetY = transform.offsetY / transform.baseCoverScale;
      const visW = itemW / (transform.baseCoverScale * cropScale);
      const visH = itemH / (transform.baseCoverScale * cropScale);

      // 4. Filter tracking frames to time range
      const frames = (trackingData.frames || []).filter(
        (f) => f.timestamp_ms >= startMs && f.timestamp_ms <= endMs
      );
      const withFace = frames.filter((f) => f.face?.bbox);
      const confidence = frames.length > 0 ? withFace.length / frames.length : 0;

      if (withFace.length === 0) {
        // No detections — entire canvas is safe
        const result: SpeakerPositionResult = {
          canvas,
          videoTransform: {
            sourceSize: { width: srcW, height: srcH },
            coverScale: transform.baseCoverScale,
            crop: { x: cropX, y: cropY, scale: cropScale },
            visibleRegion: { x: Math.round(visOffsetX), y: Math.round(visOffsetY), width: Math.round(visW), height: Math.round(visH) },
          },
          speaker: null,
          availableSpace: {
            above: { from: 0, to: canvas.height, height: canvas.height },
            below: { from: 0, to: canvas.height, height: canvas.height },
            left: { from: 0, to: canvas.width, width: canvas.width },
            right: { from: 0, to: canvas.width, width: canvas.width },
          },
          safePlacements: [{ name: "entire-canvas", rect: { x: 0, y: 0, width: canvas.width, height: canvas.height } }],
          confidence: 0,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      }

      // 5. Transform all detections to canvas space and aggregate
      let boundsTop = Infinity, boundsBottom = -Infinity;
      let boundsLeft = Infinity, boundsRight = -Infinity;
      let faceSumX = 0, faceSumY = 0, faceSumW = 0, faceSumH = 0;
      let shoulderSumY = 0, shoulderCount = 0;
      let handLSumX = 0, handLSumY = 0, handLCount = 0;
      let handRSumX = 0, handRSumY = 0, handRCount = 0;
      const handLPositions: { x: number; y: number }[] = [];
      const handRPositions: { x: number; y: number }[] = [];
      const faceCenters: { x: number; y: number }[] = [];

      for (const f of withFace) {
        const bbox = f.face!.bbox;

        // Transform face bbox corners
        const topLeft = sourceToCanvas(bbox.x, bbox.y, transform, itemX, itemY);
        const bottomRight = sourceToCanvas(bbox.x + bbox.width, bbox.y + bbox.height, transform, itemX, itemY);

        const fX = Math.min(topLeft.x, bottomRight.x);
        const fY = Math.min(topLeft.y, bottomRight.y);
        const fW = Math.abs(bottomRight.x - topLeft.x);
        const fH = Math.abs(bottomRight.y - topLeft.y);

        faceSumX += fX; faceSumY += fY; faceSumW += fW; faceSumH += fH;
        faceCenters.push({ x: fX + fW / 2, y: fY + fH / 2 });

        // Update body bounds with face
        boundsTop = Math.min(boundsTop, fY);
        boundsBottom = Math.max(boundsBottom, fY + fH);
        boundsLeft = Math.min(boundsLeft, fX);
        boundsRight = Math.max(boundsRight, fX + fW);

        // Body landmarks
        if (f.body) {
          if (f.body.left_shoulder && f.body.left_shoulder.visible !== false) {
            const ls = sourceToCanvas(f.body.left_shoulder.x, f.body.left_shoulder.y, transform, itemX, itemY);
            shoulderSumY += ls.y; shoulderCount++;
            boundsBottom = Math.max(boundsBottom, ls.y);
            boundsLeft = Math.min(boundsLeft, ls.x);
            boundsRight = Math.max(boundsRight, ls.x);
          }
          if (f.body.right_shoulder && f.body.right_shoulder.visible !== false) {
            const rs = sourceToCanvas(f.body.right_shoulder.x, f.body.right_shoulder.y, transform, itemX, itemY);
            shoulderSumY += rs.y; shoulderCount++;
            boundsBottom = Math.max(boundsBottom, rs.y);
            boundsLeft = Math.min(boundsLeft, rs.x);
            boundsRight = Math.max(boundsRight, rs.x);
          }
          if (f.body.left_hand?.visible) {
            const lh = sourceToCanvas(f.body.left_hand.x, f.body.left_hand.y, transform, itemX, itemY);
            handLSumX += lh.x; handLSumY += lh.y; handLCount++;
            handLPositions.push(lh);
            boundsBottom = Math.max(boundsBottom, lh.y);
            boundsLeft = Math.min(boundsLeft, lh.x);
            boundsRight = Math.max(boundsRight, lh.x);
          }
          if (f.body.right_hand?.visible) {
            const rh = sourceToCanvas(f.body.right_hand.x, f.body.right_hand.y, transform, itemX, itemY);
            handRSumX += rh.x; handRSumY += rh.y; handRCount++;
            handRPositions.push(rh);
            boundsBottom = Math.max(boundsBottom, rh.y);
            boundsLeft = Math.min(boundsLeft, rh.x);
            boundsRight = Math.max(boundsRight, rh.x);
          }
        }
      }

      // Clamp bounds to canvas
      boundsTop = Math.max(0, Math.round(boundsTop));
      boundsBottom = Math.min(canvas.height, Math.round(boundsBottom));
      boundsLeft = Math.max(0, Math.round(boundsLeft));
      boundsRight = Math.min(canvas.width, Math.round(boundsRight));

      const n = withFace.length;
      const face = {
        x: Math.round(faceSumX / n),
        y: Math.round(faceSumY / n),
        width: Math.round(faceSumW / n),
        height: Math.round(faceSumH / n),
      };

      const shoulderLine = shoulderCount > 0 ? Math.round(shoulderSumY / shoulderCount) : face.y + face.height;

      // Hand activity — active if hand moves >15% of canvas height
      const handThreshold = canvas.height * 0.15;

      function isHandActive(positions: { x: number; y: number }[]): boolean {
        if (positions.length < 2) return false;
        let minY = Infinity, maxY = -Infinity;
        for (const p of positions) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        return (maxY - minY) > handThreshold;
      }

      const hands = {
        left: {
          x: handLCount > 0 ? Math.round(handLSumX / handLCount) : boundsLeft,
          y: handLCount > 0 ? Math.round(handLSumY / handLCount) : boundsBottom,
          active: isHandActive(handLPositions),
        },
        right: {
          x: handRCount > 0 ? Math.round(handRSumX / handRCount) : boundsRight,
          y: handRCount > 0 ? Math.round(handRSumY / handRCount) : boundsBottom,
          active: isHandActive(handRPositions),
        },
      };

      // Movement classification
      const canvasDiag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
      let movement: "minimal" | "moderate" | "large" = "minimal";
      if (faceCenters.length > 1) {
        const avgX = faceCenters.reduce((s, p) => s + p.x, 0) / faceCenters.length;
        const avgY = faceCenters.reduce((s, p) => s + p.y, 0) / faceCenters.length;
        const variance = faceCenters.reduce((s, p) => s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0) / faceCenters.length;
        const stddev = Math.sqrt(variance);
        const pct = stddev / canvasDiag * 100;
        if (pct >= 8) movement = "large";
        else if (pct >= 2) movement = "moderate";
      }

      // 6. Compute available space
      const margin = movement === "large" ? 80 : movement === "moderate" ? 40 : 20;
      const availableSpace = {
        above: { from: 0, to: Math.max(0, boundsTop - margin), height: Math.max(0, boundsTop - margin) },
        below: { from: Math.min(canvas.height, boundsBottom + margin), to: canvas.height, height: Math.max(0, canvas.height - boundsBottom - margin) },
        left: { from: 0, to: Math.max(0, boundsLeft - margin), width: Math.max(0, boundsLeft - margin) },
        right: { from: Math.min(canvas.width, boundsRight + margin), to: canvas.width, width: Math.max(0, canvas.width - boundsRight - margin) },
      };

      // 7. Generate safe placements
      const safePlacements: SpeakerPositionResult["safePlacements"] = [];
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

      const result: SpeakerPositionResult = {
        canvas,
        videoTransform: {
          sourceSize: { width: srcW, height: srcH },
          coverScale: transform.baseCoverScale,
          crop: { x: cropX, y: cropY, scale: cropScale },
          visibleRegion: { x: Math.round(visOffsetX), y: Math.round(visOffsetY), width: Math.round(visW), height: Math.round(visH) },
        },
        speaker: { bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight }, face, shoulderLine, hands, movement },
        availableSpace,
        safePlacements,
        confidence,
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
// Shot boundaries tool
// ---------------------------------------------------------------------------

server.registerTool(
  "get_shot_boundaries",
  {
    description:
      "Get detected camera angle changes (shot boundaries) in the source video. " +
      "Returns cut points aligned with transcript segment boundaries, with " +
      "surrounding transcript text for context. Use this when planning scenes " +
      "to align scene transitions with natural camera cuts. " +
      "If isMultiCam is true, prefer shot boundaries as scene transition points.",
    inputSchema: {},
  },
  async () => {
    try {
      const shotPath = path.join(WORKSPACE, "docs", "shot-boundaries.json");
      let shotData: any;
      try {
        shotData = JSON.parse(await readFile(shotPath, "utf-8"));
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              shots: [],
              summary: { totalShots: 0, averageShotDurationMs: 0, alignedCount: 0, isMultiCam: false },
              message: "No shot boundary data available. Plan scenes using transcript timing only.",
            }),
          }],
        };
      }

      // Build human-readable summary
      const summary = shotData.summary || {};
      const lines: string[] = [];
      if (summary.totalShots === 0) {
        lines.push("No camera cuts detected — single continuous take.");
      } else {
        const label = summary.isMultiCam ? "multi-cam" : "single-cam with cuts";
        lines.push(`Shot Boundaries (${summary.totalShots} detected, ${label}):`);
        lines.push(`  Average shot duration: ${Math.round((summary.averageShotDurationMs || 0) / 1000)}s`);
        lines.push(`  Transcript-aligned: ${summary.alignedCount || 0}/${summary.totalShots}`);
        lines.push("");

        for (let i = 0; i < (shotData.shots || []).length; i++) {
          const s = shotData.shots[i];
          const timeStr = formatMs(s.timestamp_ms);
          const snapStr = s.aligned && s.snappedTo_ms != null
            ? ` → snapped ${formatMs(s.snappedTo_ms)}`
            : "";
          lines.push(`  #${i + 1}  ${timeStr}${snapStr} (score ${s.score}) [${s.signals.join(", ")}]`);
          if (s.segmentBefore || s.segmentAfter) {
            const before = s.segmentBefore ? truncate(s.segmentBefore, 50) : "...";
            const after = s.segmentAfter ? truncate(s.segmentAfter, 50) : "...";
            lines.push(`       "${before}" → "${after}"`);
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: lines.join("\n") + "\n\n---\n\n" + JSON.stringify(shotData),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error reading shot boundaries: ${errorMessage(err)}` }],
        isError: true,
      };
    }
  }
);

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = ms % 1000;
  return `${min}:${String(sec).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

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
