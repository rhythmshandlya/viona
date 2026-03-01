#!/usr/bin/env node

/**
 * Asset Download MCP Server for the Animator agent.
 *
 * Provides tools:
 *   download_file      – fetch any URL → save to public/assets/{filename}
 *   screenshot         – Puppeteer screenshot → PNG in public/assets/
 *   search_unsplash    – search Unsplash API, return results
 *   search_pexels      – search Pexels API, return results
 *   download_stock_photo – download from Unsplash/Pexels with attribution headers
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const wsIdx = args.indexOf("--workspace");
const WORKSPACE = wsIdx !== -1 && args[wsIdx + 1] ? args[wsIdx + 1] : process.cwd();
const ASSETS_DIR = path.join(WORKSPACE, "public", "assets");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT = 30_000; // 30 s

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure the assets directory exists. */
async function ensureAssetsDir() {
  await mkdir(ASSETS_DIR, { recursive: true });
}

/** Block private / loopback IPs and non-http(s) schemes. */
function validateUrl(raw) {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  // Block obvious private ranges
  const blocked = [
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

/** Sanitise a filename – strip path separators, allow only safe characters. */
function sanitizeFilename(name) {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
}

/** Image extensions we'll look for when extracting from ZIP archives. */
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

/**
 * If `buf` is a ZIP archive, extract the first image file and return it.
 * Returns the original buffer unchanged if it's not a ZIP.
 */
async function extractImageFromZip(buf) {
  // ZIP magic bytes: PK\x03\x04
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
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
      // ZIP contains only vector files (EPS, AI) — no raster image to extract.
      // Throw so the caller gets a clear error instead of saving a ZIP as an image.
      const allFiles = directory.files.map((f) => f.path);
      throw new Error(`ZIP contains no raster images (files: ${allFiles.join(', ')})`);
    }

    const extracted = await imageFiles[0].buffer();
    console.error(`[asset-server] Extracted ${imageFiles[0].path} (${extracted.length} bytes) from ZIP archive`);
    return extracted;
  } catch (err) {
    console.error(`[asset-server] ZIP extraction failed: ${err.message}`);
    throw err;
  }
}

