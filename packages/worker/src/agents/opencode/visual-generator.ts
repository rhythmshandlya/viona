/**
 * Visual Generator with Planning-First Approach
 *
 * Flow:
 * 1. Analyze FULL transcript to understand the overall concept
 * 2. Create a unified visual plan with consistent metaphor
 * 3. Chunk into scenes that build on the visual plan
 * 4. Generate scene components that maintain visual continuity
 */

import OpenAI from 'openai';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { STYLE_GUIDELINES } from '../../prompts/generate-visuals.js';
import { createVisualPlan, VisualPlan, PlannedScene, TranscriptWord } from './visual-planner.js';

/**
 * Create an OpenAI-compatible client using the configured LLM provider
 */
function createLLMClient(): { client: OpenAI; model: string; modelFlash: string } {
  const provider = config.llm.provider;

  if (provider === 'claude-max') {
    return {
      client: new OpenAI({
        baseURL: config.llm.claudeMax.proxyUrl,
        apiKey: config.llm.claudeMax.apiKey,
      }),
      model: config.llm.claudeMax.model,
      modelFlash: config.llm.claudeMax.modelFlash,
    };
  }

  // OpenRouter (default) - also OpenAI-compatible
  return {
    client: new OpenAI({
      baseURL: config.llm.openrouter.baseUrl,
      apiKey: config.llm.openrouter.apiKey,
    }),
    model: config.llm.openrouter.model,
    modelFlash: config.llm.openrouter.modelFlash,
  };
}

export interface OpenCodeVisualOptions {
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
  qualityThreshold?: number;
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
  error?: string;
}

/**
 * Build the scene system prompt with style-specific guidelines
 */
