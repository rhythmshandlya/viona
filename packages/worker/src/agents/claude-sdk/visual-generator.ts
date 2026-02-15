/**
 * Visual Generator using Claude Agent SDK
 *
 * Uses Claude's built-in tools and subagents for:
 * 1. Visual planning - analyzes transcript and creates unified visual plan
 * 2. Scene generation - generates Remotion code for each scene
 * 3. Validation - checks content alignment and positioning consistency
 */

// @ts-expect-error — installed at runtime via Claude Code OAuth, not in package.json
import { query, ClaudeAgentOptions, AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { logger } from '../../logger.js';
import { STYLE_GUIDELINES } from '../../prompts/generate-visuals.js';

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface VisualPlan {
  coreConcept: string;
  targetAudience: string;
  visualMetaphor: string;
  visualDescription: string;
  persistentElements: string[];
  elementPositions?: Array<{ name: string; zone: string; description: string }>;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  renderMode: '2d' | '3d';
  scenes: PlannedScene[];
}

export interface PlannedScene {
  id: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  transcript: string;
  visualFocus: string;
  visualAction: string;
  transitionFromPrevious: string;
  keyElements: string[];
  startState?: string;
  endState?: string;
}

export interface ClaudeVisualOptions {
  projectId: string;
  prompt: string;
  transcript?: TranscriptWord[];
  workspace: string;
  bundleDir: string;
  durationFrames: number;
  fps: number;
  width: number;
  height: number;
  stylePreset: string;
  maxIterations?: number;
  onProgress?: (percent: number, message: string) => void;
  onLog?: (message: string) => void;
}

export interface VisualGenerationResult {
  success: boolean;
  bundlePath?: string;
  videoPath?: string;
  iterations: number;
  scenesGenerated: number;
  visualPlan?: VisualPlan;
  validationScore?: number;
  contentIssues?: number;
  alignmentIssues?: number;
  error?: string;
}

/**
 * Deep validation result for a scene
 */
interface DeepValidationResult {
  sceneId: string;
  positions: {
    leftSidebar?: { left: string; top: string };
    rightSidebar?: { left: string; top: string };
    center?: { left: string; top: string; width: string; height: string };
    header?: { top: string };
    caption?: { bottom: string };
  };
  animations: {
    interpolateCalls: Array<{ input: string; inputRange: string; outputRange: string }>;
    springCalls: Array<{ config: string }>;
    sequenceCalls: Array<{ from: string; duration: string }>;
  };
  elements: string[];
  colors: string[];
  imports: string[];
  issues: string[];
}

/**
 * Extract position values from scene code
 */
function extractPositions(code: string): DeepValidationResult['positions'] {
  const positions: DeepValidationResult['positions'] = {};

  // Extract leftSidebar position
  const leftSidebarMatch = code.match(/leftSidebar[^}]*left:\s*([^,}]+)/);
  const leftSidebarTopMatch = code.match(/leftSidebar[^}]*top:\s*([^,}]+)/);
  if (leftSidebarMatch) {
    positions.leftSidebar = {
      left: leftSidebarMatch[1].trim(),
      top: leftSidebarTopMatch?.[1]?.trim() || 'unknown',
    };
  }

  // Extract rightSidebar position
  const rightSidebarMatch = code.match(/rightSidebar[^}]*left:\s*([^,}]+)/);
  const rightSidebarTopMatch = code.match(/rightSidebar[^}]*top:\s*([^,}]+)/);
  if (rightSidebarMatch) {
    positions.rightSidebar = {
      left: rightSidebarMatch[1].trim(),
      top: rightSidebarTopMatch?.[1]?.trim() || 'unknown',
    };
  }

  // Extract center zone
  const centerLeftMatch = code.match(/center[^}]*left:\s*([^,}]+)/);
  const centerTopMatch = code.match(/center[^}]*top:\s*([^,}]+)/);
  const centerWidthMatch = code.match(/center[^}]*width:\s*([^,}]+)/);
  const centerHeightMatch = code.match(/center[^}]*height:\s*([^,}]+)/);
  if (centerLeftMatch) {
    positions.center = {
      left: centerLeftMatch[1].trim(),
      top: centerTopMatch?.[1]?.trim() || 'unknown',
      width: centerWidthMatch?.[1]?.trim() || 'unknown',
      height: centerHeightMatch?.[1]?.trim() || 'unknown',
    };
  }

  // Extract header position
  const headerTopMatch = code.match(/header[^}]*top:\s*([^,}]+)/);
  if (headerTopMatch) {
    positions.header = { top: headerTopMatch[1].trim() };
  }

  // Extract caption position
  const captionBottomMatch = code.match(/caption[^}]*bottom:\s*([^,}]+)/);
  if (captionBottomMatch) {
    positions.caption = { bottom: captionBottomMatch[1].trim() };
  }

  return positions;
}

/**
 * Extract animation details from scene code
 */
function extractAnimations(code: string): DeepValidationResult['animations'] {
  const animations: DeepValidationResult['animations'] = {
    interpolateCalls: [],
    springCalls: [],
    sequenceCalls: [],
  };

  // Extract interpolate calls
  const interpolatePattern = /interpolate\s*\(\s*([^,]+),\s*\[([^\]]+)\],\s*\[([^\]]+)\]/g;
  let match;
  while ((match = interpolatePattern.exec(code)) !== null) {
    animations.interpolateCalls.push({
      input: match[1].trim(),
      inputRange: match[2].trim(),
      outputRange: match[3].trim(),
    });
  }

  // Extract spring calls
  const springPattern = /spring\s*\(\s*\{[^}]*config:\s*([^}]+)\}/g;
  while ((match = springPattern.exec(code)) !== null) {
    animations.springCalls.push({ config: match[1].trim() });
  }

  // Extract Sequence calls
  const sequencePattern = /<Sequence[^>]*from=\{([^}]+)\}[^>]*(?:durationInFrames|duration)=\{([^}]+)\}/g;
  while ((match = sequencePattern.exec(code)) !== null) {
    animations.sequenceCalls.push({ from: match[1].trim(), duration: match[2].trim() });
  }

  return animations;
}

/**
 * Extract visual elements mentioned in code
 */