/** Fetch a URL with size and timeout guards. */
async function safeFetch(url, extraHeaders = {}) {
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
      throw new Error(`File too large: ${contentLength} bytes (max ${MAX_FILE_SIZE})`);
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
  async ({ url, filename }) => {
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
            type: "text",
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
        content: [{ type: "text", text: `Error downloading file: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// -- screenshot -------------------------------------------------------------
server.registerTool(
  "screenshot",
  {
    description:
      "Take a screenshot of a website and save it as a PNG to public/assets/{filename}. Useful for capturing app UIs, dashboards, or websites mentioned in the transcript.",
    inputSchema: {
      url: z.string().url().describe("The URL of the website to screenshot"),
      filename: z.string().describe("Target filename (e.g. 'github-screenshot.png')"),
      width: z
        .number()
        .int()
        .min(320)
        .max(3840)
        .optional()
        .default(1280)
        .describe("Viewport width in pixels (default 1280)"),
      height: z
        .number()
        .int()
        .min(240)
        .max(2160)
        .optional()
        .default(800)
        .describe("Viewport height in pixels (default 800)"),
      fullPage: z
        .boolean()
        .optional()
        .default(false)
        .describe("Capture the full scrollable page (default false)"),
    },
  },
  async ({ url, filename, width, height, fullPage }) => {
    let browser;
    try {
      const validUrl = validateUrl(url);
      const safeName = sanitizeFilename(filename.endsWith(".png") ? filename : `${filename}.png`);
      await ensureAssetsDir();

      // Dynamic import so the server can start even if puppeteer isn't installed
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: width || 1280, height: height || 800 });
      await page.goto(validUrl, { waitUntil: "networkidle2", timeout: FETCH_TIMEOUT });
      const buf = await page.screenshot({ fullPage: fullPage || false, type: "png" });

      const dest = path.join(ASSETS_DIR, safeName);
      await writeFile(dest, buf);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              path: `public/assets/${safeName}`,
              staticFile: `assets/${safeName}`,
              size: buf.length,
              viewport: { width: width || 1280, height: height || 800 },
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error taking screenshot: ${err.message}` }],
        isError: true,
      };
    } finally {
      if (browser) await browser.close().catch(() => {});
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
      query: z.string().describe("Search query (e.g. 'team collaboration office')"),
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
  async ({ query, count }) => {
    try {
      if (!UNSPLASH_ACCESS_KEY) {
        return {
          content: [
            {
              type: "text",
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

      if (!res.ok) throw new Error(`Unsplash API ${res.status}: ${res.statusText}`);
      const data = await res.json();

      const results = (data.results || []).map((photo) => ({
        id: photo.id,
        description: photo.description || photo.alt_description || "No description",
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
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error searching Unsplash: ${err.message}` }],
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
      query: z.string().describe("Search query (e.g. 'nature landscape sunset')"),
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
  async ({ query, count }) => {
    try {
      if (!PEXELS_API_KEY) {
        return {
          content: [
            {
              type: "text",
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

      if (!res.ok) throw new Error(`Pexels API ${res.status}: ${res.statusText}`);
      const data = await res.json();

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
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error searching Pexels: ${err.message}` }],
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
  async ({ url, filename, source }) => {
    try {
      const validUrl = validateUrl(url);
      const safeName = sanitizeFilename(filename);
      await ensureAssetsDir();

      const headers = {};
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
            type: "text",
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
        content: [{ type: "text", text: `Error downloading stock photo: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// -- get_speaker_grid -------------------------------------------------------
server.registerTool(
  "get_speaker_grid",
  {
    description:
      "Get a spatial grid showing where the speaker is located in the video for a given time range. Returns a 6x6 grid where 1=speaker present, 0=safe for overlay elements. Use this when implementing overlay scenes to avoid placing visuals on top of the speaker.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
      gridRows: z
        .number()
        .int()
        .min(2)
        .max(12)
        .optional()
        .default(6)
        .describe("Number of grid rows (default 6)"),
      gridCols: z
        .number()
        .int()
        .min(2)
        .max(12)
        .optional()
        .default(6)
        .describe("Number of grid columns (default 6)"),
    },
  },
  async ({ startMs, endMs, gridRows, gridCols }) => {
    try {
      const rows = gridRows || 6;
      const cols = gridCols || 6;

      // Find head_tracking.json in workspace (scans src/*/)
      const srcDir = path.join(WORKSPACE, "src");
      let trackingPath = null;
      try {
        const entries = await readdir(srcDir);
        for (const entry of entries) {
          const candidate = path.join(srcDir, entry, "head_tracking.json");
          try {
            await stat(candidate);
            trackingPath = candidate;
            break;
          } catch { /* not found, try next */ }
        }
      } catch { /* src dir may not exist */ }

      if (!trackingPath) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "Head tracking data not available for this project.",
              fallback: true,
              hint: "Design overlay with generous margins on all sides.",
            }),
          }],
          isError: true,
        };
      }

      const raw = JSON.parse(await readFile(trackingPath, "utf-8"));
      const frames = raw.frames || [];
      // Source video dimensions for normalizing pixel-coordinate bboxes
      const videoW = raw.video?.width || 1;
      const videoH = raw.video?.height || 1;

      // Filter frames by time range
      const filtered = frames.filter(
        (f) => f.timestamp_ms >= startMs && f.timestamp_ms <= endMs && f.face?.bbox
      );

      if (filtered.length === 0) {
        // No detections in range — entire frame is safe
        const emptyGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              grid: emptyGrid,
              occupancy: "0%",
              speakerBbox: null,
              safePlacement: ["entire frame"],
            }),
          }],
        };
      }

      // Build grid: project each face bbox onto the grid
      const cellHits = Array.from({ length: rows }, () => Array(cols).fill(0));

      for (const frame of filtered) {
        const b = frame.face.bbox; // {x, y, width, height} in pixels — normalize to 0-1
        const bx1 = b.x / videoW;
        const by1 = b.y / videoH;
        const bx2 = (b.x + b.width) / videoW;
        const by2 = (b.y + b.height) / videoH;

        for (let r = 0; r < rows; r++) {
          const cellY1 = r / rows;
          const cellY2 = (r + 1) / rows;
          for (let c = 0; c < cols; c++) {
            const cellX1 = c / cols;
            const cellX2 = (c + 1) / cols;
            // Check overlap
            if (bx1 < cellX2 && bx2 > cellX1 && by1 < cellY2 && by2 > cellY1) {
              cellHits[r][c]++;
            }
          }
        }
      }

      // Mark cells occupied if speaker present in >30% of filtered frames
      const threshold = filtered.length * 0.3;
      const grid = cellHits.map((row) =>
        row.map((count) => (count >= threshold ? 1 : 0))
      );

      // Compute occupancy
      const totalCells = rows * cols;
      const occupiedCells = grid.flat().filter((v) => v === 1).length;
      const occupancy = `${Math.round((occupiedCells / totalCells) * 100)}%`;

      // Compute aggregate bounding box (normalized to 0-1)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const frame of filtered) {
        const b = frame.face.bbox;
        minX = Math.min(minX, b.x / videoW);
        minY = Math.min(minY, b.y / videoH);
        maxX = Math.max(maxX, (b.x + b.width) / videoW);
        maxY = Math.max(maxY, (b.y + b.height) / videoH);
      }

      const speakerBbox = {
        x: `${Math.round(minX * 100)}%`,
        y: `${Math.round(minY * 100)}%`,
        w: `${Math.round((maxX - minX) * 100)}%`,
        h: `${Math.round((maxY - minY) * 100)}%`,
      };

      // Compute safe placement regions
      const safePlacement = [];
      const midRow = Math.floor(rows / 2);
      const midCol = Math.floor(cols / 2);

      const regions = {
        "top-left":     () => grid.slice(0, midRow).flatMap((r) => r.slice(0, midCol)).every((v) => v === 0),
        "top-right":    () => grid.slice(0, midRow).flatMap((r) => r.slice(midCol)).every((v) => v === 0),
        "bottom-left":  () => grid.slice(midRow).flatMap((r) => r.slice(0, midCol)).every((v) => v === 0),
        "bottom-right": () => grid.slice(midRow).flatMap((r) => r.slice(midCol)).every((v) => v === 0),
        "top":          () => grid[0].every((v) => v === 0),
        "bottom":       () => grid[rows - 1].every((v) => v === 0),
        "left":         () => grid.every((r) => r[0] === 0),
        "right":        () => grid.every((r) => r[cols - 1] === 0),
      };

      for (const [name, check] of Object.entries(regions)) {
        if (check()) safePlacement.push(name);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ grid, occupancy, speakerBbox, safePlacement }),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error reading speaker grid: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  await ensureAssetsDir();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[asset-server] Running, workspace=${WORKSPACE}, assets=${ASSETS_DIR}`);
}

main().catch((err) => {
  console.error("[asset-server] Fatal:", err);
  process.exit(1);
});