function buildSceneSystemPrompt(stylePreset: string): string {
  const styleGuideline = STYLE_GUIDELINES[stylePreset] || STYLE_GUIDELINES['modern'] || '';

  return `You are an ELITE motion graphics designer creating ONE SCENE that's part of a SINGLE CONTINUOUS ANIMATION.

## YOUR GOAL
Create a visual that TEACHES. After watching, the viewer should UNDERSTAND the concept without needing audio.

Ask yourself: "If I show this to someone who doesn't know the topic, will they understand HOW IT WORKS?"

## QUALITY STANDARD
Your animation should look like it belongs in a 3Blue1Brown video or Stanford lecture - clean, professional, educational.

Use:
- Clean geometric shapes with subtle shadows
- Smooth, purposeful animations (not random movement)
- Clear visual hierarchy (important elements stand out)
- Consistent spacing and alignment

NOT:
- Cartoon-like or childish graphics
- Random colors or shapes
- Cluttered layouts
- Decorative elements that don't teach anything

## STYLE GUIDELINES
${styleGuideline}

## ⛔ MANDATORY: Use Animation Primitives Library

**You MUST use the pre-built animation components from \`../../animations\`.** This ensures consistent, quality animations.

\`\`\`tsx
// REQUIRED IMPORTS
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import {
  FadeIn, SlideUp, SlideLeft, ScaleIn, PopIn, Stagger, SPRING_CONFIGS, STAGGER_DELAYS,
  BounceIn, FadeInUp, FadeInDown, ZoomIn, FlipInX, RotateIn, LightSpeedIn,
  BounceOut, FadeOutUp, ZoomOut,
  Pulse, Shake, Tada, GlowPulse, PremiumStagger,
} from '../../animations';
\`\`\`

**Available Animation Primitives:**

**Basic (secondary content):**
| Component | Use For |
|-----------|---------|
| \`FadeIn\` | Simple fade |
| \`SlideUp\` | Enter from bottom |
| \`ScaleIn\` | Scale entrance |

**Premium (hero moments, key reveals):**
| Component | Use For |
|-----------|---------|
| \`BounceIn\` | Dramatic bouncy entrance |
| \`FadeInUp\` | Elegant upward reveal |
| \`ZoomIn\` | Dramatic zoom from small |
| \`FlipInX\` | 3D flip entrance |
| \`Tada\` | Celebration emphasis |
| \`Pulse\` | Breathing attention |
| \`GlowPulse\` | Pulsing glow emphasis |
| \`PremiumStagger\` | Stagger with any animation |

**Props:** All accept \`delay\`, \`duration\`, \`style\` (${stylePreset}), \`speed\` ('fast'|'normal'|'slow')

## ⛔ RESPONSIVE SIZING (MANDATORY)

**ALL sizes must be relative to dimensions. NEVER use hardcoded pixels.**

\`\`\`tsx
const { width, height, fps } = useVideoConfig();
const minDim = Math.min(width, height);
const frame = useCurrentFrame();

// ✅ CORRECT - relative sizing
fontSize: height * 0.035,
padding: minDim * 0.05,
borderRadius: minDim * 0.02,
gap: minDim * 0.03,

// ❌ WRONG - hardcoded pixels
fontSize: 48,    // BREAKS in split layouts
padding: 60,     // Overflows 540px width
\`\`\`

## ⛔ SVG WRAPPER (MANDATORY)

ALL SVG elements (rect, circle, line, path, g, ellipse, polygon) MUST be inside an \`<svg>\` tag.
Without this, they render as invisible empty boxes.

\`\`\`tsx
// ✅ CORRECT
<svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
  <rect x={0} y={0} width={100} height={100} fill="blue" />
  <circle cx={50} cy={50} r={20} fill="red" />
</svg>

// ❌ WRONG - renders as empty box!
<rect x={0} y={0} width={100} height={100} fill="blue" />
<circle cx={50} cy={50} r={20} fill="red" />
\`\`\`

## PROFESSIONAL SVG ICONS (always inside <svg> wrapper)

### Arrow Right
\`\`\`tsx
<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2">
  <path d="M5 12h14M12 5l7 7-7 7"/>
</svg>
\`\`\`

### Database
\`\`\`tsx
<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2">
  <ellipse cx="12" cy="5" rx="9" ry="3"/>
  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
</svg>
\`\`\`

### Tree Node (div-based, no SVG needed)
\`\`\`tsx
<div style={{
  width: nodeSize, height: nodeSize, borderRadius: '50%',
  background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '3px solid white'
}}>
  {/* value inside */}
</div>
\`\`\`

## CRITICAL: SEAMLESS CONTINUITY
This is NOT a separate scene - it's a MOMENT in ONE flowing animation.
- The video must feel like ONE CAMERA SHOT where the subject evolves
- NO sudden changes, NO cuts, NO visible transitions
- Persistent elements should ALREADY BE VISIBLE at frame 0 of your scene
- Elements EVOLVE, they don't appear/disappear

## ANIMATION TECHNIQUES

### Spring with Overshoot (bouncy, satisfying)
\`\`\`tsx
const scale = spring({ frame: frame - delay, fps, config: { damping: 8, stiffness: 200 } });
\`\`\`

### Highlight/Glow Effect
\`\`\`tsx
const glowIntensity = interpolate(frame, [0, 15, 30], [0, 1, 0]);
boxShadow: \`0 0 \${glowIntensity * 30}px \${glowIntensity * 15}px rgba(59, 130, 246, 0.6)\`
\`\`\`

### Smooth Value Change (for showing data updates)
\`\`\`tsx
const displayValue = Math.round(interpolate(frame, [0, 30], [oldValue, newValue]));
\`\`\`

### Element Swap Animation
\`\`\`tsx
const swapProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
const element1X = interpolate(swapProgress, [0, 1], [pos1, pos2]);
const element1Y = interpolate(swapProgress, [0, 0.5, 1], [0, -50, 0]); // Arc motion
\`\`\`

## NO UNUSED DECLARATIONS
**Every variable you declare MUST be used.** Unused declarations cause TS6133 errors.
If you won't use a variable, DON'T DECLARE IT.

## RULES
1. USE ANIMATION PRIMITIVES from \`../../animations\` for all entrances and emphasis
2. RELATIVE SIZING - use \`width * 0.05\`, never hardcoded pixels
3. KEY PROPS - every \`.map()\` needs \`key\`
4. EASING - always use easing via spring() or interpolate()
5. EDUCATIONAL - every element should help explain the concept
6. SVG WRAPPER - ALL SVG elements MUST be inside an <svg> tag
7. SHOW THE MECHANISM - Visualize HOW the concept WORKS
8. NO UNUSED VARIABLES - only declare what you use

## OUTPUT
- ONLY TypeScript/React code
- NO markdown code fences
- Start with imports, end with export default`;
}

