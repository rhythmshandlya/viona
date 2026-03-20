#!/usr/bin/env node

/**
 * Viewport Dimension MCP Server for the Animator agent.
 *
 * Provides tools:
 *   get_scene_dimensions   – read manifest.json and return effective dimensions for all or one scene item
 *   validate_scene_code    – check if a scene file correctly uses effective dimensions
 *
 * Usage:
 *   node viewport-server.js --workspace /path/to/remotion-project
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseWorkspace } from "./lib/parse-args.js";
import { errorMessage } from "./lib/errors.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canvas dimensions from the manifest. */
interface CanvasDimensions {
  width: number;
  height: number;
}

/** Transform on a manifest item (may contain width/height overrides). */
interface ItemTransform {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  rotation?: number;
  opacity?: number;
}

/** Shape of each item entry in manifest.json. */
interface ManifestItem {
  id: string;
  type: string;
  trackId: string;
  startMs: number;
  endMs: number;
  data: Record<string, unknown>;
  transform?: ItemTransform;
}

/** The manifest.json structure (relevant fields). */
interface ManifestJson {
  version?: number;
  fps?: number;
  durationMs?: number;
  canvas: CanvasDimensions;
  tracks?: unknown[];
  items: ManifestItem[];
}

/** Return type of findManifest(). */
interface ManifestResult {
  path: string;
  data: ManifestJson;
}

/** Return type of validateSceneCode(). */
interface ValidationResult {
  sceneIndex: number;
  sceneNumber: number;
  effectiveWidth: number | string;
  effectiveHeight: number | string;
  issues: string[];
  warnings: string[];
  valid: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WORKSPACE = parseWorkspace();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dimension value (from transform) against the canvas reference.
 * Handles numeric, percentage-string, and missing values.
 */
function resolveDimension(
  value: number | string | undefined,
  canvasRef: number,
): number {
  if (value == null) return canvasRef;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("%")) {
    return (parseFloat(value) / 100) * canvasRef;
  }
  const n = Number(value);
  return isNaN(n) ? canvasRef : n;
}

/**
 * Find manifest.json in the workspace.
 */
async function findManifest(): Promise<ManifestResult | null> {
  // Check workspace root first
  const rootManifest = path.join(WORKSPACE, "manifest.json");
  try {
    const content = await readFile(rootManifest, "utf-8");
    return { path: rootManifest, data: JSON.parse(content) as ManifestJson };
  } catch {
    // Not at root
  }

  // Fallback: check src/proj_* directories
  const srcDir = path.join(WORKSPACE, "src");
  try {
    const entries = await readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("proj_")) {
        const mPath = path.join(srcDir, entry.name, "manifest.json");
        try {
          const content = await readFile(mPath, "utf-8");
          return { path: mPath, data: JSON.parse(content) as ManifestJson };
        } catch {
          // Not found in this project dir, continue
        }
      }
    }
  } catch {
    // src dir doesn't exist
  }

  return null;
}

/**
 * Validate a scene file for correct effective dimension usage.
 */
