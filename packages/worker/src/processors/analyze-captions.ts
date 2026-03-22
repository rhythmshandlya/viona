import { eq, inArray } from 'drizzle-orm';
import { db, projects, tracks, timelineItems } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

export interface AnalyzeCaptionsJobData {
  projectId: string;
  jobId: string;
}

// EmphasisMarker mirrors the Zod schema in packages/shared/src/caption-analysis.ts
// It is defined inline here because caption-analysis.ts is not exported from @viona/shared's index.
export interface EmphasisMarker {
  wordIndex: number;
  confidence: number;
  type: 'slow-delivery' | 'pause-before' | 'pause-after' | 'pace-change';
  durationRatio: number;
}

interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

const SLOW_DELIVERY_THRESHOLD = 2.0;
const PAUSE_THRESHOLD_MS = 400;
const PACE_CHANGE_FACTOR = 2.0;

export function detectSpeakerEmphasis(words: CaptionWord[]): EmphasisMarker[] {
  if (words.length < 2) return [];

  const markers: EmphasisMarker[] = [];
  const durations = words.map(w => w.endMs - w.startMs);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  for (let i = 0; i < words.length; i++) {
    const duration = durations[i];
    const durationRatio = duration / avgDuration;

    // Slow delivery: word duration is significantly above the average for this clip.
    // Uses raw durationRatio without character-length normalization to avoid penalizing
    // naturally longer words (e.g. "empire" at 2.4x is genuinely slow delivery).
    if (durationRatio > SLOW_DELIVERY_THRESHOLD) {
      const confidence = Math.min(1, (durationRatio - SLOW_DELIVERY_THRESHOLD) / 2 + 0.5);
      markers.push({ wordIndex: i, confidence, type: 'slow-delivery', durationRatio });
    }

    // Pause before: significant gap between previous word end and this word start
    if (i > 0) {
      const gap = words[i].startMs - words[i - 1].endMs;
      if (gap > PAUSE_THRESHOLD_MS) {
        const confidence = Math.min(1, (gap - PAUSE_THRESHOLD_MS) / 600 + 0.5);
        markers.push({ wordIndex: i, confidence, type: 'pause-before', durationRatio: gap / avgDuration });
      }
    }

    // Pause after: significant gap between this word end and next word start
    if (i < words.length - 1) {
      const gap = words[i + 1].startMs - words[i].endMs;
      if (gap > PAUSE_THRESHOLD_MS) {
        const confidence = Math.min(1, (gap - PAUSE_THRESHOLD_MS) / 600 + 0.5);
        markers.push({ wordIndex: i, confidence, type: 'pause-after', durationRatio: gap / avgDuration });
      }
    }

    // Pace change: local 3-word window speed differs significantly from surrounding context
    if (i >= 1 && i < words.length - 1) {
      const localAvg = (durations[i - 1] + durations[i] + durations[i + 1]) / 3;
      const neighborAvg = i >= 2 && i < words.length - 2
        ? (durations[i - 2] + durations[i + 2]) / 2
        : avgDuration;
      const ratio = localAvg / neighborAvg;
      if (ratio > PACE_CHANGE_FACTOR || ratio < 1 / PACE_CHANGE_FACTOR) {
        const confidence = Math.min(1, Math.abs(ratio - 1) / 2 + 0.3);
        markers.push({ wordIndex: i, confidence, type: 'pace-change', durationRatio });
      }
    }
  }

  return markers;
}

// --- Types (mirrored from packages/shared/src/caption-analysis.ts) ---

export type CinematicTier = 'hero' | 'accent' | 'normal' | 'whisper';
export type FontRole = 'bold-sans' | 'elegant-cursive' | 'default';
export type CinematicAnimation =
  | 'elastic-pop' | 'slide-up' | 'blur-zoom' | 'bounce-up'
  | 'typewriter' | 'fade-rise' | 'slam-down'
  | 'scale-bounce' | 'fade' | 'none';
export type ColorRole = 'primary' | 'accent' | 'glow';
export type PhraseLayout = 'single-line' | 'stacked' | 'split' | 'cascade';
export type Mood = 'dramatic' | 'urgent' | 'curious' | 'calm' | 'impactful';

export interface WordDirective {
  wordIndex: number;
  tier: CinematicTier;
  fontRole: FontRole;
  animation: CinematicAnimation;
  entryDelayMs: number;
  colorRole: ColorRole;
  textTransform?: 'uppercase' | 'none';
  scaleOverride?: number;
}