/**
 * Build the 3D scene system prompt for Three.js compositions
 */
function buildScene3DSystemPrompt(stylePreset: string): string {
  const styleGuideline = STYLE_GUIDELINES[stylePreset] || STYLE_GUIDELINES['modern'] || '';

  return `You are an ELITE 3D motion graphics designer creating ONE SCENE using Three.js via Remotion's ThreeCanvas.

## YOUR GOAL
Create a 3D visual that TEACHES. After watching, the viewer should UNDERSTAND the concept without needing audio.
Spatial depth should genuinely aid comprehension — this is not 3D for decoration.

## QUALITY STANDARD
Your 3D animation should look like a professional scientific visualization — clean, purposeful, educational.

## STYLE GUIDELINES
${styleGuideline}

## ⛔ MANDATORY: Required Imports

\`\`\`tsx
import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import * as THREE from 'three';
\`\`\`

## ⛔ MANDATORY: ThreeCanvas Wrapper

ALL 3D content MUST be inside a \`<ThreeCanvas>\` wrapper. 2D overlays go OUTSIDE.

\`\`\`tsx
const { width, height, fps } = useVideoConfig();
const frame = useCurrentFrame();

return (
  <AbsoluteFill>
    <ThreeCanvas width={width} height={height}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      {/* 3D meshes go here */}
    </ThreeCanvas>
    {/* 2D text overlays go here, outside ThreeCanvas */}
  </AbsoluteFill>
);
\`\`\`

## ⛔ LIGHTING (MANDATORY)
Every scene MUST have at minimum:
- \`<ambientLight intensity={0.5} />\`
- \`<directionalLight position={[10, 10, 5]} intensity={1} />\`

## 3D MESH SYNTAX (Declarative JSX)

\`\`\`tsx
<mesh position={[x, y, z]} rotation={[rx, ry, rz]} scale={scale}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="#4f46e5" />
</mesh>

<mesh>
  <sphereGeometry args={[0.5, 32, 32]} />
  <meshStandardMaterial color="#06b6d4" wireframe />
</mesh>

<mesh>
  <cylinderGeometry args={[0.3, 0.3, 2, 32]} />
  <meshStandardMaterial color="#10b981" metalness={0.3} roughness={0.7} />
</mesh>
\`\`\`

## ANIMATION via useCurrentFrame

\`\`\`tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Rotation
const rotation = interpolate(frame, [0, 90], [0, Math.PI * 2]);

// Spring animation
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 200 } });

// Position interpolation
const posY = interpolate(frame, [0, 60], [-2, 0], { extrapolateRight: 'clamp' });
\`\`\`

## CAMERA POSITIONING
Use the \`<ThreeCanvas>\` camera prop or a manual \`<perspectiveCamera>\`:
\`\`\`tsx
<ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 5], fov: 75 }}>
\`\`\`

## 2D TEXT OVERLAYS (outside ThreeCanvas)
\`\`\`tsx
<div style={{
  position: 'absolute', bottom: height * 0.05, left: 0, right: 0,
  textAlign: 'center', color: 'white', fontSize: height * 0.04,
  fontFamily: 'sans-serif', textShadow: '0 2px 8px rgba(0,0,0,0.5)',
}}>
  Label text here
</div>
\`\`\`

## ⛔ RESTRICTIONS
- NO external models (GLTF, OBJ, FBX) — procedural geometry ONLY
- NO @react-three/drei — keep dependencies minimal
- NO useFrame from @react-three/fiber — use useCurrentFrame from remotion
- ALL sizes relative to dimensions (width * 0.01, not hardcoded pixels)
- NO unused variable declarations

## ⛔ RESPONSIVE SIZING (MANDATORY)
\`\`\`tsx
const { width, height } = useVideoConfig();
const minDim = Math.min(width, height);

// For 2D overlays:
fontSize: height * 0.035,
padding: minDim * 0.05,
\`\`\`

## CRITICAL: SEAMLESS CONTINUITY
This is NOT a separate scene - it's a MOMENT in ONE flowing animation.
- NO sudden changes, NO cuts, NO visible transitions
- Persistent elements should ALREADY BE VISIBLE at frame 0

## NO UNUSED DECLARATIONS
**Every variable you declare MUST be used.** Unused declarations cause TS6133 errors.

## RULES
1. ThreeCanvas wrapper is MANDATORY for all 3D content
2. LIGHTING is MANDATORY (ambient + directional minimum)
3. RELATIVE SIZING for 2D overlays
4. KEY PROPS - every .map() needs \`key\`
5. EDUCATIONAL - every element should help explain the concept
6. PROCEDURAL GEOMETRY ONLY - no external models
7. NO UNUSED VARIABLES - only declare what you use

## OUTPUT
- ONLY TypeScript/React code
- NO markdown code fences
- Start with imports, end with export default`;
}