function validateSceneCode(
  code: string,
  sceneIndex: number,
  effectiveWidth: number | string,
  effectiveHeight: number | string,
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const sceneNum = sceneIndex + 1;

  // Check 1: Uses effective dimensions from TIMING
  const ewPattern = new RegExp(`TIMING\\.scene${sceneNum}EffectiveWidth`);
  const ehPattern = new RegExp(`TIMING\\.scene${sceneNum}EffectiveHeight`);
  const hasEW = ewPattern.test(code);
  const hasEH = ehPattern.test(code);

  if (!hasEW) {
    issues.push(
      `Missing TIMING.scene${sceneNum}EffectiveWidth — scene must read its effective width from constants`
    );
  }
  if (!hasEH) {
    issues.push(
      `Missing TIMING.scene${sceneNum}EffectiveHeight — scene must read its effective height from constants`
    );
  }

  // Check 2: Has clipping container
  const hasOverflowHidden =
    /overflow:\s*['"]hidden['"]/i.test(code) ||
    /overflow:\s*'hidden'/i.test(code);
  if (!hasOverflowHidden) {
    issues.push(
      "Missing overflow: 'hidden' clipping container — content may leak outside effective area"
    );
  }

  // Check 3: Uses useVideoConfig width/height for positioning (BAD)
  const videoConfigDestructure =
    /const\s*\{[^}]*(?:width|height)[^}]*\}\s*=\s*useVideoConfig/g;
  const matches = code.match(videoConfigDestructure);
  if (matches) {
    // Check if width/height are used for positioning (not just fps)
    const usesWidthHeight =
      /\b(?:width|height)\b\s*[\*/\-+]/g.test(code) ||
      /style\s*=\s*\{[^}]*(?:width|height)\b/g.test(code);
    if (usesWidthHeight) {
      warnings.push(
        "Destructures width/height from useVideoConfig() — use TIMING.sceneNEffectiveWidth/Height instead for positioning. " +
          "useVideoConfig gives full canvas dimensions which may not match this scene's effective area."
      );
    }
  }

  // Check 4: Reversed interpolate inputRange (must be strictly monotonically increasing)
  // Catches patterns like interpolate(x, [400, 100], ...) where 400 > 100
  const interpolatePattern = /interpolate\s*\([^,]+,\s*\[([^\]]+)\]/g;
  let interpMatch: RegExpExecArray | null;
  while ((interpMatch = interpolatePattern.exec(code)) !== null) {
    const rangeStr = interpMatch[1];
    const values = rangeStr.split(',').map(s => {
      const trimmed = s.trim();
      const num = parseFloat(trimmed);
      return isNaN(num) ? null : num;
    });
    // Only check when all values are numeric literals (skip variable references)
    if (values.length >= 2 && values.every(v => v !== null)) {
      const nums = values as number[];
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] <= nums[i - 1]) {
          issues.push(
            `interpolate() inputRange is not strictly increasing: [${rangeStr.trim()}] — ` +
            `Remotion requires inputRange to be strictly monotonically increasing. ` +
            `Swap the order and adjust outputRange to match.`
          );
          break;
        }
      }
    }
  }

  // Check 5: Hardcoded pixel values for common sizing
  const hardcodedFontSize = /fontSize:\s*(\d{2,3})(?!\s*[*])/g;
  let fontMatch: RegExpExecArray | null;
  const hardcodedFonts: number[] = [];
  while ((fontMatch = hardcodedFontSize.exec(code)) !== null) {
    const size = parseInt(fontMatch[1], 10);
    if (size > 12) {
      hardcodedFonts.push(size);
    }
  }
  if (hardcodedFonts.length > 0) {
    warnings.push(
      `Hardcoded font sizes found: ${hardcodedFonts.join(", ")}px — prefer relative sizing like EH * 0.04 for responsive layouts`
    );
  }

  return {
    sceneIndex,
    sceneNumber: sceneNum,
    effectiveWidth,
    effectiveHeight,
    issues,
    warnings,
    valid: issues.length === 0,
  };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "viewport",
  version: "1.0.0",
});

/** Formatted scene info returned by get_scene_dimensions. */
interface FormattedScene {
  sceneNumber: number;
  itemId: string;
  effectiveWidth: number;
  effectiveHeight: number;
  aspectRatio: string;
  constantsKey: { width: string; height: string };
  designTips: string;
}