export interface PhraseGroup {
  wordIndices: number[];
  layout: PhraseLayout;
  alignment: 'center' | 'left' | 'right';
  durationMs: number;
}

export interface SentenceDirective {
  wordRange: [number, number];
  phraseGroups: PhraseGroup[];
  mood: Mood;
  punctuationEffect?: 'question-pop' | 'exclaim-shake' | 'ellipsis-fade' | 'none';
}

export interface CaptionAnalysisMetadata {
  analyzedAt: string;
  model: string;
  version: number;
}

export interface CaptionAnalysis {
  words: WordDirective[];
  sentences: SentenceDirective[];
  speakerEmphasis: EmphasisMarker[];
  metadata: CaptionAnalysisMetadata;
}

const DEFAULT_WORD_DIRECTIVE: Omit<WordDirective, 'wordIndex'> = {
  tier: 'normal',
  fontRole: 'default',
  animation: 'fade-rise',
  entryDelayMs: 0,
  colorRole: 'primary',
};

// --- formatWordsForLLM ---

/**
 * Formats a list of caption words into a pipe-delimited table for LLM input.
 * Each row: `index | word | durationMs | emphasisMarker`
 * Emphasis is shown as `⚡type(ratio)` — `—` if no emphasis.
 */
export function formatWordsForLLM(words: CaptionWord[], emphasis: EmphasisMarker[]): string {
  // Build a map from wordIndex → emphasis markers (a word can have multiple)
  const emphasisByIndex = new Map<number, EmphasisMarker[]>();
  for (const marker of emphasis) {
    const existing = emphasisByIndex.get(marker.wordIndex) ?? [];
    existing.push(marker);
    emphasisByIndex.set(marker.wordIndex, existing);
  }

  const header = 'idx | word | durationMs | emphasis';
  const separator = '----|------|------------|----------';
  const rows = words.map((w, i) => {
    const durationMs = w.endMs - w.startMs;
    const markers = emphasisByIndex.get(i);
    const emphasisStr = markers && markers.length > 0
      ? markers.map(m => `⚡${m.type}(${m.durationRatio.toFixed(2)})`).join(' ')
      : '—';
    return `${i} | ${w.text} | ${durationMs} | ${emphasisStr}`;
  });

  return [header, separator, ...rows].join('\n');
}

// --- LLM OpenAI client type (minimal interface to avoid hard dependency) ---

interface OpenAIClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        temperature: number;
        response_format: { type: 'json_object' };
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

// --- classifyWords ---

/**
 * Calls GPT-4o-mini to classify each word with a cinematic tier, font role,
 * animation, entry delay, and color role. Returns an array of WordDirective.
 */