function extractElements(code: string): string[] {
  const elements: string[] = [];

  // Look for common element patterns
  const patterns = [
    /\/icons\/([a-z-]+)\.svg/g,  // Lucide icons
    /<(GlowPulse|FadeIn|BounceIn|ScaleIn|ZoomIn|Tada|Shake)[^>]*>/g,  // Animation components
    /alt=["']([^"']+)["']/g,  // Image alt texts
    /name=["']([^"']+)["']/g,  // Named elements
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      elements.push(match[1]);
    }
  }

  return [...new Set(elements)];
}

/**
 * Extract colors used in scene
 */
function extractColors(code: string): string[] {
  const colors: string[] = [];

  // Hex colors
  const hexPattern = /#[0-9a-fA-F]{3,8}/g;
  let match;
  while ((match = hexPattern.exec(code)) !== null) {
    colors.push(match[0]);
  }

  // RGB/RGBA colors
  const rgbPattern = /rgba?\([^)]+\)/g;
  while ((match = rgbPattern.exec(code)) !== null) {
    colors.push(match[0]);
  }

  return [...new Set(colors)];
}

/**
 * Deep validate a single scene
 */
function deepValidateScene(sceneId: string, code: string): DeepValidationResult {
  const issues: string[] = [];

  const positions = extractPositions(code);
  const animations = extractAnimations(code);
  const elements = extractElements(code);
  const colors = extractColors(code);

  // Extract imports
  const importMatch = code.match(/import\s*\{([^}]+)\}\s*from\s*['"]remotion['"]/);
  const imports = importMatch ? importMatch[1].split(',').map(s => s.trim()) : [];

  // Validate positions
  if (positions.leftSidebar && !positions.leftSidebar.left.includes('0.08')) {
    issues.push(`leftSidebar uses non-standard left position: ${positions.leftSidebar.left} (should be width * 0.08)`);
  }
  if (positions.rightSidebar && !positions.rightSidebar.left.includes('0.92')) {
    issues.push(`rightSidebar uses non-standard left position: ${positions.rightSidebar.left} (should be width * 0.92)`);
  }

  // Validate animations
  for (const interp of animations.interpolateCalls) {
    const inputNums = interp.inputRange.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
    for (let i = 1; i < inputNums.length; i++) {
      if (inputNums[i] < inputNums[i - 1]) {
        issues.push(`Descending interpolate inputRange: [${interp.inputRange}]`);
        break;
      }
    }

    // Check for color interpolation without interpolateColors
    if (/#[0-9a-fA-F]/.test(interp.outputRange) || /color[A-Z]/.test(interp.outputRange)) {
      issues.push(`Using interpolate() with colors in outputRange: [${interp.outputRange}] - should use interpolateColors()`);
    }
  }

  // Check for interpolateColors usage
  if (code.includes('interpolateColors(') && !imports.includes('interpolateColors')) {
    issues.push('Using interpolateColors but not imported from remotion');
  }

  return {
    sceneId,
    positions,
    animations,
    elements,
    colors,
    imports,
    issues,
  };
}

/**
 * Compare positions across all scenes for consistency
 */
function validatePositionConsistency(validations: DeepValidationResult[]): string[] {
  const issues: string[] = [];

  if (validations.length < 2) return issues;

  const referencePositions = validations[0].positions;

  for (let i = 1; i < validations.length; i++) {
    const scene = validations[i];

    // Check leftSidebar consistency
    if (referencePositions.leftSidebar && scene.positions.leftSidebar) {
      if (referencePositions.leftSidebar.left !== scene.positions.leftSidebar.left) {
        issues.push(`${scene.sceneId}: leftSidebar.left differs from scene_1 (${scene.positions.leftSidebar.left} vs ${referencePositions.leftSidebar.left})`);
      }
    }

    // Check rightSidebar consistency
    if (referencePositions.rightSidebar && scene.positions.rightSidebar) {
      if (referencePositions.rightSidebar.left !== scene.positions.rightSidebar.left) {
        issues.push(`${scene.sceneId}: rightSidebar.left differs from scene_1 (${scene.positions.rightSidebar.left} vs ${referencePositions.rightSidebar.left})`);
      }
    }

    // Check center zone consistency
    if (referencePositions.center && scene.positions.center) {
      if (referencePositions.center.left !== scene.positions.center.left) {
        issues.push(`${scene.sceneId}: center.left differs from scene_1`);
      }
      if (referencePositions.center.width !== scene.positions.center.width) {
        issues.push(`${scene.sceneId}: center.width differs from scene_1`);
      }
    }
  }

  return issues;
}

/**
 * Validate color scheme consistency
 */
function validateColorConsistency(validations: DeepValidationResult[], expectedColors: { primary: string; secondary: string; accent: string; background: string }): string[] {
  const issues: string[] = [];

  for (const scene of validations) {
    // Check if expected colors are used
    const usedColors = scene.colors.map(c => c.toLowerCase());

    if (!usedColors.includes(expectedColors.background.toLowerCase())) {
      // Background might be applied differently, just log for info
    }

    // Check for color consistency - warn if scene uses very different colors
    const uniqueColors = scene.colors.length;
    if (uniqueColors > 10) {
      issues.push(`${scene.sceneId}: Uses ${uniqueColors} different colors - may look inconsistent`);
    }
  }

  return issues;
}

/**
 * Validate animation timing and easing consistency
 */
function validateAnimationConsistency(validations: DeepValidationResult[]): string[] {
  const issues: string[] = [];

  // Collect all spring configs used
  const springConfigs = new Map<string, number>();
  for (const scene of validations) {
    for (const spring of scene.animations.springCalls) {
      const count = springConfigs.get(spring.config) || 0;
      springConfigs.set(spring.config, count + 1);
    }
  }

  // Check for too many different spring configs (inconsistent feel)
  if (springConfigs.size > 5) {
    issues.push(`Using ${springConfigs.size} different spring configurations - may feel inconsistent`);
  }

  // Check for proper Sequence usage
  for (const scene of validations) {
    for (const seq of scene.animations.sequenceCalls) {
      // Check if duration is using deprecated 'duration' instead of 'durationInFrames'
      if (seq.duration && !seq.duration.includes('Frames')) {
        // This might indicate using the wrong prop name
      }
    }
  }

  return issues;
}

/**
 * Validate that persistent elements appear consistently across scenes
 */
function validatePersistentElements(validations: DeepValidationResult[], persistentElements: string[]): string[] {
  const issues: string[] = [];

  // Create a map of element presence
  const elementPresence = new Map<string, string[]>();
  for (const element of persistentElements) {
    elementPresence.set(element.toLowerCase(), []);
  }

  // Check each scene for persistent elements
  for (const scene of validations) {
    const sceneElements = scene.elements.map(e => e.toLowerCase());

    for (const [element, scenes] of elementPresence) {
      // Check if element or related keyword appears
      const isPresent = sceneElements.some(e =>
        e.includes(element) ||
        element.includes(e) ||
        // Common mappings
        (element.includes('sidebar') && (e.includes('folder') || e.includes('server'))) ||
        (element.includes('context') && sceneElements.length > 0)
      );

      if (isPresent) {
        scenes.push(scene.sceneId);
      }
    }
  }

  // Report missing elements
  for (const [element, scenes] of elementPresence) {
    if (scenes.length === 0) {
      issues.push(`Persistent element "${element}" not found in any scene`);
    } else if (scenes.length < validations.length / 2) {
      issues.push(`Persistent element "${element}" only appears in ${scenes.length}/${validations.length} scenes`);
    }
  }

  return issues;
}

/**
 * Check for common animation anti-patterns
 */
function validateAnimationPatterns(code: string): string[] {
  const issues: string[] = [];

  // Check for hardcoded pixel values (should use relative sizing)
  const hardcodedPx = code.match(/:\s*\d{2,}px/g);
  if (hardcodedPx && hardcodedPx.length > 3) {
    issues.push(`Found ${hardcodedPx.length} hardcoded pixel values - should use relative sizing (width * 0.X)`);
  }

  // Check for missing easing on interpolate
  const interpolateWithoutEasing = code.match(/interpolate\s*\([^)]+\)\s*[;,]/g);
  // This is actually fine - easing is optional

  // Check for very long duration animations (might cause performance issues)
  const longDurations = code.match(/durationInFrames[=:]\s*\{?\s*(\d{4,})/g);
  if (longDurations) {
    issues.push(`Very long animation duration detected - may cause performance issues`);
  }

  // Check for nested Sequences (can be confusing)
  const nestedSequences = code.match(/<Sequence[^>]*>[^]*<Sequence/g);
  if (nestedSequences && nestedSequences.length > 2) {
    issues.push(`Multiple nested Sequences detected - may be overly complex`);
  }

  // Check for missing AbsoluteFill wrapper
  if (!code.includes('AbsoluteFill') && !code.includes('absoluteFill')) {
    issues.push(`Missing AbsoluteFill wrapper - scene may not fill canvas`);
  }

  // Check for useCurrentFrame usage
  if (!code.includes('useCurrentFrame')) {
    issues.push(`Not using useCurrentFrame - animations may not work correctly`);
  }

  return issues;
}

/**
 * Validate generated scene code for common errors
 */
function validateSceneCode(code: string): string[] {
  const errors: string[] = [];

  // Check for .map() without key prop
  const mapCalls = code.match(/\.map\s*\([^)]*\)\s*=>\s*[(<]/g) || [];
  const keyProps = code.match(/key\s*=\s*\{/g) || [];
  if (mapCalls.length > keyProps.length) {
    errors.push('Missing key prop in .map() call');
  }

  // Check for descending interpolate ranges (input range must be ascending)
  const interpolateCalls = code.matchAll(/interpolate\s*\(\s*[^,]+,\s*\[([^\]]+)\]/g);
  for (const match of interpolateCalls) {
    const rangeStr = match[1];
    const numbers = rangeStr.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] < numbers[i - 1]) {
        errors.push(`Descending interpolate input range: [${rangeStr}]`);
        break;
      }
    }
  }

  // Check for interpolate used with color values (should use interpolateColors)
  // Matches: interpolate(..., [...], ['#...', '...']) or [..., colorVar, ...]
  const colorInterpolatePattern = /interpolate\s*\([^)]+,\s*\[[^\]]+\],\s*\[([^\]]+)\]/g;
  let colorMatch;
  while ((colorMatch = colorInterpolatePattern.exec(code)) !== null) {
    const outputRange = colorMatch[1];
    // Check if output contains hex colors or color variable names
    if (/#[0-9a-fA-F]{3,8}/.test(outputRange) ||
        /color[A-Z]\w*/.test(outputRange) ||
        /'#|"#/.test(outputRange)) {
      errors.push(`Using interpolate() with colors - should use interpolateColors()`);
    }
  }

  // Check for missing interpolateColors import when colors are interpolated
  if (code.includes('interpolateColors') && !code.includes('interpolateColors') ) {
    errors.push('Missing interpolateColors import');
  }

  // Check for missing imports
  if (!code.includes("from 'remotion'") && !code.includes('from "remotion"')) {
    errors.push('Missing remotion import');
  }

  // Check for garbage text before imports (AI sometimes outputs random words)
  const firstImportIndex = code.indexOf('import ');
  if (firstImportIndex > 0) {
    const beforeImport = code.substring(0, firstImportIndex).trim();
    if (beforeImport && !beforeImport.startsWith('//') && !beforeImport.startsWith('/*')) {
      errors.push(`Garbage text before import: "${beforeImport.substring(0, 30)}..."`);
    }
  }

  // Check for bare SVG elements without wrapper
  const svgElements = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon'];
  for (const el of svgElements) {
    const hasElement = new RegExp(`<${el}\\s`).test(code);
    const hasSvgWrapper = /<svg[\s>]/.test(code);
    if (hasElement && !hasSvgWrapper) {
      errors.push(`SVG element <${el}> without <svg> wrapper`);
      break;
    }
  }

  return errors;
}

