/**
 * Normalizes text for fuzzy comparison: lowercase, collapse whitespace, trim.
 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Computes character overlap ratio between two strings.
 * Returns 0-1 where 1 is perfect match.
 */
function overlapScore(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  let matches = 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  return matches / shorter.length;
}

/**
 * Finds the best fuzzy substring match of `query` within `fullText`.
 * Returns the start and end character indices in fullText, or null if no match above threshold.
 */
export function fuzzyFind(
  query: string,
  fullText: string,
  threshold = 0.6,
): { start: number; end: number; score: number } | null {
  const normQuery = normalize(query);
  const normFull = normalize(fullText);

  if (normQuery.length === 0 || normFull.length === 0) return null;

  // Try exact substring first
  const exactIdx = normFull.indexOf(normQuery);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + normQuery.length, score: 1.0 };
  }

  // Sliding window fuzzy match
  const windowSize = normQuery.length;
  let bestScore = 0;
  let bestStart = 0;

  for (let i = 0; i <= normFull.length - windowSize; i++) {
    const window = normFull.substring(i, i + windowSize);
    const score = overlapScore(normQuery, window);
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  // Also try windows slightly shorter/longer to handle length mismatches
  for (const delta of [-3, -2, -1, 1, 2, 3]) {
    const altSize = windowSize + delta;
    if (altSize <= 0 || altSize > normFull.length) continue;
    for (let i = 0; i <= normFull.length - altSize; i++) {
      const window = normFull.substring(i, i + altSize);
      const score = overlapScore(normQuery, window);
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }
  }

  if (bestScore < threshold) return null;

  return {
    start: bestStart,
    end: bestStart + normQuery.length,
    score: bestScore,
  };
}