export async function classifyWords(
  openai: OpenAIClient,
  words: CaptionWord[],
  emphasis: EmphasisMarker[],
): Promise<WordDirective[]> {
  const wordTable = formatWordsForLLM(words, emphasis);

  const systemPrompt = `Create highly engaging cinematic subtitles for a vertical 9:16 short-form video (Instagram Reels / TikTok / Shorts).

STYLE: Mix of bold sans-serif + elegant cursive (luxury aesthetic). Highlight 1-2 key words per phrase in LARGE size (hero tier = 2-3x bigger). Use color contrast: white + accent color (red/orange/yellow gradient). Add glow/shadow for readability. Viral, attention-grabbing, premium, modern, slightly dramatic.

TIERS (controls font size multiplier):
- hero: 1-2 most emotionally powerful / curiosity-hook words per phrase. LARGE, bold, dramatic. Speaker emphasis (⚡) → hero.
- accent: Supporting impactful words, 2-3 per phrase. Medium emphasis.
- normal: Regular words. Most words are this tier.
- whisper: Filler words (a, an, the, of, in, is, are, was, were, it, to, for, and, but, so, or). Small, subdued.

FONT ROLES:
- bold-sans: Hero and accent words. Strong, uppercase punch.
- elegant-cursive: Emotional, poetic, dramatic reveal moments (use sparingly on 1-2 hero words).
- default: Normal and whisper words. Clean and readable.

ANIMATIONS (must be one of):
elastic-pop, slide-up, blur-zoom, bounce-up, typewriter, fade-rise, slam-down, scale-bounce, fade, none
- hero → elastic-pop, slam-down, or blur-zoom (dramatic emphasis, zoom/bounce)
- accent → slide-up, bounce-up, or scale-bounce (kinetic motion)
- normal → fade-rise (smooth, clean)
- whisper → fade or none (minimal)

COLOR ROLES:
- accent: Hero and high-emphasis words (gets gradient or accent color)
- glow: Accent-tier words with energy
- primary: Normal and whisper words (white)

ENTRY DELAYS (ms, 0-300):
- Slight stagger between words for dramatic effect: 0, 30, 60, 90…
- Hero words: 0ms (immediate impact, no delay)
- Keep total stagger under 300ms so phrase feels cohesive

RULES:
1. Exactly 1-2 hero words per phrase. Never more.
2. Speaker emphasis (⚡ in table) → hero or accent tier.
3. Filler words → whisper tier always.
4. Question words (what, why, how, when) → accent tier (curiosity hooks).
5. Return JSON: { "words": [ { wordIndex, tier, fontRole, animation, entryDelayMs, colorRole } ] }
6. Include ALL ${words.length} words. One entry per word.`;

  const userPrompt = `Classify these ${words.length} words:\n\n${wordTable}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`classifyWords: LLM returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).words)
  ) {
    throw new Error('classifyWords: LLM response missing "words" array');
  }

  return ((parsed as Record<string, unknown>).words as unknown[]).map((w, fallbackIdx) => {
    if (typeof w !== 'object' || w === null) {
      return { wordIndex: fallbackIdx, ...DEFAULT_WORD_DIRECTIVE };
    }
    const d = w as Record<string, unknown>;
    return {
      wordIndex: typeof d.wordIndex === 'number' ? d.wordIndex : fallbackIdx,
      tier: isValidTier(d.tier) ? d.tier : 'normal',
      fontRole: isValidFontRole(d.fontRole) ? d.fontRole : 'default',
      animation: isValidAnimation(d.animation) ? d.animation : 'fade-rise',
      entryDelayMs: typeof d.entryDelayMs === 'number' ? Math.max(0, Math.min(500, d.entryDelayMs)) : 0,
      colorRole: isValidColorRole(d.colorRole) ? d.colorRole : 'primary',
      ...(d.textTransform === 'uppercase' || d.textTransform === 'none' ? { textTransform: d.textTransform as 'uppercase' | 'none' } : {}),
    } satisfies WordDirective;
  });
}

// --- composeSentences ---

const WORDS_PER_PHRASE = 5;
const PAUSE_SPLIT_MS = 400; // Split into new sentence on pauses > 400ms

/**
 * Deterministic sentence/phrase composition from word timing + directives.
 * Groups words into ~5-word phrases, splitting on natural pauses.
 * No LLM needed — the word classifier already did the creative work.
 */
export function composeSentences(
  words: CaptionWord[],
  wordDirectives: WordDirective[],
): SentenceDirective[] {
  if (words.length === 0) return [];

  // Step 1: Split into sentences at natural pause boundaries
  const sentenceBoundaries: number[] = [0]; // indices where new sentences start
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startMs - words[i - 1].endMs;
    if (gap > PAUSE_SPLIT_MS) {
      sentenceBoundaries.push(i);
    }
  }

  const sentences: SentenceDirective[] = [];

  for (let s = 0; s < sentenceBoundaries.length; s++) {
    const sentStart = sentenceBoundaries[s];
    const sentEnd = s + 1 < sentenceBoundaries.length ? sentenceBoundaries[s + 1] : words.length;
    const sentWordCount = sentEnd - sentStart;

    // Step 2: Split sentence into phrase groups of ~WORDS_PER_PHRASE
    const phraseGroups: PhraseGroup[] = [];
    for (let p = sentStart; p < sentEnd; p += WORDS_PER_PHRASE) {
      const phraseEnd = Math.min(p + WORDS_PER_PHRASE, sentEnd);
      const indices = [];
      for (let i = p; i < phraseEnd; i++) indices.push(i);

      // Pick layout based on whether phrase has a hero word
      const hasHero = indices.some(i => {
        const d = wordDirectives.find(wd => wd.wordIndex === i);
        return d?.tier === 'hero';
      });
      const layout: PhraseLayout = hasHero ? 'stacked' : 'single-line';

      const durationMs = words[phraseEnd - 1].endMs - words[indices[0]].startMs;

      phraseGroups.push({
        wordIndices: indices,
        layout,
        alignment: 'center',
        durationMs: Math.max(500, durationMs),
      });
    }

    // Step 3: Determine mood from tiers
    const heroCount = wordDirectives
      .filter(d => d.wordIndex >= sentStart && d.wordIndex < sentEnd && d.tier === 'hero')
      .length;
    const mood: Mood = heroCount >= 2 ? 'dramatic' : heroCount === 1 ? 'impactful' : sentWordCount <= 3 ? 'urgent' : 'calm';

    sentences.push({
      wordRange: [sentStart, sentEnd],
      phraseGroups,
      mood,
    });
  }

  return sentences;
}