/**
 * Generate code for a single scene based on the visual plan
 */
async function generateSceneComponent(
  scene: PlannedScene,
  plan: VisualPlan,
  sceneIndex: number,
  totalScenes: number,
  llmClient: OpenAI,
  llmModel: string,
  options: { width: number; height: number; fps: number; stylePreset: string },
  errorFeedback?: string
): Promise<string> {
  const { width, height, fps, stylePreset } = options;

  // Get previous scene info for continuity
  const prevScene = sceneIndex > 0 ? plan.scenes[sceneIndex - 1] : null;

  const userPrompt = `Create a Remotion scene component that's part of ONE CONTINUOUS ANIMATION.

## YOUR GOAL
Create a visual that TEACHES "${plan.coreConcept}".
After watching, viewers should understand HOW IT WORKS without needing audio.

## THE VIDEO'S UNIFIED VISUAL
- Concept being taught: ${plan.coreConcept}
- Visual approach: ${plan.visualMetaphor}
- How it works: ${plan.visualDescription}
- Persistent elements: ${plan.persistentElements.join(', ')}
- Colors: Background ${plan.colorScheme.background}, Primary ${plan.colorScheme.primary}, Secondary ${plan.colorScheme.secondary}, Accent ${plan.colorScheme.accent}

## SEAMLESS CONTINUITY
You're creating a MOMENT in a single flowing animation. The viewer should NOT notice when your scene starts.
- At frame 0, the visual should look EXACTLY like the end of the previous moment
- Persistent elements should be ALREADY VISIBLE at their current state
- NO fade-ins from black, NO elements appearing from nowhere

## THIS MOMENT (${sceneIndex + 1} of ${totalScenes})
- Duration: ${scene.durationFrames} frames (${Math.round(scene.durationFrames / fps * 10) / 10}s)
- Narrator says: "${scene.transcript}"
- Viewer should focus on: ${scene.visualFocus}
- What EVOLVES visually: ${scene.visualAction}
- Key elements to animate: ${scene.keyElements.join(', ')}

${sceneIndex === 0 ? `## OPENING MOMENT
This is the first moment - introduce the visual metaphor "${plan.visualMetaphor}".
The persistent elements (${plan.persistentElements.join(', ')}) should appear and establish themselves.
Use premium animation entrances: BounceIn, FadeInUp, or ZoomIn for key elements.
${scene.startState ? `Start state: ${scene.startState}` : 'Start with these elements visible and evolving, not blank screen.'}
${scene.endState ? `End state to achieve: ${scene.endState}` : ''}` : `## CONTINUATION FROM PREVIOUS
Previous moment: "${prevScene?.visualAction}"
${prevScene?.endState ? `Previous end state (YOUR START STATE): ${prevScene.endState}` : ''}
${scene.startState ? `Your frame 0 should show: ${scene.startState}` : 'At frame 0, show the elements as they would be AFTER the previous moment completed.'}
${scene.endState ? `Your final frame should show: ${scene.endState}` : ''}

Then smoothly evolve: ${scene.transitionFromPrevious}

DO NOT:
- Fade in from black
- Reset element positions
- Have elements "pop in"
- Change color scheme or background

DO:
- Start with persistent elements EXACTLY as described in start state
- Smoothly shift attention to the new focus area
- Continue any ongoing motion
- End with elements in the end state for next scene`}

## Technical
- ${width}x${height}px @ ${fps}fps
- Frames: 0 to ${scene.durationFrames - 1}
- Use RELATIVE sizing (width * 0.05, not pixels)
- Style preset: "${stylePreset}"
- Use animation primitives from \`../../animations\` for entrances and emphasis

Communicate "${scene.visualFocus}" through visual motion and emphasis.

${errorFeedback ? `## ⛔ FIX THESE ERRORS FROM PREVIOUS ATTEMPT
${errorFeedback}

Fix ALL of these issues. Do NOT repeat the same mistakes.` : ''}

Output ONLY TypeScript/React code. No markdown.`;

  const systemPrompt = plan.renderMode === '3d'
    ? buildScene3DSystemPrompt(stylePreset)
    : buildSceneSystemPrompt(stylePreset);

  const response = await llmClient.chat.completions.create({
    model: llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: config.llm.temperature,
    max_tokens: 8192,
  });

  let code = response.choices[0]?.message?.content || '';

  // Clean up code fences
  code = code
    .replace(/^```(?:tsx?|typescript|javascript|jsx)?\s*/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();

  return code;
}

/**
 * Validate generated scene code for common issues
 */
function validateSceneCode(code: string, renderMode: '2d' | '3d' = '2d'): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check structure
  if (!code.includes('import') || !code.includes('remotion')) {
    errors.push('Missing Remotion imports. Must import from "remotion".');
  }
  if (!code.includes('export default')) {
    errors.push('Missing "export default" - component must be the default export.');
  }

  // 3D-specific checks
  if (renderMode === '3d') {
    if (!code.includes('ThreeCanvas')) {
      errors.push('Missing ThreeCanvas component. 3D scenes MUST use <ThreeCanvas> from @remotion/three.');
    }
    if (!code.includes('@remotion/three')) {
      errors.push('Missing @remotion/three import. 3D scenes MUST import ThreeCanvas from @remotion/three.');
    }
  }

  // 2D-specific root element check
  if (renderMode === '2d' && !code.includes('AbsoluteFill') && !code.includes('<div')) {
    errors.push('Missing root element. Use AbsoluteFill or a div as root.');
  }

  // Check for bare SVG elements (the "box" bug)
  const bareSvgElements = ['rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline'];
  for (const el of bareSvgElements) {
    // Check for <rect, <circle etc. that are NOT inside an <svg> context
    const regex = new RegExp(`<${el}\\s`, 'g');
    const svgWrapperRegex = new RegExp(`<svg[\\s>]`, 'g');
    const elementMatches = code.match(regex);
    const svgMatches = code.match(svgWrapperRegex);

    if (elementMatches && elementMatches.length > 0 && (!svgMatches || svgMatches.length === 0)) {
      errors.push(`CRITICAL: <${el}> elements found WITHOUT an <svg> wrapper! ALL SVG elements (${el}, circle, rect, etc.) MUST be inside an <svg> tag. Without this, they render as invisible empty boxes. Wrap them: <svg style={{ position: 'absolute', width: '100%', height: '100%' }}><${el} .../></svg>`);
      break; // One error is enough
    }
  }

  // Check for hardcoded pixel values (common quality issue)
  const hardcodedPx = /(?:fontSize|padding|margin|gap|borderRadius|width|height):\s*\d{2,}/g;
  const hardcodedMatches = code.match(hardcodedPx);
  if (hardcodedMatches && hardcodedMatches.length > 3) {
    errors.push(`Found ${hardcodedMatches.length} hardcoded pixel values (e.g. ${hardcodedMatches[0]}). Use relative sizing: fontSize: height * 0.035, padding: minDim * 0.05, etc.`);
  }

  // Check for missing key props in .map()
  if (code.includes('.map(') && !code.includes('key=')) {
    errors.push('Missing key props in .map() calls. Every .map() must include key={i} or similar.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run TypeScript compilation check on a scene file
 */
async function runTypeScriptCheck(
  workspace: string,
  filePath: string
): Promise<{ valid: boolean; errors: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', [
      'tsc', '--noEmit', '--skipLibCheck',
      '--jsx', 'react-jsx',
      '--esModuleInterop',
      '--moduleResolution', 'node',
      '--target', 'es2020',
      '--module', 'es2020',
      filePath,
    ], {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ valid: true, errors: '' });
      } else {
        // Extract just the error lines, limit to first 500 chars
        const allOutput = stdout + stderr;
        const errorLines = allOutput
          .split('\n')
          .filter(line => line.includes('error TS'))
          .slice(0, 10)
          .join('\n');
        resolve({ valid: false, errors: errorLines || allOutput.slice(0, 500) });
      }
    });

    proc.on('error', () => {
      // tsc not available, skip TS check
      resolve({ valid: true, errors: '' });
    });
  });
}

/**
 * Generate Main.tsx that composes all scenes with Sequence
 */
function generateMainComponent(
  scenes: PlannedScene[],
  plan: VisualPlan
): string {
  const componentName = (id: string) => id.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

  const imports = scenes.map(s => `import ${componentName(s.id)} from './scenes/${s.id}';`).join('\n');

  const sequences = scenes.map(s => {
    return `      <Sequence from={${s.startFrame}} durationInFrames={${s.durationFrames}} name="${s.id}">
        <${componentName(s.id)} />
      </Sequence>`;
  }).join('\n');

  return `import { AbsoluteFill, Sequence } from 'remotion';
${imports}

// Visual Concept: ${plan.visualMetaphor}
export default function Main() {
  return (
    <AbsoluteFill style={{ background: '${plan.colorScheme.background}' }}>
${sequences}
    </AbsoluteFill>
  );
}
`;
}

/**
 * Bundle the Remotion project
 */
async function bundleProject(
  workspace: string,
  bundleDir: string,
  compositionId: string,
  sourceCompositionId: string
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

    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          await createCompositionCjs(workspace, outputDir, sourceCompositionId);
          resolve({ success: true });
        } catch (err) {
          resolve({ success: false, error: `Bundle succeeded but CJS creation failed: ${err}` });
        }
      } else {
        resolve({ success: false, error: stderr });
      }
    });
  });
}

/**
 * Create a CommonJS module for the composition
 */
async function createCompositionCjs(
  workspace: string,
  outputDir: string,
  compositionId: string
): Promise<void> {
  const mainPath = join(workspace, 'src', compositionId, 'Main.tsx');
  const outputPath = join(outputDir, 'composition.cjs.js');

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', [
      'esbuild', mainPath,
      '--bundle', '--format=cjs', '--platform=browser', '--target=es2020',
      '--external:react', '--external:react/jsx-runtime', '--external:react/jsx-dev-runtime', '--external:remotion',
      '--external:@remotion/three', '--external:three', '--external:@react-three/fiber',
      `--outfile=${outputPath}`,
    ], {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`esbuild failed: ${stderr}`));
    });

    proc.on('error', reject);
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
 * Generate the Root.tsx file
 */
function generateRootTsx(
  sourceCompositionId: string,
  renderCompositionId: string,
  durationFrames: number,
  fps: number,
  width: number,
  height: number
): string {
  return `import { Composition } from 'remotion';
import Main from './${sourceCompositionId}/Main';

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
 * Main function: Generate visuals with planning-first approach
 */
export async function generateVisualsWithOpenCode(
  options: OpenCodeVisualOptions
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
    progress(5, 'Initializing...');

    const { client: llmClient, model: llmModel } = createLLMClient();
    log(`Using LLM: ${config.llm.provider} with model: ${llmModel}`);

    // Get transcript words
    const transcriptWords = transcript || parseTranscriptFromPrompt(prompt);

    if (transcriptWords.length === 0) {
      throw new Error('No transcript provided');
    }

    // STEP 1: Analyze full transcript and create visual plan
    progress(10, 'Analyzing transcript and planning visuals...');

    const visualPlan = await createVisualPlan(transcriptWords, fps, {
      openai: llmClient,
      llmModel,
      stylePreset,
      onLog: log,
    });

    log(`Visual plan: "${visualPlan.visualMetaphor}" with ${visualPlan.scenes.length} scenes`);

    const scenes = visualPlan.scenes;

    if (scenes.length === 0) {
      throw new Error('No scenes generated from visual plan');
    }

    // Create directory structure
    const compositionDir = join(absoluteWorkspace, 'src', compositionId);
    const scenesDir = join(compositionDir, 'scenes');
    await mkdir(scenesDir, { recursive: true });

    // STEP 2: Generate each scene component based on the plan
    progress(25, `Generating ${scenes.length} scene components...`);

    let scenesGenerated = 0;
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneProgress = 25 + Math.floor((i / scenes.length) * 45);
      progress(sceneProgress, `Generating scene ${i + 1}/${scenes.length}: ${scene.visualAction.slice(0, 50)}...`);

      let attempts = 0;
      let sceneCode = '';
      let isValid = false;
      let errorFeedback: string | undefined;

      while (attempts < maxIterations && !isValid) {
        attempts++;

        sceneCode = await generateSceneComponent(
          scene, visualPlan, i, scenes.length,
          llmClient, llmModel,
          { width, height, fps, stylePreset },
          errorFeedback
        );

        // Phase 1: Structural validation + SVG wrapper check
        const structureCheck = validateSceneCode(sceneCode, visualPlan.renderMode);

        if (!structureCheck.valid) {
          errorFeedback = structureCheck.errors.join('\n');
          log(`Scene ${scene.id} attempt ${attempts}: structural validation failed:\n${errorFeedback}`);
          continue;
        }

        // Phase 2: Write file and run TypeScript check
        const scenePath = join(scenesDir, `${scene.id}.tsx`);
        await writeFile(scenePath, sceneCode);

        const tsCheck = await runTypeScriptCheck(absoluteWorkspace, scenePath);

        if (!tsCheck.valid) {
          errorFeedback = `TypeScript compilation errors:\n${tsCheck.errors}\n\nFix ALL errors. If a variable is unused (TS6133), USE IT in the render, don't delete it.`;
          log(`Scene ${scene.id} attempt ${attempts}: TypeScript errors:\n${tsCheck.errors}`);
          continue;
        }

        isValid = true;
        log(`Scene ${scene.id} validated on attempt ${attempts}`);
      }

      if (!isValid) {
        // Write best attempt even if not perfect - bundle step will catch fatal errors
        log(`Scene ${scene.id}: using best attempt after ${attempts} tries`);
      }

      // Write final scene file
      const scenePath = join(scenesDir, `${scene.id}.tsx`);
      await writeFile(scenePath, sceneCode);
      log(`Scene ${scene.id} written (${sceneCode.length} chars)`);

      scenesGenerated++;
    }

    // STEP 3: Generate Main.tsx compositor
    progress(70, 'Generating Main.tsx...');

    const mainCode = generateMainComponent(scenes, visualPlan);
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
      scenes: scenes.map(s => ({
        id: s.id, startMs: s.startMs, endMs: s.endMs,
        startFrame: s.startFrame, endFrame: s.endFrame,
        visualFocus: s.visualFocus, visualAction: s.visualAction,
      })),
      visuals: [{
        startMs: 0,
        endMs: Math.round((durationFrames / fps) * 1000),
        type: stylePreset,
        description: `${visualPlan.visualMetaphor} - ${scenes.length} scenes`,
      }],
    }, null, 2));

    // STEP 4: Bundle
    progress(80, 'Bundling project...');

    const bundleResult = await bundleProject(absoluteWorkspace, absoluteBundleDir, bundleCompositionId, compositionId);

    if (!bundleResult.success) {
      throw new Error(`Bundle failed: ${bundleResult.error}`);
    }

    // STEP 5: Render video
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
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ projectId, error: errorMessage }, 'Visual generation failed');

    return {
      success: false,
      iterations: 0,
      scenesGenerated: 0,
      error: errorMessage,
    };
  }
}
