// ---------------------------------------------------------------------------
// Dynamic hierarchy — word classification & emotional segmentation
// Shared across renderer, web preview, and worker export
// ---------------------------------------------------------------------------

export type WordTier = 'power' | 'strong' | 'medium' | 'filler';

export interface MinimalWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface EmotionalSegment {
  lines: number[][]; // each line is an array of word indices
  startIdx: number;
  endIdx: number; // exclusive
}

// -- Word lists ---------------------------------------------------------------

export const POWER_WORD_SET = new Set([
  'love', 'hate', 'fear', 'die', 'dead', 'death', 'kill', 'destroy', 'dream',
  'obsessed', 'insane', 'crazy', 'incredible', 'amazing', 'unbelievable',
  'shocking', 'terrifying', 'brilliant', 'genius', 'perfect', 'worst',
  'best', 'greatest', 'legendary', 'epic', 'massive', 'huge', 'evil',
  'now', 'stop', 'wait', 'listen', 'watch', 'look', 'never', 'always',
  'forever', 'immediately', 'urgent', 'warning', 'danger', 'critical',
  'important', 'breaking', 'exclusive', 'secret', 'finally', 'today',
  'million', 'billion', 'thousand', 'money', 'rich', 'free', 'paid',
  'expensive', 'cheap', 'profit', 'cash', 'dollar', 'dollars', 'price',
  'worth', 'cost', 'zero', 'double', 'triple', '100%', '1000',
  'but', 'however', 'actually', 'wrong', 'right', 'truth', 'lie', 'real',
  'fake', 'only', 'everything', 'nothing', 'impossible', 'possible',
  'everyone', 'nobody', 'first', 'last', 'biggest', 'smallest',
  'win', 'won', 'lose', 'lost', 'fight', 'broke', 'crushed', 'dominated',
  'exploded', 'changed', 'saved', 'failed', 'success', 'discovered',
]);

export const FILLER_WORD_SET = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'as',
  'and', 'or', 'if', 'it', 'its', 'that', 'this', 'than', 'then',
  'so', 'up', 'do', 'did', 'has', 'had', 'have', 'will', 'would',
  'could', 'should', 'can', 'may', 'might', 'shall', 'just', 'very',
  'also', 'about', 'into', 'not', 'no', 'yes', 'some', 'my', 'your',
  'we', 'they', 'he', 'she', 'i', 'me', 'us', 'them', 'our', 'their',
]);

// Strong words: meaningful content words a step below "power" — deserve emphasis
export const STRONG_WORD_SET = new Set([
  // Emphasis adverbs
  'really', 'literally', 'seriously', 'basically', 'honestly',
  'completely', 'extremely', 'definitely', 'absolutely', 'truly',
  'clearly', 'simply', 'exactly', 'entirely', 'probably',
  'especially', 'particularly', 'obviously', 'certainly', 'essentially',
  // Meaningful verbs
  'believe', 'remember', 'imagine', 'understand', 'realize',
  'create', 'become', 'happen', 'achieve', 'overcome',
  'struggle', 'survive', 'consider', 'experience', 'transform',
  // Key descriptors
  'different', 'specific', 'better', 'worse',
  'whole', 'every', 'enough', 'special',
  // Key nouns
  'people', 'problem', 'reason', 'question', 'answer',
  'story', 'world', 'system',
]);

// -- Classification -----------------------------------------------------------

export function classifyWordTier(text: string): WordTier {
  const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
  if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
  if (POWER_WORD_SET.has(clean)) return 'power';
  if (FILLER_WORD_SET.has(clean)) return 'filler';
  if (STRONG_WORD_SET.has(clean)) return 'strong';
  // Longer content words (7+ chars) are usually semantically significant
  if (clean.length >= 7) return 'strong';
  return 'medium';
}

// -- Visual width estimation --------------------------------------------------

const TIER_SCALE: Record<WordTier, number> = {
  power: 1.8,
  strong: 1.3,
  medium: 1.0,
  filler: 0.65,
};

/** Estimate relative visual width of a word based on character count and tier scale */
export function estimateWordVisualWidth(text: string, tier: WordTier): number {
  return text.length * TIER_SCALE[tier];
}

function lineVisualWidth(lineIndices: number[], words: MinimalWord[]): number {
  let total = 0;
  for (const idx of lineIndices) {
    const tier = classifyWordTier(words[idx].text);
    total += estimateWordVisualWidth(words[idx].text, tier);
  }
  // Add space between words
  if (lineIndices.length > 1) total += (lineIndices.length - 1) * 0.5;
  return total;
}

// -- Emotional segmentation ---------------------------------------------------

const MAX_LINE = 5;
const PAUSE_THRESHOLD_MS = 400;
const BALANCE_RATIO_THRESHOLD = 0.55;

/**
 * Phase 1: Emotional line breaking (same rules as existing algorithm)
 * - Power words get their own line for dramatic emphasis
 * - Pauses > 400ms force line breaks
 * - Filler words don't start lines (pull to previous line if possible)
 * - Max 5 words per line
 */