// --- validateAndRepairAnalysis ---

/**
 * Validates and repairs a CaptionAnalysis:
 * 1. Removes word directives with out-of-bounds wordIndex
 * 2. Deduplicates by wordIndex (keeps first occurrence)
 * 3. Fills missing word indices with DEFAULT_WORD_DIRECTIVE
 * 4. Sorts word directives by wordIndex
 */
export function validateAndRepairAnalysis(
  analysis: CaptionAnalysis,
  wordCount: number,
): CaptionAnalysis {
  // Step 1: Remove out-of-bounds wordIndex
  const inBounds = analysis.words.filter(w => w.wordIndex >= 0 && w.wordIndex < wordCount);

  // Step 2: Deduplicate by wordIndex (keep first occurrence)
  const seen = new Set<number>();
  const deduped: WordDirective[] = [];
  for (const w of inBounds) {
    if (!seen.has(w.wordIndex)) {
      seen.add(w.wordIndex);
      deduped.push(w);
    }
  }

  // Step 3: Fill missing indices with defaults
  const byIndex = new Map<number, WordDirective>(deduped.map(w => [w.wordIndex, w]));
  const filled: WordDirective[] = [];
  for (let i = 0; i < wordCount; i++) {
    filled.push(byIndex.get(i) ?? { wordIndex: i, ...DEFAULT_WORD_DIRECTIVE });
  }

  // Step 4: Sort by wordIndex (already in order from the fill loop, but be explicit)
  filled.sort((a, b) => a.wordIndex - b.wordIndex);

  return {
    ...analysis,
    words: filled,
  };
}

// --- Type guards ---

const VALID_TIERS: CinematicTier[] = ['hero', 'accent', 'normal', 'whisper'];
const VALID_FONT_ROLES: FontRole[] = ['bold-sans', 'elegant-cursive', 'default'];
const VALID_ANIMATIONS: CinematicAnimation[] = [
  'elastic-pop', 'slide-up', 'blur-zoom', 'bounce-up',
  'typewriter', 'fade-rise', 'slam-down', 'scale-bounce', 'fade', 'none',
];
const VALID_COLOR_ROLES: ColorRole[] = ['primary', 'accent', 'glow'];
const VALID_LAYOUTS: PhraseLayout[] = ['single-line', 'stacked', 'split', 'cascade'];
const VALID_MOODS: Mood[] = ['dramatic', 'urgent', 'curious', 'calm', 'impactful'];
const VALID_PUNCTUATION_EFFECTS = ['question-pop', 'exclaim-shake', 'ellipsis-fade', 'none'] as const;

function isValidTier(v: unknown): v is CinematicTier { return VALID_TIERS.includes(v as CinematicTier); }
function isValidFontRole(v: unknown): v is FontRole { return VALID_FONT_ROLES.includes(v as FontRole); }
function isValidAnimation(v: unknown): v is CinematicAnimation { return VALID_ANIMATIONS.includes(v as CinematicAnimation); }
function isValidColorRole(v: unknown): v is ColorRole { return VALID_COLOR_ROLES.includes(v as ColorRole); }
function isValidLayout(v: unknown): v is PhraseLayout { return VALID_LAYOUTS.includes(v as PhraseLayout); }
function isValidMood(v: unknown): v is Mood { return VALID_MOODS.includes(v as Mood); }
function isValidPunctuationEffect(v: unknown): v is typeof VALID_PUNCTUATION_EFFECTS[number] {
  return VALID_PUNCTUATION_EFFECTS.includes(v as typeof VALID_PUNCTUATION_EFFECTS[number]);
}

// --- processAnalyzeCaptions job handler ---

/**
 * Main job handler for the analyze-captions queue.
 *
 * Pipeline per caption item:
 *   1. detectSpeakerEmphasis (heuristic, no LLM)
 *   2. classifyWords (LLM — gpt-4o-mini)
 *   3. composeSentences (LLM — gpt-4o-mini)
 *   4. validateAndRepairAnalysis
 *
 * Results are written to `projects.videoSettings.captionAnalysis`.
 * Partial results are acceptable — if some items fail, successful ones are still written.
 * Retry logic: retries once on LLM failure; skips item on second failure.
 */