/**
 * Auto-fix common issues in generated scene code
 */
function autoFixSceneCode(code: string): string {
  let fixed = code;

  // Fix 1: Descending interpolate ranges by reversing them
  fixed = fixed.replace(
    /interpolate\s*\(\s*([^,]+),\s*\[([^\]]+)\],\s*\[([^\]]+)\]/g,
    (match, input, inputRange, outputRange) => {
      const inputParts = inputRange.split(',').map((n: string) => n.trim());
      const outputParts = outputRange.split(',').map((n: string) => n.trim());
      const inputNums = inputParts.map((n: string) => parseFloat(n)).filter((n: number) => !isNaN(n));

      // Check if input range is descending
      let isDescending = false;
      for (let i = 1; i < inputNums.length; i++) {
        if (inputNums[i] < inputNums[i - 1]) {
          isDescending = true;
          break;
        }
      }

      if (isDescending && inputNums.length === inputParts.length) {
        // Reverse both arrays
        const fixedInputRange = [...inputParts].reverse().join(', ');
        const fixedOutputRange = [...outputParts].reverse().join(', ');
        return `interpolate(${input}, [${fixedInputRange}], [${fixedOutputRange}]`;
      }
      return match;
    }
  );

  // Fix 2: Replace interpolate() with interpolateColors() when output contains colors
  fixed = fixed.replace(
    /interpolate\s*\(\s*([^,]+),\s*\[([^\]]+)\],\s*\[([^\]]+)\]/g,
    (match, input, inputRange, outputRange) => {
      // Check if output range contains hex colors or color variables
      const hasColors = /#[0-9a-fA-F]{3,8}/.test(outputRange) ||
                       /color[A-Z]\w*/.test(outputRange) ||
                       /'#|"#/.test(outputRange);

      if (hasColors) {
        return `interpolateColors(${input}, [${inputRange}], [${outputRange}]`;
      }
      return match;
    }
  );

  // Fix 3: Add interpolateColors to imports if used but not imported
  if (fixed.includes('interpolateColors(') && !fixed.includes('interpolateColors,') && !fixed.includes('interpolateColors }')) {
    fixed = fixed.replace(
      /(import\s*\{[^}]*)(interpolate)([^}]*\}\s*from\s*['"]remotion['"])/,
      '$1$2, interpolateColors$3'
    );
  }

  // Fix 4: Add key props to .map() calls that are missing them
  // First, ensure index parameter exists
  fixed = fixed.replace(
    /\.map\s*\(\s*\(([^,)]+)\)\s*=>\s*\{/g,
    (match, item) => `.map((${item}, __mapIdx__) => {`
  );
  fixed = fixed.replace(
    /\.map\s*\(\s*\(([^,)]+)\)\s*=>\s*\(/g,
    (match, item) => `.map((${item}, __mapIdx__) => (`
  );

  // Fix 5: Add key prop to JSX elements inside map that don't have one
  // Pattern: .map((item, idx) => (<Tag without key
  fixed = fixed.replace(
    /\.map\s*\(\s*\(([^,]+),\s*(\w+)\)\s*=>\s*\(\s*<(\w+)((?:\s+(?!key=)[a-zA-Z][a-zA-Z0-9-]*(?:=\{[^}]*\}|="[^"]*"|='[^']*')?)*)\s*>/g,
    (match, item, index, tag, attrs) => {
      // Check if key already exists in attrs
      if (/key\s*=/.test(attrs)) return match;
      return `.map((${item}, ${index}) => (<${tag} key={${index}}${attrs}>`;
    }
  );

  // Fix 6: Handle return statement pattern
  fixed = fixed.replace(
    /\.map\s*\(\s*\(([^,]+),\s*(\w+)\)\s*=>\s*\{\s*return\s*\(\s*<(\w+)((?:\s+(?!key=)[a-zA-Z][a-zA-Z0-9-]*(?:=\{[^}]*\}|="[^"]*"|='[^']*')?)*)\s*>/g,
    (match, item, index, tag, attrs) => {
      if (/key\s*=/.test(attrs)) return match;
      return `.map((${item}, ${index}) => { return (<${tag} key={${index}}${attrs}>`;
    }
  );

  // Fix 7: Clean up __mapIdx__ placeholder
  fixed = fixed.replace(/__mapIdx__/g, 'i');

  // Fix 8: Remove garbage text before import statements
  // AI sometimes outputs random text/words before the actual code
  fixed = fixed.replace(/^[a-zA-Z]+\s*\n(import\s)/m, '$1');

  // Fix 9: Remove any lines that are just single words (likely garbage)
  fixed = fixed.replace(/^[a-z]+\n/gim, '');

  return fixed;
}

/**
 * Define specialized subagents for the visual generation pipeline
 */
function getAgentDefinitions(
  stylePreset: string,
  width: number,
  height: number,
  fps: number
): Record<string, AgentDefinition> {
  const styleGuideline = STYLE_GUIDELINES[stylePreset] || STYLE_GUIDELINES['modern'] || '';

  return {
    'visual-planner': {
      description: 'Analyzes transcript and creates a unified visual plan with consistent metaphor and element positions.',
      prompt: `You are a creative director for animated explainer videos.

## YOUR TASK
Analyze the transcript and create a unified visual plan that:
1. Shows the ACTUAL MECHANISM being explained
2. Looks like a 3Blue1Brown or Stanford lecture diagram
3. Flows as ONE CONTINUOUS ANIMATION (no cuts)

## FORBIDDEN
- NEVER use nature metaphors (rivers, fish, trees) for technical topics
- NEVER use literal interpretations of names
- NEVER use cartoon-like visuals

## REQUIRED
For technical topics, show the ACTUAL MECHANISM:
- Algorithms: Show data structures with values, step-by-step operations
- Data structures: Show boxes/nodes with connections
- Systems: Show components as labeled boxes, data flow with arrows

## ELEMENT POSITION ZONES
Assign each persistent element to a zone:
- center: Main visual area (width * 0.2 to 0.8, height * 0.3 to 0.65)
- left-sidebar: Left side elements (left: width * 0.08)
- right-sidebar: Right side elements (right: width * 0.08)
- header: Title area (top: height * 0.08)
- caption: Bottom text (bottom: height * 0.1)

Output a JSON visual plan with: coreConcept, visualMetaphor, persistentElements, elementPositions, colorScheme, scenes.`,
      tools: ['Read', 'Glob']
    },

    'scene-generator': {
      description: 'Generates Remotion React components for individual scenes based on the visual plan.',
      prompt: `You are an ELITE motion graphics designer creating Remotion scene components.

## STYLE GUIDELINES
${styleGuideline}

## MANDATORY IMPORTS
\`\`\`tsx
// ALWAYS include interpolateColors if you interpolate color values!
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, interpolateColors, spring, Sequence } from 'remotion';
import {
  FadeIn, SlideUp, ScaleIn, BounceIn, FadeInUp, ZoomIn, GlowPulse, PremiumStagger,
} from '../../animations';
\`\`\`

## MANDATORY POSITION ZONES
\`\`\`tsx
const ZONES = {
  center: { left: width * 0.2, top: height * 0.3, width: width * 0.6, height: height * 0.35 },
  leftSidebar: { position: 'absolute', left: width * 0.08, top: height * 0.5, transform: 'translateY(-50%)' },
  rightSidebar: { position: 'absolute', left: width * 0.92, top: height * 0.5, transform: 'translate(-100%, -50%)' },
  header: { position: 'absolute', top: height * 0.08, left: 0, width: '100%', textAlign: 'center' },
  caption: { position: 'absolute', bottom: height * 0.1, left: 0, width: '100%', textAlign: 'center' },
};
\`\`\`

## ⛔ CRITICAL RULES - VIOLATIONS CRASH THE APP ⛔

### 1. KEY PROPS - MANDATORY for ALL .map() calls
\`\`\`tsx
// ✅ CORRECT - always include key and index parameter
{items.map((item, index) => (
  <div key={index}>{item}</div>
))}

// ❌ CRASH - missing key prop
{items.map((item) => <div>{item}</div>)}
\`\`\`

### 2. INTERPOLATE inputRange MUST be ASCENDING (low → high)
\`\`\`tsx
// ✅ CORRECT - input range goes from low to high
const opacity = interpolate(frame, [0, 100], [0, 1]);
const scale = interpolate(progress, [0, 0.5, 1], [0.8, 1.2, 1]);
const fadeOut = interpolate(frame, [0, 30], [1, 0]); // input [0,30] ascending, output [1,0] can descend

// ❌ CRASH - input range [1, 0.2] is DESCENDING
const bad = interpolate(progress, [1, 0.2], [0, 4]); // "inputRange must be strictly monotonically increasing"
const alsoBad = interpolate(frame, [100, 0], [1, 0]); // CRASH!

// ✅ FIX descending input: reverse BOTH ranges
const fixed = interpolate(progress, [0.2, 1], [4, 0]); // Same behavior, no crash
\`\`\`

### 3. COLOR INTERPOLATION - use interpolateColors() NOT interpolate()
\`\`\`tsx
// ✅ CORRECT - interpolateColors for color values
const bgColor = interpolateColors(progress, [0, 1], ['#ff0000', '#00ff00']);
const borderColor = interpolateColors(frame, [0, 30], [colorRed, colorBlue]);

// ❌ CRASH - "outputRange must contain only numbers"
const bgColor = interpolate(progress, [0, 1], ['#ff0000', '#00ff00']); // CRASH!
const bad = interpolate(progress, [0, 1], [colorRed, colorBlue]); // CRASH!
\`\`\`

### 4. RELATIVE SIZING - use width * 0.05, never hardcoded pixels

### 5. ALL SVG elements (<path>, <rect>, <circle>) MUST be inside <svg> wrapper

### 6. Use animation primitives from ../../animations (FadeIn, BounceIn, etc.)

### 7. Persistent elements use EXACT same positions in every scene

### 8. Output ONLY TypeScript/React code, no markdown fences

Canvas: ${width}x${height}px @ ${fps}fps`,
      tools: ['Read', 'Write', 'Edit']
    },

    'validation-agent': {
      description: 'Validates generated scenes for content alignment and positioning consistency.',
      prompt: `You are a QA agent validating animated educational videos.

## YOUR TASK
1. Read all generated scene files
2. Check if visual elements match the narration content
3. Check if element positions are consistent across scenes
4. Report issues and suggest fixes

## POSITION CONSISTENCY CHECK
- Left sidebar elements should ALL use "left: width * 0.08"
- Right sidebar elements should ALL use consistent positioning
- Center elements should use same coordinates

## OUTPUT
Provide a validation report with:
- contentIssues: Array of {sceneId, issue, suggestion}
- alignmentIssues: Array of {sceneId, issue, suggestion}
- overallScore: 0-100 quality score
- fixes: Specific code fixes if needed`,
      tools: ['Read', 'Glob', 'Grep']
    }
  };
}

/**
 * Format transcript with timestamps for analysis
 */
function formatFullTranscript(words: TranscriptWord[]): string {
  const sentences: Array<{ startMs: number; endMs: number; text: string }> = [];
  let currentSentence: TranscriptWord[] = [];
  let sentenceStartMs = 0;

  for (const word of words) {
    if (currentSentence.length === 0) {
      sentenceStartMs = word.startMs;
    }
    currentSentence.push(word);

    if (/[.!?]$/.test(word.text.trim())) {
      sentences.push({
        startMs: sentenceStartMs,
        endMs: word.endMs,
        text: currentSentence.map(w => w.text).join(' '),
      });
      currentSentence = [];
    }
  }

  if (currentSentence.length > 0) {
    sentences.push({
      startMs: sentenceStartMs,
      endMs: currentSentence[currentSentence.length - 1].endMs,
      text: currentSentence.map(w => w.text).join(' '),
    });
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return sentences
    .map(s => `[${formatTime(s.startMs)} - ${formatTime(s.endMs)}] ${s.text}`)
    .join('\n');
}

/**
 * Parse transcript from prompt if not provided directly
 */
function parseTranscriptFromPrompt(prompt: string): TranscriptWord[] {
  const lines = prompt.split('\n');
  const words: TranscriptWord[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(.+)/);
    if (match) {
      const startMs = (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000;
      const endMs = (parseInt(match[3]) * 60 + parseInt(match[4])) * 1000;
      const textWords = match[5].split(/\s+/).filter(w => w.trim());
      const wordDuration = (endMs - startMs) / textWords.length;

      textWords.forEach((word, i) => {
        words.push({
          text: word,
          startMs: startMs + i * wordDuration,
          endMs: startMs + (i + 1) * wordDuration,
        });
      });
    }
  }

  return words;
}

/**
 * Bundle the Remotion project
 */
async function bundleProject(
  workspace: string,
  bundleDir: string,
  compositionId: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const outputDir = join(bundleDir, compositionId);

    const proc = spawn('npx', [
      'remotion', 'bundle',
      './src/index.ts',
      '--out-dir', outputDir,
      '--log', 'error',
    ], {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr });
      }
    });
  });
}

/**
 * Render the final video
 */
async function renderVideo(
  workspace: string,
  outputPath: string,
  durationFrames: number,
  compositionId: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', [
      'remotion', 'render',
      './src/index.ts', compositionId, outputPath,
      '--frames', `0-${durationFrames - 1}`,
      '--log', 'error',
    ], {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: stderr });
    });
  });
}

