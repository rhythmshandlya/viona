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

  const systemPrompt = `You are a cinematic caption designer for short-form video (TikTok/Reels/Shorts).
Your job is to classify each word in a transcript with visual styling directives that create a Hollywood-quality cinematic caption experience.

TIERS:
- hero: The 1-2 most emotionally powerful words per sentence. Large, bold, dramatic. Speaker emphasis (slow delivery, pause) → hero.
- accent: Supporting impactful words. 2-4 per sentence.
- normal: Regular words. Most words fall here.
- whisper: Filler words, articles, prepositions (a, an, the, of, in, is, etc.). Small, subdued.

FONT ROLES:
- bold-sans: Hero/accent words with punch. Strong, uppercase feel.
- elegant-cursive: Emotional, poetic, dramatic reveal moments.
- default: Normal/whisper words. Clean and readable.

ANIMATIONS (must be one of):
elastic-pop, slide-up, blur-zoom, bounce-up, typewriter, fade-rise, slam-down, scale-bounce, fade, none
- hero → elastic-pop or slam-down
- accent → slide-up or bounce-up
- normal → fade-rise or fade
- whisper → fade or none

COLOR ROLES:
- accent: Hero and high-emphasis words
- glow: Accent words with energy
- primary: Normal and whisper words

ENTRY DELAYS (ms, 0-500):
- Use staggered delays within a sentence for cascade effect (0, 50, 100, 150…)
- Hero words: 0ms (immediate impact)
- Subsequent words: +50-100ms per word

RULES:
1. Exactly 1-2 hero words per sentence. Never more.
2. Speaker emphasis (⚡ in table) → hero or accent tier.
3. Filler words (a, an, the, of, in, is, are, was, were, it, to, for) → whisper tier.
4. Return a JSON object: { "words": [ { wordIndex, tier, fontRole, animation, entryDelayMs, colorRole } ] }
5. Include ALL ${words.length} words. One entry per word.`;

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

/**
 * Calls GPT-4o-mini to compose sentence-level layout directives from the word classifications.
 * Returns an array of SentenceDirective.
 */
export async function composeSentences(
  openai: OpenAIClient,
  words: CaptionWord[],
  wordDirectives: WordDirective[],
): Promise<SentenceDirective[]> {
  // Build a compact word+directive table for the LLM
  const rows = words.map((w, i) => {
    const d = wordDirectives.find(wd => wd.wordIndex === i);
    const tier = d?.tier ?? 'normal';
    return `${i} | ${w.text} | ${tier} | ${w.startMs}-${w.endMs}ms`;
  });
  const wordTable = ['idx | word | tier | timing', '----|------|------|-------', ...rows].join('\n');

  const systemPrompt = `You are a cinematic caption layout composer for short-form video.
Given classified words (with tiers), group them into sentences and phrase groups with layout directives.

LAYOUT RULES:
- Split transcript into natural sentences (by punctuation, pauses, or meaning — max 8 words per sentence).
- Each sentence has 1-3 phraseGroups shown sequentially on screen.
- Max 1-2 seconds (1000-2000ms) per phraseGroup.
- Hero words get their own phraseGroup with "stacked" or "cascade" layout for maximum impact.
- Normal sentences use "single-line" layout.
- Dramatic builds use "cascade" layout (words appear one by one).
- Vary alignment: center for impact, left for narrative, right for counterpoint.

MOOD OPTIONS: dramatic, urgent, curious, calm, impactful

PHRASE GROUP:
- wordIndices: array of word indices in this group (must be contiguous within the sentence)
- layout: single-line | stacked | split | cascade
- alignment: center | left | right
- durationMs: how long this group shows (100-5000ms, based on word timing)

Return JSON: { "sentences": [ { wordRange: [start, end], phraseGroups: [...], mood } ] }
- wordRange: [inclusive start, exclusive end] covering all words in the sentence
- phraseGroups must collectively cover all words in wordRange
- All wordIndices in phraseGroups must fall within wordRange`;

  const userPrompt = `Compose sentence layout for these ${words.length} words:\n\n${wordTable}`;

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
    throw new Error(`composeSentences: LLM returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).sentences)
  ) {
    throw new Error('composeSentences: LLM response missing "sentences" array');
  }

  return ((parsed as Record<string, unknown>).sentences as unknown[]).map((s) => {
    if (typeof s !== 'object' || s === null) {
      return {
        wordRange: [0, words.length] as [number, number],
        phraseGroups: [{ wordIndices: words.map((_, i) => i), layout: 'single-line' as PhraseLayout, alignment: 'center' as const, durationMs: 1000 }],
        mood: 'calm' as Mood,
      };
    }
    const sd = s as Record<string, unknown>;
    const wordRange = Array.isArray(sd.wordRange) && sd.wordRange.length === 2
      ? [sd.wordRange[0] as number, sd.wordRange[1] as number] as [number, number]
      : [0, words.length] as [number, number];

    const phraseGroups = Array.isArray(sd.phraseGroups)
      ? (sd.phraseGroups as unknown[]).map((pg) => {
          if (typeof pg !== 'object' || pg === null) {
            return { wordIndices: [], layout: 'single-line' as PhraseLayout, alignment: 'center' as const, durationMs: 1000 };
          }
          const p = pg as Record<string, unknown>;
          return {
            wordIndices: Array.isArray(p.wordIndices) ? (p.wordIndices as number[]) : [],
            layout: isValidLayout(p.layout) ? p.layout : 'single-line',
            alignment: (p.alignment === 'center' || p.alignment === 'left' || p.alignment === 'right') ? p.alignment : 'center',
            durationMs: typeof p.durationMs === 'number' ? Math.max(100, Math.min(5000, p.durationMs)) : 1000,
          } satisfies PhraseGroup;
        })
      : [{ wordIndices: [], layout: 'single-line' as PhraseLayout, alignment: 'center' as const, durationMs: 1000 }];

    return {
      wordRange,
      phraseGroups,
      mood: isValidMood(sd.mood) ? sd.mood : 'calm',
      ...(isValidPunctuationEffect(sd.punctuationEffect) ? { punctuationEffect: sd.punctuationEffect } : {}),
    } satisfies SentenceDirective;
  });
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
