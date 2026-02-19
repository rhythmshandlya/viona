#!/usr/bin/env node

/**
 * Viewport Dimension MCP Server for the Animator agent.
 *
 * Provides tools:
 *   get_scene_dimensions   – read scenes.json and return effective dimensions for all or one scene
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const wsIdx = args.indexOf("--workspace");
const WORKSPACE = wsIdx !== -1 && args[wsIdx + 1] ? args[wsIdx + 1] : process.cwd();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find scenes.json in the workspace. It could be at:
 *   src/proj_<id>/scenes.json
 * or directly provided. We search for it.
 */
async function findScenesJson() {
  const srcDir = path.join(WORKSPACE, "src");
  try {
    const entries = await readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("proj_")) {
        const scenesPath = path.join(srcDir, entry.name, "scenes.json");
        try {
          const content = await readFile(scenesPath, "utf-8");
          return { path: scenesPath, data: JSON.parse(content), projDir: entry.name };
        } catch {
          // Not found in this project dir, continue
        }
      }
    }
  } catch {
    // src dir doesn't exist
  }

  // Fallback: check workspace root
  try {
    const scenesPath = path.join(WORKSPACE, "scenes.json");
    const content = await readFile(scenesPath, "utf-8");
    return { path: scenesPath, data: JSON.parse(content), projDir: null };
  } catch {
    return null;
  }
}

/**
 * Validate a scene file for correct effective dimension usage.
 */