export async function processAnalyzeCaptions(data: AnalyzeCaptionsJobData): Promise<void> {
  const { projectId, jobId } = data;

  logger.info({ projectId, jobId }, '[analyze-captions] Starting cinematic caption analysis');

  const apiKey = config.transcription.openaiApiKey;
  if (!apiKey) {
    logger.warn({ projectId, jobId }, '[analyze-captions] No OPENAI_API_KEY — skipping analysis');
    return;
  }

  // Instantiate OpenAI client (dynamic import to match existing worker pattern)
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  // Step 1: Load project to verify it exists
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    logger.warn({ projectId, jobId }, '[analyze-captions] Project not found — skipping');
    return;
  }

  // Step 2: Find all subtitle tracks for this project (timelineItems has no projectId — join via tracks)
  const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));
  const subtitleTrackIds = projectTracks
    .filter(t => t.type === 'subtitle' || t.type === 'caption')
    .map(t => t.id);

  if (subtitleTrackIds.length === 0) {
    logger.warn({ projectId, jobId }, '[analyze-captions] No subtitle tracks found — skipping');
    return;
  }

  // Step 3: Load all subtitle timeline items
  const allItems = await db.select().from(timelineItems)
    .where(inArray(timelineItems.trackId, subtitleTrackIds));

  const captionItems = allItems
    .filter(item => item.type === 'subtitle')
    .sort((a, b) => a.startMs - b.startMs);

  if (captionItems.length === 0) {
    logger.warn({ projectId, jobId }, '[analyze-captions] No subtitle items found — skipping');
    return;
  }

  logger.info({ projectId, jobId, captionCount: captionItems.length }, '[analyze-captions] Analyzing caption items');

  // Step 4: Process each caption item with retry-once logic
  const results: Array<{ itemId: string; analysis: CaptionAnalysis }> = [];

  for (const item of captionItems) {
    const itemData = item.data as Record<string, unknown>;
    const rawWords = itemData.words;

    if (!Array.isArray(rawWords) || rawWords.length === 0) {
      logger.debug({ projectId, itemId: item.id }, '[analyze-captions] Item has no words — skipping');
      continue;
    }

    const words: CaptionWord[] = (rawWords as Array<Record<string, unknown>>).map(w => ({
      text: String(w.text ?? ''),
      startMs: typeof w.startMs === 'number' ? w.startMs : 0,
      endMs: typeof w.endMs === 'number' ? w.endMs : 0,
    }));

    // Retry once on failure
    let attempt = 0;
    let succeeded = false;

    while (attempt < 2 && !succeeded) {
      attempt++;
      try {
        // 4a. Speaker emphasis (heuristic — no LLM)
        const speakerEmphasis = detectSpeakerEmphasis(words);

        // 4b. Classify words (LLM)
        const wordDirectives = await classifyWords(openai, words, speakerEmphasis);

        // 4c. Compose sentences (deterministic — no LLM)
        const sentenceDirectives = composeSentences(words, wordDirectives);

        // 4d. Validate & repair
        const rawAnalysis: CaptionAnalysis = {
          words: wordDirectives,
          sentences: sentenceDirectives,
          speakerEmphasis,
          metadata: {
            analyzedAt: new Date().toISOString(),
            model: 'gpt-4o-mini',
            version: 1,
          },
        };
        const analysis = validateAndRepairAnalysis(rawAnalysis, words.length);

        results.push({ itemId: item.id, analysis });
        succeeded = true;

        logger.debug(
          { projectId, itemId: item.id, wordCount: words.length },
          '[analyze-captions] Item analyzed successfully',
        );
      } catch (err) {
        if (attempt < 2) {
          logger.warn({ projectId, itemId: item.id, attempt, err }, '[analyze-captions] LLM failure — retrying once');
        } else {
          logger.error({ projectId, itemId: item.id, err }, '[analyze-captions] LLM failure on retry — skipping item');
        }
      }
    }
  }

  // Step 5: Write partial or full results to projects.videoSettings.captionAnalysis
  if (results.length === 0) {
    logger.warn({ projectId, jobId }, '[analyze-captions] All items failed — nothing to write');
    return;
  }

  // Build a map of itemId → analysis for storage
  const captionAnalysis: Record<string, CaptionAnalysis> = {};
  for (const { itemId, analysis } of results) {
    captionAnalysis[itemId] = analysis;
  }

  const currentVideoSettings = (project.videoSettings as Record<string, unknown>) ?? {};
  await db.update(projects)
    .set({
      videoSettings: {
        ...currentVideoSettings,
        captionAnalysis,
      },
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  logger.info(
    { projectId, jobId, analyzed: results.length, total: captionItems.length },
    '[analyze-captions] Caption analysis complete — results written to videoSettings',
  );
}