/**
 * Generate Root.tsx file
 */
function generateRootTsx(
  compositionId: string,
  renderCompositionId: string,
  durationFrames: number,
  fps: number,
  width: number,
  height: number
): string {
  return `import { Composition } from 'remotion';
import Main from './${compositionId}/Main';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${renderCompositionId}"
        component={Main}
        durationInFrames={${durationFrames}}
        fps={${fps}}
        width={${width}}
        height={${height}}
      />
    </>
  );
};
`;
}

/**
 * Main function: Generate visuals using Claude Agent SDK
 */
export async function generateVisualsWithClaudeSDK(
  options: ClaudeVisualOptions
): Promise<VisualGenerationResult> {
  const {
    projectId, prompt, transcript, workspace, bundleDir,
    durationFrames, fps, width, height, stylePreset,
    maxIterations = 3, onProgress, onLog,
  } = options;

  const log = (msg: string) => {
    logger.info({ projectId }, msg);
    onLog?.(msg);
  };

  const progress = (pct: number, msg: string) => {
    log(`[${pct}%] ${msg}`);
    onProgress?.(pct, msg);
  };

  const absoluteWorkspace = resolve(workspace);
  const absoluteBundleDir = resolve(bundleDir);
  const compositionId = projectId;
  const bundleCompositionId = projectId.replace(/_/g, '-');

  try {
    progress(5, 'Initializing Claude Agent SDK...');

    // Get transcript words
    const transcriptWords = transcript || parseTranscriptFromPrompt(prompt);

    if (transcriptWords.length === 0) {
      throw new Error('No transcript provided');
    }

    const fullTranscript = formatFullTranscript(transcriptWords);
    const totalDurationMs = transcriptWords[transcriptWords.length - 1].endMs;

    // Create directory structure
    const compositionDir = join(absoluteWorkspace, 'src', compositionId);
    const scenesDir = join(compositionDir, 'scenes');
    await mkdir(scenesDir, { recursive: true });

    // Get agent definitions
    const agents = getAgentDefinitions(stylePreset, width, height, fps);

    // STEP 1: Use visual-planner agent to analyze transcript
    progress(10, 'Claude analyzing transcript and planning visuals...');

    let visualPlan: VisualPlan | undefined;
    let sessionId: string | undefined;

    const plannerPrompt = `Analyze this transcript and create a unified visual plan.

## Transcript
${fullTranscript}

## Technical Details
- Duration: ${totalDurationMs}ms (${Math.round(totalDurationMs / 1000)} seconds)
- FPS: ${fps}
- Canvas: ${width}x${height}px
- Style: ${stylePreset}

Create a visual plan that:
1. Identifies the core concept being taught
2. Chooses ONE visual metaphor that evolves throughout
3. Assigns persistent elements to position zones
4. Breaks into 2-10 second scenes

Output the plan as JSON with: coreConcept, targetAudience, visualMetaphor, visualDescription, persistentElements, elementPositions, colorScheme, renderMode, scenes.

Each scene needs: id, startMs, endMs, transcript, visualFocus, visualAction, transitionFromPrevious, keyElements, startState, endState.`;

    for await (const message of query({
      prompt: plannerPrompt,
      options: {
        allowedTools: ['Read', 'Glob'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        cwd: absoluteWorkspace,
        settingSources: ['user'], // Use Claude Code CLI login credentials
      } as ClaudeAgentOptions,
    })) {
      if ('subtype' in message && message.subtype === 'init') {
        sessionId = (message as any).session_id;
      }
      if ('result' in message) {
        // Parse the visual plan from Claude's response
        const resultText = String((message as any).result);
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            visualPlan = JSON.parse(jsonMatch[0]) as VisualPlan;
          } catch (e) {
            log(`Failed to parse visual plan JSON: ${e}`);
          }
        }
      }
    }

    if (!visualPlan || !visualPlan.scenes || visualPlan.scenes.length === 0) {
      throw new Error('Failed to generate visual plan');
    }

    // Add frame calculations to scenes
    visualPlan.scenes = visualPlan.scenes.map((scene, index) => ({
      ...scene,
      id: scene.id || `scene_${index + 1}`,
      startFrame: Math.floor((scene.startMs / 1000) * fps),
      endFrame: Math.ceil((scene.endMs / 1000) * fps),
      durationFrames: Math.ceil(((scene.endMs - scene.startMs) / 1000) * fps),
    }));

    log(`Visual plan: "${visualPlan.visualMetaphor}" with ${visualPlan.scenes.length} scenes`);

    // STEP 2: Generate scene components using scene-generator agent
    progress(25, `Generating ${visualPlan.scenes.length} scenes with Claude...`);

    let scenesGenerated = 0;
    const generatedSceneCodes = new Map<string, string>();

    for (let i = 0; i < visualPlan.scenes.length; i++) {
      const scene = visualPlan.scenes[i];
      const sceneProgress = 25 + Math.floor((i / visualPlan.scenes.length) * 40);
      progress(sceneProgress, `Generating scene ${i + 1}/${visualPlan.scenes.length}...`);

      const prevScene = i > 0 ? visualPlan.scenes[i - 1] : null;

      const scenePrompt = `Generate a Remotion scene component for this moment in the animation.

## Visual Plan Context
- Core concept: ${visualPlan.coreConcept}
- Visual metaphor: ${visualPlan.visualMetaphor}
- Persistent elements: ${visualPlan.persistentElements.join(', ')}
- Colors: Background ${visualPlan.colorScheme.background}, Primary ${visualPlan.colorScheme.primary}

## Element Positions (USE EXACTLY)
${visualPlan.elementPositions?.map(ep => `- ${ep.name}: zone="${ep.zone}"`).join('\n') || 'Use standard ZONES'}

## This Scene (${i + 1} of ${visualPlan.scenes.length})
- Duration: ${scene.durationFrames} frames
- Transcript: "${scene.transcript}"
- Visual focus: ${scene.visualFocus}
- Visual action: ${scene.visualAction}
- Key elements: ${scene.keyElements?.join(', ') || 'none'}
${prevScene ? `- Previous scene ended with: ${prevScene.endState || prevScene.visualAction}` : '- This is the opening scene'}
${scene.startState ? `- Start state: ${scene.startState}` : ''}
${scene.endState ? `- End state: ${scene.endState}` : ''}

## Technical
- Canvas: ${width}x${height}px @ ${fps}fps
- Frames: 0 to ${scene.durationFrames - 1}

## ⛔ CRITICAL RULES - VIOLATIONS CRASH THE APP ⛔

1. **KEY PROPS** - Every .map() MUST have index parameter AND key prop:
   \`{items.map((item, i) => <div key={i}>...</div>)}\`

2. **INTERPOLATE inputRange** - MUST be ASCENDING (low → high numbers):
   ✅ interpolate(frame, [0, 100], [0, 1]) // input 0→100 ascending
   ✅ interpolate(progress, [0.2, 1], [4, 0]) // input 0.2→1 ascending, output can descend
   ❌ interpolate(progress, [1, 0.2], [0, 4]) // CRASH! input 1→0.2 descending

3. **COLOR INTERPOLATION** - Use interpolateColors() for ANY color values:
   ✅ interpolateColors(progress, [0, 1], ['#ff0000', colorBlue])
   ❌ interpolate(progress, [0, 1], ['#ff0000', colorBlue]) // CRASH! "outputRange must contain only numbers"

4. **IMPORTS** - Include interpolateColors if using color transitions:
   \`import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, interpolateColors, spring, Sequence } from 'remotion';\`

Output ONLY TypeScript/React code. No markdown fences. Start with imports, end with export default.`;

      let sceneCode = '';

      for await (const message of query({
        prompt: scenePrompt,
        options: {
          allowedTools: ['Read'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          cwd: absoluteWorkspace,
          settingSources: ['user'], // Use Claude Code CLI login credentials
        } as ClaudeAgentOptions,
      })) {
        if ('result' in message) {
          sceneCode = String((message as any).result)
            .replace(/^```(?:tsx?|typescript|javascript)?\s*/gim, '')
            .replace(/```\s*$/gim, '')
            .trim();
        }
      }

      if (sceneCode) {
        // Validate code for common errors before writing
        const validationErrors = validateSceneCode(sceneCode);
        if (validationErrors.length > 0) {
          log(`Scene ${scene.id} has validation errors: ${validationErrors.join(', ')}`);
          // Auto-fix common issues
          sceneCode = autoFixSceneCode(sceneCode);
        }

        const scenePath = join(scenesDir, `${scene.id}.tsx`);
        await writeFile(scenePath, sceneCode);
        generatedSceneCodes.set(scene.id, sceneCode);
        scenesGenerated++;
        log(`Scene ${scene.id} written (${sceneCode.length} chars)`);
      }
    }

    // STEP 3: Deep validation of all generated scenes
    progress(68, 'Deep validating scenes for alignment, animations, and consistency...');

    let validationScore = 100;
    let contentIssues = 0;
    let alignmentIssues = 0;

    // Run deep validation on all generated scenes
    const deepValidations: DeepValidationResult[] = [];
    const allIssues: string[] = [];

    for (const [sceneId, code] of generatedSceneCodes) {
      const validation = deepValidateScene(sceneId, code);
      deepValidations.push(validation);

      if (validation.issues.length > 0) {
        log(`${sceneId} issues: ${validation.issues.join('; ')}`);
        allIssues.push(...validation.issues.map(issue => `${sceneId}: ${issue}`));
      }
    }

    // Check position consistency across all scenes
    const positionIssues = validatePositionConsistency(deepValidations);
    if (positionIssues.length > 0) {
      log(`Position consistency issues: ${positionIssues.join('; ')}`);
      allIssues.push(...positionIssues);
      alignmentIssues = positionIssues.length;
    }

    // Check color consistency
    const colorIssues = validateColorConsistency(deepValidations, visualPlan.colorScheme);
    if (colorIssues.length > 0) {
      log(`Color consistency issues: ${colorIssues.join('; ')}`);
      allIssues.push(...colorIssues);
    }

    // Check animation consistency
    const animationIssues = validateAnimationConsistency(deepValidations);
    if (animationIssues.length > 0) {
      log(`Animation consistency issues: ${animationIssues.join('; ')}`);
      allIssues.push(...animationIssues);
    }

    // Check persistent elements
    const persistentIssues = validatePersistentElements(deepValidations, visualPlan.persistentElements);
    if (persistentIssues.length > 0) {
      log(`Persistent element issues: ${persistentIssues.join('; ')}`);
      allIssues.push(...persistentIssues);
    }

    // Check animation patterns in each scene
    for (const [sceneId, code] of generatedSceneCodes) {
      const patternIssues = validateAnimationPatterns(code);
      if (patternIssues.length > 0) {
        log(`${sceneId} pattern issues: ${patternIssues.join('; ')}`);
        allIssues.push(...patternIssues.map(i => `${sceneId}: ${i}`));
      }
    }

    // Calculate validation score
    const issueCount = allIssues.length;
    validationScore = Math.max(0, 100 - (issueCount * 5));
    contentIssues = allIssues.filter(i => i.includes('content') || i.includes('color')).length;

    log(`Deep validation: ${allIssues.length} issues found, score: ${validationScore}/100`);

    // Auto-fix detected issues
    if (allIssues.length > 0) {
      log(`Applying auto-fixes for ${allIssues.length} issues...`);

      for (const [sceneId, code] of generatedSceneCodes) {
        let fixedCode = code;
        let wasFixed = false;

        // Fix 1: Normalize sidebar positions
        const leftSidebarFix = fixedCode.replace(
          /(leftSidebar[^}]*left:\s*)width\s*\*\s*(0\.0[3-7]|0\.09|0\.1[0-4])/g,
          '$1width * 0.08'
        );
        if (leftSidebarFix !== fixedCode) {
          fixedCode = leftSidebarFix;
          wasFixed = true;
          log(`${sceneId}: Fixed leftSidebar position`);
        }

        const rightSidebarFix = fixedCode.replace(
          /(rightSidebar[^}]*left:\s*)width\s*\*\s*(0\.8[0-9]|0\.9[013-9])/g,
          '$1width * 0.92'
        );
        if (rightSidebarFix !== fixedCode) {
          fixedCode = rightSidebarFix;
          wasFixed = true;
          log(`${sceneId}: Fixed rightSidebar position`);
        }

        // Fix 2: Apply general auto-fixes (interpolate, colors, keys)
        const generalFix = autoFixSceneCode(fixedCode);
        if (generalFix !== fixedCode) {
          fixedCode = generalFix;
          wasFixed = true;
          log(`${sceneId}: Applied general auto-fixes`);
        }

        // Fix 3: Ensure interpolateColors is imported if used
        if (fixedCode.includes('interpolateColors(') && !fixedCode.includes('interpolateColors,') && !fixedCode.includes('interpolateColors }')) {
          fixedCode = fixedCode.replace(
            /(import\s*\{[^}]*)(interpolate)([^}]*\}\s*from\s*['"]remotion['"])/,
            '$1$2, interpolateColors$3'
          );
          wasFixed = true;
          log(`${sceneId}: Added interpolateColors import`);
        }

        // Write fixed code if any changes were made
        if (wasFixed) {
          const scenePath = join(scenesDir, `${sceneId}.tsx`);
          await writeFile(scenePath, fixedCode);
          generatedSceneCodes.set(sceneId, fixedCode);

          // Re-validate after fix
          const revalidation = deepValidateScene(sceneId, fixedCode);
          if (revalidation.issues.length > 0) {
            log(`${sceneId} still has issues after fix: ${revalidation.issues.join('; ')}`);
          } else {
            log(`${sceneId}: All issues resolved`);
          }
        }
      }

      // Recalculate score after fixes
      let remainingIssues = 0;
      for (const [sceneId, code] of generatedSceneCodes) {
        const validation = deepValidateScene(sceneId, code);
        remainingIssues += validation.issues.length;
      }
      validationScore = Math.max(0, 100 - (remainingIssues * 5));
      log(`Post-fix validation score: ${validationScore}/100 (${remainingIssues} remaining issues)`);
    }

    log(`Validation score: ${validationScore}/100`);

    // STEP 4: Generate Main.tsx compositor
    progress(72, 'Generating Main.tsx...');

    const componentName = (id: string) => id.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const imports = visualPlan.scenes.map(s => `import ${componentName(s.id)} from './scenes/${s.id}';`).join('\n');
    const sequences = visualPlan.scenes.map(s =>
      `      <Sequence from={${s.startFrame}} durationInFrames={${s.durationFrames}} name="${s.id}">
        <${componentName(s.id)} />
      </Sequence>`
    ).join('\n');

    const mainCode = `import { AbsoluteFill, Sequence } from 'remotion';
${imports}

// Visual Concept: ${visualPlan.visualMetaphor}
export default function Main() {
  return (
    <AbsoluteFill style={{ background: '${visualPlan.colorScheme.background}' }}>
${sequences}
    </AbsoluteFill>
  );
}
`;

    await writeFile(join(compositionDir, 'Main.tsx'), mainCode);

    // Update Root.tsx
    const rootContent = generateRootTsx(compositionId, bundleCompositionId, durationFrames, fps, width, height);
    await writeFile(join(absoluteWorkspace, 'src', 'Root.tsx'), rootContent);

    // Create metadata.json
    await writeFile(join(compositionDir, 'metadata.json'), JSON.stringify({
      compositionId,
      durationInFrames: durationFrames,
      fps, width, height,
      visualPlan: {
        coreConcept: visualPlan.coreConcept,
        visualMetaphor: visualPlan.visualMetaphor,
        colorScheme: visualPlan.colorScheme,
      },
      scenes: visualPlan.scenes.map(s => ({
        id: s.id, startMs: s.startMs, endMs: s.endMs,
        startFrame: s.startFrame, endFrame: s.endFrame,
        visualFocus: s.visualFocus, visualAction: s.visualAction,
      })),
    }, null, 2));

    // STEP 5: Bundle
    progress(80, 'Bundling project...');

    const bundleResult = await bundleProject(absoluteWorkspace, absoluteBundleDir, bundleCompositionId);

    if (!bundleResult.success) {
      throw new Error(`Bundle failed: ${bundleResult.error}`);
    }

    // STEP 6: Render video
    progress(90, 'Rendering video...');

    const videoPath = join(absoluteBundleDir, bundleCompositionId, 'video.mp4');
    const renderResult = await renderVideo(absoluteWorkspace, videoPath, durationFrames, bundleCompositionId);

    if (!renderResult.success) {
      log(`Video render failed (optional): ${renderResult.error}`);
    }

    const videoUrl = renderResult.success ? `/bundles/${bundleCompositionId}/video.mp4` : undefined;

    progress(100, 'Complete!');

    return {
      success: true,
      bundlePath: join(absoluteBundleDir, bundleCompositionId),
      videoPath: videoUrl,
      iterations: 1,
      scenesGenerated,
      visualPlan,
      validationScore,
      contentIssues,
      alignmentIssues,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ projectId, error: errorMessage }, 'Visual generation with Claude SDK failed');

    return {
      success: false,
      iterations: 0,
      scenesGenerated: 0,
      error: errorMessage,
    };
  }
}