function validateSceneCode(code, sceneIndex, effectiveWidth, effectiveHeight, displayMode) {
  const issues = [];
  const warnings = [];
  const sceneNum = sceneIndex + 1;

  // Check 1: Uses effective dimensions from TIMING
  const ewPattern = new RegExp(`TIMING\\.scene${sceneNum}EffectiveWidth`);
  const ehPattern = new RegExp(`TIMING\\.scene${sceneNum}EffectiveHeight`);
  const hasEW = ewPattern.test(code);
  const hasEH = ehPattern.test(code);

  if (!hasEW) {
    issues.push(`Missing TIMING.scene${sceneNum}EffectiveWidth — scene must read its effective width from constants`);
  }
  if (!hasEH) {
    issues.push(`Missing TIMING.scene${sceneNum}EffectiveHeight — scene must read its effective height from constants`);
  }

  // Check 2: Has clipping container
  const hasOverflowHidden = /overflow:\s*['"]hidden['"]/i.test(code) || /overflow:\s*'hidden'/i.test(code);
  if (!hasOverflowHidden) {
    issues.push("Missing overflow: 'hidden' clipping container — content may leak outside effective area");
  }

  // Check 3: Uses useVideoConfig width/height for positioning (BAD)
  const videoConfigDestructure = /const\s*\{[^}]*(?:width|height)[^}]*\}\s*=\s*useVideoConfig/g;
  const matches = code.match(videoConfigDestructure);
  if (matches) {
    // Check if width/height are used for positioning (not just fps)
    const usesWidthHeight = /\b(?:width|height)\b\s*[\*/\-+]/g.test(code) ||
                            /style\s*=\s*\{[^}]*(?:width|height)\b/g.test(code);
    if (usesWidthHeight) {
      warnings.push(
        "Destructures width/height from useVideoConfig() — use TIMING.sceneNEffectiveWidth/Height instead for positioning. " +
        "useVideoConfig gives full canvas dimensions which may not match this scene's effective area."
      );
    }
  }

  // Check 4: Overlay mode — should NOT have Background component
  if (displayMode === "overlay") {
    const hasBackground = /import\s+.*Background.*from/i.test(code) || /<Background/i.test(code);
    if (hasBackground) {
      issues.push(
        "Overlay scene renders a Background component — overlay scenes must be transparent so the speaker video shows through. " +
        "Remove the Background import and component."
      );
    }

    // Check for solid background colors
    const hasBgColor = /background:\s*['"][^'"]*['"](?!\s*,\s*['"]transparent)/i.test(code);
    const hasFullBg = /backgroundColor:\s*['"][^'"]*['"]/.test(code);
    if (hasBgColor || hasFullBg) {
      warnings.push(
        "Overlay scene may have an opaque background color — ensure backgrounds are transparent or semi-transparent " +
        "so the speaker video is visible."
      );
    }
  }

  // Check 5: Hardcoded pixel values for common sizing
  const hardcodedFontSize = /fontSize:\s*(\d{2,3})(?!\s*[*])/g;
  let fontMatch;
  const hardcodedFonts = [];
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
    displayMode,
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

// -- get_scene_dimensions ---------------------------------------------------
server.registerTool(
  "get_scene_dimensions",
  {
    description:
      "Read scenes.json and return the effective dimensions, displayMode, and aspect ratio for each scene (or a specific scene). " +
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
  async ({ sceneNumber }) => {
    try {
      const result = await findScenesJson();
      if (!result) {
        return {
          content: [
            {
              type: "text",
              text: "scenes.json not found. It should be at src/proj_<id>/scenes.json. " +
                "Make sure the Director phase has run and produced a scene plan.",
            },
          ],
          isError: true,
        };
      }

      const { data, path: scenesPath } = result;
      const scenes = data.scenes || [];

      if (scenes.length === 0) {
        return {
          content: [{ type: "text", text: `scenes.json at ${scenesPath} has no scenes array.` }],
          isError: true,
        };
      }

      const formatScene = (scene, idx) => {
        const ed = scene.effectiveDimensions || {};
        const ew = ed.width || "NOT SET";
        const eh = ed.height || "NOT SET";
        const dm = scene.displayMode || "pip";
        const ar = typeof ew === "number" && typeof eh === "number"
          ? `${(ew / eh).toFixed(3)}:1 (${ew > eh ? "landscape-ish" : ew === eh ? "square" : "portrait"})`
          : "unknown";

        return {
          sceneNumber: idx + 1,
          title: scene.title || scene.name || `Scene ${idx + 1}`,
          displayMode: dm,
          effectiveWidth: ew,
          effectiveHeight: eh,
          aspectRatio: ar,
          constantsKey: {
            width: `TIMING.scene${idx + 1}EffectiveWidth`,
            height: `TIMING.scene${idx + 1}EffectiveHeight`,
          },
          designTips: dm === "overlay"
            ? "NO background. Transparent. Speaker video shows through. Use semi-transparent cards/elements."
            : dm === "fullscreen"
              ? "Full canvas. Immersive background. Generous whitespace. Dramatic typography."
              : typeof eh === "number" && eh < 1200
                ? "Compact area. Dense layout. Horizontal arrangements. Larger relative font sizes."
                : "Standard pip area. Balanced layout.",
        };
      };

      if (sceneNumber !== undefined) {
        const idx = sceneNumber - 1;
        if (idx < 0 || idx >= scenes.length) {
          return {
            content: [{
              type: "text",
              text: `Scene ${sceneNumber} not found. scenes.json has ${scenes.length} scene(s).`,
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify(formatScene(scenes[idx], idx), null, 2),
          }],
        };
      }

      // Return all scenes
      const allScenes = scenes.map((s, i) => formatScene(s, i));
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            scenesJsonPath: scenesPath,
            totalScenes: scenes.length,
            scenes: allScenes,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error reading scenes.json: ${err.message}` }],
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
      "Checks for: effective dimension usage from TIMING, clipping container, overlay transparency, " +
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
  async ({ scenePath, sceneNumber }) => {
    try {
      // Read the scene file
      const fullPath = path.isAbsolute(scenePath)
        ? scenePath
        : path.join(WORKSPACE, scenePath);
      const code = await readFile(fullPath, "utf-8");

      // Find scenes.json for metadata
      const result = await findScenesJson();
      const scenes = result?.data?.scenes || [];
      const sceneIdx = sceneNumber - 1;
      const scene = scenes[sceneIdx];

      const dm = scene?.displayMode || "pip";
      const ew = scene?.effectiveDimensions?.width || 1080;
      const eh = scene?.effectiveDimensions?.height || 1920;

      const validation = validateSceneCode(code, sceneIdx, ew, eh, dm);

      const summary = validation.valid
        ? `Scene ${sceneNumber} PASSES validation.`
        : `Scene ${sceneNumber} has ${validation.issues.length} issue(s) that need fixing.`;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ...validation,
            summary,
            filePath: fullPath,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error validating scene: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[viewport-server] Running, workspace=${WORKSPACE}`);
}

main().catch((err) => {
  console.error("[viewport-server] Fatal:", err);
  process.exit(1);
});