// -- get_scene_dimensions ---------------------------------------------------
server.registerTool(
  "get_scene_dimensions",
  {
    description:
      "Read manifest.json and return the effective dimensions and aspect ratio for each scene item (or a specific scene). " +
      "Dimensions are resolved from the item's transform if present, otherwise from the canvas. " +
      "Use this BEFORE writing any scene code to understand the viewport constraints.",
    inputSchema: {
      sceneNumber: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Specific scene number (1-based). Omit to get all scenes."),
    },
  },
  async ({ sceneNumber }: { sceneNumber?: number }) => {
    try {
      const result = await findManifest();
      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                "manifest.json not found. It should be at the workspace root or src/proj_<id>/manifest.json. " +
                "Make sure the workspace has been initialized.",
            },
          ],
          isError: true,
        };
      }

      const { data, path: manifestPath } = result;
      const canvas = data.canvas || { width: 1920, height: 1080 };
      const allItems = data.items || [];

      // Filter to scene-type items only
      const sceneItems = allItems.filter((item) => item.type === "scene");

      if (sceneItems.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `manifest.json at ${manifestPath} has no scene items.`,
            },
          ],
          isError: true,
        };
      }

      const formatScene = (item: ManifestItem, idx: number): FormattedScene => {
        const ew = resolveDimension(item.transform?.width, canvas.width);
        const eh = resolveDimension(item.transform?.height, canvas.height);
        const ar =
          `${(ew / eh).toFixed(3)}:1 (${ew > eh ? "landscape-ish" : ew === eh ? "square" : "portrait"})`;

        const formatted: FormattedScene = {
          sceneNumber: idx + 1,
          itemId: item.id,
          effectiveWidth: ew,
          effectiveHeight: eh,
          aspectRatio: ar,
          constantsKey: {
            width: `TIMING.scene${idx + 1}EffectiveWidth`,
            height: `TIMING.scene${idx + 1}EffectiveHeight`,
          },
          designTips:
            eh < 1200
              ? "Compact area. Dense layout. Horizontal arrangements. Larger relative font sizes."
              : "Standard area. Balanced layout.",
        };

        return formatted;
      };

      if (sceneNumber !== undefined) {
        const idx = sceneNumber - 1;
        if (idx < 0 || idx >= sceneItems.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Scene ${sceneNumber} not found. manifest.json has ${sceneItems.length} scene item(s).`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(formatScene(sceneItems[idx], idx), null, 2),
            },
          ],
        };
      }

      // Return all scenes
      const allScenes = sceneItems.map((s, i) => formatScene(s, i));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                manifestPath,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                totalScenes: sceneItems.length,
                scenes: allScenes,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading manifest.json: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// -- validate_scene_code ----------------------------------------------------
server.registerTool(
  "validate_scene_code",
  {
    description:
      "Validate that a scene's TypeScript/React code correctly uses effective dimensions. " +
      "Checks for: effective dimension usage from TIMING, clipping container, " +
      "and warns about hardcoded pixel values. Run this AFTER writing scene code.",
    inputSchema: {
      scenePath: z
        .string()
        .describe(
          "Path to the scene file relative to workspace (e.g., 'src/proj_abc/scenes/Scene1.tsx')"
        ),
      sceneNumber: z
        .number()
        .int()
        .min(1)
        .describe("The scene number (1-based) — used to check correct TIMING keys"),
    },
  },
  async ({
    scenePath,
    sceneNumber,
  }: {
    scenePath: string;
    sceneNumber: number;
  }) => {
    try {
      // Read the scene file
      const fullPath = path.isAbsolute(scenePath)
        ? scenePath
        : path.join(WORKSPACE, scenePath);
      const code = await readFile(fullPath, "utf-8");

      // Find manifest for metadata
      const result = await findManifest();
      const canvas = result?.data?.canvas || { width: 1920, height: 1080 };
      const allItems = result?.data?.items || [];
      const sceneItems = allItems.filter((item) => item.type === "scene");
      const sceneIdx = sceneNumber - 1;
      const sceneItem: ManifestItem | undefined = sceneItems[sceneIdx];

      const ew = sceneItem
        ? resolveDimension(sceneItem.transform?.width, canvas.width)
        : canvas.width;
      const eh = sceneItem
        ? resolveDimension(sceneItem.transform?.height, canvas.height)
        : canvas.height;

      const validation = validateSceneCode(code, sceneIdx, ew, eh);

      const summary = validation.valid
        ? `Scene ${sceneNumber} PASSES validation.`
        : `Scene ${sceneNumber} has ${validation.issues.length} issue(s) that need fixing.`;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...validation,
                summary,
                filePath: fullPath,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error validating scene: ${errorMessage(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// -- submit_verdict -----------------------------------------------------------
server.registerTool(
  "submit_verdict",
  {
    description:
      "Submit your verification verdict as structured data. " +
      "You MUST call this tool exactly once at the end of your verification. " +
      "Do NOT write PASS or FAIL as text — use this tool instead.",
    inputSchema: {
      passed: z
        .boolean()
        .describe(
          "true if the scene/composition passes all checks, false if issues were found"
        ),
      issues: z
        .array(z.string())
        .describe(
          "List of specific issues found. Empty array if passed is true."
        ),
      acceptance_criteria: z
        .array(z.string())
        .optional()
        .describe(
          "Checklist items the fix agent must satisfy. Only include when passed is false."
        ),
    },
  },
  async ({
    passed,
    issues,
    acceptance_criteria,
  }: {
    passed: boolean;
    issues: string[];
    acceptance_criteria?: string[];
  }) => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            passed,
            issues,
            acceptance_criteria: acceptance_criteria || [],
          }),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[viewport-server] Running, workspace=${WORKSPACE}`);
}

main().catch((err: unknown) => {
  console.error("[viewport-server] Fatal:", err);
  process.exit(1);
});
