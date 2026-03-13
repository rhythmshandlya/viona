/**
 * AI Caption Style Generator
 * Uses Anthropic API to analyze caption text and generate per-caption styling
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs } from '../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { logger } from '../logger.js';

export interface GenerateCaptionStylesJobData {
  projectId: string;
  jobId: string;
}

// Available fonts that AI can choose from (mirrors font-registry.ts)
const AVAILABLE_FONTS = [
  'Inter', 'Montserrat', 'Poppins', 'Source Sans 3', 'Space Grotesk',
  'DM Sans', 'Outfit', 'Nunito', 'Playfair Display', 'Lora',
  'Merriweather', 'JetBrains Mono', 'Fira Code', 'Bebas Neue', 'Rubik',
];

interface CaptionStyleOverride {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  activeColor?: string;
  backgroundColor?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  letterSpacing?: number;
  stroke?: { width: number; color: string } | null;
  effects?: {
    shadow: { offsetX: number; offsetY: number; blur: number; color: string; opacity: number } | null;
    shadowSecondary: { offsetX: number; offsetY: number; blur: number; color: string; opacity: number } | null;
    glow: { enabled: boolean; color: string; intensity: number; size: number } | null;
  };
}

interface CaptionForPrompt {
  index: number;
  text: string;
  startMs: number;
  endMs: number;
}

export async function processGenerateCaptionStylesJob(job: Job<GenerateCaptionStylesJobData>) {
  const { projectId, jobId } = job.data;

  try {
    // Update job status to processing
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading captions...');

    // Load project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get all caption/subtitle tracks and items
    const projectTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, projectId),
    });

    const captionTrack = projectTracks.find(t => t.type === 'subtitle' || t.type === 'caption');
    if (!captionTrack) {
      throw new Error('No caption track found');
    }

    const allItems = await db.select().from(timelineItems)
      .where(eq(timelineItems.trackId, captionTrack.id));

    // Sort by start time
    const captionItems = allItems
      .filter(item => item.type === 'subtitle')
      .sort((a, b) => a.startMs - b.startMs);

    if (captionItems.length === 0) {
      throw new Error('No caption items found');
    }

    logger.info({ projectId, jobId, captionCount: captionItems.length }, 'Found captions for AI styling');

    await publishJobProgress(jobId, 10, `Analyzing ${captionItems.length} captions...`);

    // Build caption list for the prompt
    const captionsForPrompt: CaptionForPrompt[] = captionItems.map((item, index) => {
      const data = item.data as Record<string, unknown>;
      return {
        index,
        text: (data.text as string) || '',
        startMs: item.startMs,
        endMs: item.endMs,
      };
    });

    // Build the Claude prompt
    const prompt = buildPrompt(captionsForPrompt);

    await publishJobProgress(jobId, 20, 'AI is generating styles...');

    // Call Claude CLI
    const aiResponse = await callLLM(prompt);

    await publishJobProgress(jobId, 70, 'Parsing AI response...');

    // Parse and validate the response
    const styleOverrides = parseAiResponse(aiResponse, captionItems.length);

    await publishJobProgress(jobId, 80, 'Applying styles to captions...');

    // Write styleOverrides to each caption item's data JSONB
    for (let i = 0; i < captionItems.length; i++) {
      const item = captionItems[i];
      const override = styleOverrides[i];

      if (override && Object.keys(override).length > 0) {
        const currentData = item.data as Record<string, unknown>;
        const updatedData = {
          ...currentData,
          styleOverrides: override,
        };

        await db.update(timelineItems)
          .set({ data: updatedData })
          .where(eq(timelineItems.id, item.id));
      }
    }

    // Update videoSettings to track AI caption style status
    const currentVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
    await db.update(projects)
      .set({
        videoSettings: {
          ...currentVideoSettings,
          aiCaptionStyleStatus: 'complete',
        },
      })
      .where(eq(projects.id, projectId));

    // Update job as complete
    await db.update(jobs)
      .set({
        status: 'complete',
        progress: 100,
        progressMessage: 'AI caption styles applied',
        completedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, jobId, styledCount: captionItems.length }, 'AI caption styles generated successfully');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, jobId, err }, 'Generate caption styles job failed');

    await db.update(jobs)
      .set({ status: 'failed', error: errorMsg })
      .where(eq(jobs.id, jobId));

    // Reset AI status on failure
    try {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });
      if (project) {
        const currentVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
        await db.update(projects)
          .set({
            videoSettings: {
              ...currentVideoSettings,
              aiCaptionStyleStatus: 'error',
            },
          })
          .where(eq(projects.id, projectId));
      }
    } catch {
      // Ignore cleanup errors
    }

    await publishJobError(jobId, errorMsg);
    throw err;
  }
}

function buildPrompt(captions: CaptionForPrompt[]): string {
  const captionList = captions.map(c =>
    `[${c.index}] "${c.text}" (${(c.startMs / 1000).toFixed(1)}s - ${(c.endMs / 1000).toFixed(1)}s)`
  ).join('\n');

  return `You are a bold, creative video caption stylist for short-form content (TikTok/Reels). Generate VISUALLY STRIKING per-caption styles that make the video pop.

CAPTIONS:
${captionList}

AVAILABLE FONTS: ${AVAILABLE_FONTS.join(', ')}

STYLE PHILOSOPHY:
- Make key moments DRAMATICALLY different — big font, bold colors, glow effects, uppercase
- Use VIVID activeColor per caption — cycle through bright colors: #FF3366, #00FF88, #FFD700, #00BFFF, #FF6B35, #A855F7
- The activeColor is the highlighted word color — it MUST be eye-catching and different across captions
- Vary fontSize meaningfully: important phrases get 64-80, normal ones get 48-56
- Use different fontFamily for emphasis moments (e.g. Bebas Neue for impact, Playfair Display for dramatic reveals)
- Add glow effects on key emotional moments
- Use stroke on high-energy captions for a punchy look
- Every caption should have at least activeColor set

RULES:
1. Return a JSON array with exactly ${captions.length} objects, one per caption
2. Each object overrides the base style — only include properties you want to change
3. EVERY caption MUST have "activeColor" set to a vivid hex color
4. At least 40% of captions should have noticeably different fontSize or fontWeight
5. Use uppercase textTransform for exclamations, emphasis, or key reveals
6. Colors must be valid hex (e.g., "#FF3366"), backgroundColor can be "transparent"
7. fontSize range: 40-84, fontWeight: 400-900 (increments of 100), letterSpacing: 0-6

VALID PROPERTIES (all optional except activeColor):
- fontFamily: string (from list above, with fallback e.g. "Bebas Neue, system-ui, sans-serif")
- fontSize: number (40-84)
- fontWeight: number (400-900)
- color: string (hex — base text color, white or light gray is good)
- activeColor: string (hex — MUST be vivid and vary across captions)
- backgroundColor: string (hex or "transparent")
- textTransform: "none" | "uppercase" | "lowercase"
- letterSpacing: number (0-6)
- stroke: { width: number (1-4), color: string (hex) } | null
- effects: { shadow: { offsetX, offsetY, blur, color, opacity } | null, shadowSecondary: null, glow: { enabled: true, color, intensity (0.3-1), size (10-35) } | null }

Respond ONLY with a valid JSON array. No markdown, no explanation, no code fences.`;
}

async function callLLM(prompt: string): Promise<string> {
  // Try Anthropic SDK first (direct or via proxy), fall back to OpenRouter
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_MAX_PROXY_URL) {
    try {
      // @ts-expect-error — @anthropic-ai/sdk installed at runtime via Claude Code OAuth
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const config: Record<string, string> = {};
      if (process.env.CLAUDE_MAX_PROXY_URL) {
        config.baseURL = process.env.CLAUDE_MAX_PROXY_URL;
        config.apiKey = process.env.ANTHROPIC_API_KEY || 'proxy';
      }
      const anthropic = new Anthropic(config);
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      logger.warn({ err }, 'Anthropic API/proxy failed, trying OpenRouter fallback');
      // Fall through to OpenRouter
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    // Try multiple models in order of preference
    const models = [
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-3.5-sonnet',
    ];
    let lastError: string | null = null;
    for (const model of models) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (response.ok) {
        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        return data.choices[0]?.message?.content || '';
      }
      lastError = await response.text();
      logger.warn({ model, status: response.status }, 'OpenRouter model failed, trying next');
    }
    throw new Error(`OpenRouter API error: ${lastError}`);
  }

  throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.');
}

function parseAiResponse(response: string, expectedCount: number): CaptionStyleOverride[] {
  // Try to extract JSON array from the response
  let jsonStr = response.trim();

  // Remove markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Try to find the JSON array
  const arrayStart = jsonStr.indexOf('[');
  const arrayEnd = jsonStr.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
  }

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    logger.error({ response: response.slice(0, 500) }, 'Failed to parse AI response as JSON');
    throw new Error('AI returned invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  // Pad or trim to expected count
  while (parsed.length < expectedCount) {
    parsed.push({});
  }
  if (parsed.length > expectedCount) {
    parsed = parsed.slice(0, expectedCount);
  }

  // Validate and sanitize each override
  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') return {};
    return sanitizeStyleOverride(item as Record<string, unknown>);
  });
}

function sanitizeStyleOverride(raw: Record<string, unknown>): CaptionStyleOverride {
  const result: CaptionStyleOverride = {};

  // fontFamily - must be from available fonts
  if (typeof raw.fontFamily === 'string') {
    const primary = raw.fontFamily.split(',')[0].trim();
    if (AVAILABLE_FONTS.includes(primary)) {
      result.fontFamily = raw.fontFamily;
    }
  }

  // fontSize - 36 to 84
  if (typeof raw.fontSize === 'number' && raw.fontSize >= 36 && raw.fontSize <= 84) {
    result.fontSize = Math.round(raw.fontSize);
  }

  // fontWeight - 400-900
  if (typeof raw.fontWeight === 'number' && raw.fontWeight >= 400 && raw.fontWeight <= 900) {
    result.fontWeight = Math.round(raw.fontWeight / 100) * 100;
  }

  // Colors - must be valid hex
  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  if (typeof raw.color === 'string' && hexRegex.test(raw.color)) {
    result.color = raw.color;
  }
  if (typeof raw.activeColor === 'string' && hexRegex.test(raw.activeColor)) {
    result.activeColor = raw.activeColor;
  }
  if (typeof raw.backgroundColor === 'string') {
    if (raw.backgroundColor === 'transparent' || hexRegex.test(raw.backgroundColor)) {
      result.backgroundColor = raw.backgroundColor;
    }
  }

  // textTransform
  if (raw.textTransform === 'none' || raw.textTransform === 'uppercase' || raw.textTransform === 'lowercase') {
    result.textTransform = raw.textTransform;
  }

  // letterSpacing
  if (typeof raw.letterSpacing === 'number' && raw.letterSpacing >= 0 && raw.letterSpacing <= 6) {
    result.letterSpacing = raw.letterSpacing;
  }

  // stroke
  if (raw.stroke === null) {
    result.stroke = null;
  } else if (raw.stroke && typeof raw.stroke === 'object') {
    const s = raw.stroke as Record<string, unknown>;
    if (typeof s.width === 'number' && typeof s.color === 'string' && hexRegex.test(s.color)) {
      result.stroke = {
        width: Math.min(6, Math.max(0.5, s.width)),
        color: s.color,
      };
    }
  }

  // effects
  if (raw.effects && typeof raw.effects === 'object') {
    const e = raw.effects as Record<string, unknown>;
    result.effects = {
      shadow: sanitizeShadow(e.shadow),
      shadowSecondary: sanitizeShadow(e.shadowSecondary),
      glow: sanitizeGlow(e.glow),
    };
  }

  return result;
}

function sanitizeShadow(raw: unknown): { offsetX: number; offsetY: number; blur: number; color: string; opacity: number } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;

  const s = raw as Record<string, unknown>;
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  if (
    typeof s.offsetX === 'number' &&
    typeof s.offsetY === 'number' &&
    typeof s.blur === 'number' &&
    typeof s.color === 'string' && hexRegex.test(s.color) &&
    typeof s.opacity === 'number'
  ) {
    return {
      offsetX: Math.min(20, Math.max(-20, s.offsetX)),
      offsetY: Math.min(20, Math.max(-20, s.offsetY)),
      blur: Math.min(30, Math.max(0, s.blur)),
      color: s.color,
      opacity: Math.min(1, Math.max(0, s.opacity)),
    };
  }

  return null;
}

function sanitizeGlow(raw: unknown): { enabled: boolean; color: string; intensity: number; size: number } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;

  const g = raw as Record<string, unknown>;
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  if (
    g.enabled === true &&
    typeof g.color === 'string' && hexRegex.test(g.color) &&
    typeof g.intensity === 'number' &&
    typeof g.size === 'number'
  ) {
    return {
      enabled: true,
      color: g.color,
      intensity: Math.min(1, Math.max(0, g.intensity)),
      size: Math.min(50, Math.max(5, g.size)),
    };
  }

  return null;
}