function buildEmotionalLines(words: MinimalWord[]): number[][] {
  const lines: number[][] = [];
  let currentLine: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const tier = classifyWordTier(words[i].text);
    const hasPause = i > 0 && (words[i].startMs - words[i - 1].endMs) > PAUSE_THRESHOLD_MS;

    if (hasPause && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }

    if (tier === 'power' && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }

    if (tier === 'filler' && currentLine.length === 0 && lines.length > 0) {
      const prevLine = lines[lines.length - 1];
      if (prevLine.length < MAX_LINE) {
        prevLine.push(i);
        continue;
      }
    }

    currentLine.push(i);

    if (tier === 'power' && currentLine.length === 1) {
      lines.push(currentLine);
      currentLine = [];
      continue;
    }

    if (currentLine.length >= MAX_LINE) {
      lines.push(currentLine);
      currentLine = [];
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Check whether two consecutive lines are separated by a pause boundary.
 * This prevents balancing from redistributing words across a natural speech gap.
 */
function hasPauseBetweenLines(
  lineA: number[],
  lineB: number[],
  words: MinimalWord[],
): boolean {
  if (lineA.length === 0 || lineB.length === 0) return false;
  const lastOfA = lineA[lineA.length - 1];
  const firstOfB = lineB[0];
  return (words[firstOfB].startMs - words[lastOfA].endMs) > PAUSE_THRESHOLD_MS;
}

/**
 * Phase 2: Balance visual widths between consecutive line pairs within a segment.
 * Move boundary words from the wider line to the narrower line if:
 *   - The moved word is not a sole power word
 *   - Neither line exceeds MAX_LINE after the move
 *   - The move improves the width ratio past BALANCE_RATIO_THRESHOLD
 *   - The lines are not separated by a pause boundary
 */
function balanceLinePair(
  lineA: number[],
  lineB: number[],
  words: MinimalWord[],
): [number[], number[]] {
  // Don't balance across pause boundaries
  if (hasPauseBetweenLines(lineA, lineB, words)) return [lineA, lineB];

  let a = [...lineA];
  let b = [...lineB];
  let improved = true;

  while (improved) {
    improved = false;
    const widthA = lineVisualWidth(a, words);
    const widthB = lineVisualWidth(b, words);

    if (widthA === 0 || widthB === 0) break;

    const currentRatio = Math.min(widthA, widthB) / Math.max(widthA, widthB);
    if (currentRatio >= BALANCE_RATIO_THRESHOLD) break;

    if (widthA > widthB) {
      // Try moving last word of A to start of B
      if (a.length <= 1) break;
      if (b.length >= MAX_LINE) break;
      const candidate = a[a.length - 1];
      // Don't move a sole power word off its line
      if (a.length === 1 && classifyWordTier(words[candidate].text) === 'power') break;
      // Don't break a power word off its own line
      if (classifyWordTier(words[candidate].text) === 'power' && a.length === 1) break;

      const newA = a.slice(0, -1);
      const newB = [candidate, ...b];
      const newWidthA = lineVisualWidth(newA, words);
      const newWidthB = lineVisualWidth(newB, words);
      const newRatio = Math.min(newWidthA, newWidthB) / Math.max(newWidthA, newWidthB);

      if (newRatio > currentRatio) {
        a = newA;
        b = newB;
        improved = true;
      } else {
        break;
      }
    } else {
      // Try moving first word of B to end of A
      if (b.length <= 1) break;
      if (a.length >= MAX_LINE) break;
      const candidate = b[0];
      if (b.length === 1 && classifyWordTier(words[candidate].text) === 'power') break;

      const newA = [...a, candidate];
      const newB = b.slice(1);
      const newWidthA = lineVisualWidth(newA, words);
      const newWidthB = lineVisualWidth(newB, words);
      const newRatio = Math.min(newWidthA, newWidthB) / Math.max(newWidthA, newWidthB);

      if (newRatio > currentRatio) {
        a = newA;
        b = newB;
        improved = true;
      } else {
        break;
      }
    }
  }

  return [a, b];
}

/**
 * Compute emotional segments with balanced visual widths.
 *
 * Phase 1: Emotional line breaking (power word isolation, pause breaks, filler handling)
 * Phase 2: Width balancing (redistribute boundary words for more even visual weight)
 */
export function computeEmotionalSegments(words: MinimalWord[]): EmotionalSegment[] {
  if (words.length === 0) return [];

  const lines = buildEmotionalLines(words);

  // Phase 2: Balance consecutive line pairs before grouping into segments
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const [balanced0, balanced1] = balanceLinePair(lines[i], lines[i + 1], words);
    lines[i] = balanced0;
    lines[i + 1] = balanced1;
  }

  // Group lines into display segments (max 2 lines per segment)
  const segments: EmotionalSegment[] = [];
  for (let l = 0; l < lines.length; l += 2) {
    const segLines = [lines[l]];
    if (l + 1 < lines.length) segLines.push(lines[l + 1]);
    const allIndices = segLines.flat();
    segments.push({
      lines: segLines,
      startIdx: allIndices[0],
      endIdx: allIndices[allIndices.length - 1] + 1,
    });
  }

  return segments;
}

/** Find which emotional segment contains a word index */
export function findActiveSegment(
  segments: EmotionalSegment[],
  wordIdx: number,
): EmotionalSegment | null {
  for (const seg of segments) {
    if (wordIdx >= seg.startIdx && wordIdx < seg.endIdx) return seg;
  }
  return segments.length > 0 ? segments[0] : null;
}
