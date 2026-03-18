import { readFile, writeFile } from 'fs/promises';

interface Word {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

interface Transcript {
  words: Word[];
  segments: Segment[];
  language: string;
}

interface ManifestItem {
  id: string;
  type: string;
  startMs: number;
  endMs: number;
  data?: { startFrom?: number };
}

interface RippleShift {
  atMs: number;        // original timeline position
  deltaMs: number;     // cumulative shift at this point
}

/**
 * Compute cumulative ripple shifts by comparing original transcript
 * word coverage against current manifest video/audio item coverage.
 */
function computeRippleShifts(
  originalWords: Word[],
  manifestItems: ManifestItem[],
): RippleShift[] {
  // Sort manifest items by startFrom (source offset) to map back to original timeline
  const videoItems = manifestItems
    .filter(i => i.type === 'video' || i.type === 'audio')
    .sort((a, b) => (a.data?.startFrom ?? 0) - (b.data?.startFrom ?? 0));

  const shifts: RippleShift[] = [];
  let cumulativeDelta = 0;

  for (const item of videoItems) {
    const sourceStart = item.data?.startFrom ?? 0;
    const sourceDuration = item.endMs - item.startMs;

    // The timeline position this item occupies vs where it was in original
    const expectedTimelineStart = sourceStart + cumulativeDelta;
    const actualTimelineStart = item.startMs;
    const newDelta = actualTimelineStart - expectedTimelineStart;

    if (Math.abs(newDelta) > 10) { // ignore sub-10ms jitter
      cumulativeDelta += newDelta;
      shifts.push({ atMs: sourceStart, deltaMs: cumulativeDelta });
    }
  }

  return shifts;
}

function applyShifts(originalMs: number, shifts: RippleShift[]): number {
  let delta = 0;
  for (const shift of shifts) {
    if (originalMs >= shift.atMs) {
      delta = shift.deltaMs;
    }
  }
  return originalMs + delta;
}

function isWordRemoved(word: Word, manifestItems: ManifestItem[]): boolean {
  // A word is removed if no video/audio item covers its original time range
  const videoItems = manifestItems.filter(i => i.type === 'video' || i.type === 'audio');
  const wordMid = (word.startMs + word.endMs) / 2;

  return !videoItems.some(item => {
    const sourceStart = item.data?.startFrom ?? 0;
    const sourceEnd = sourceStart + (item.endMs - item.startMs);
    return wordMid >= sourceStart && wordMid <= sourceEnd;
  });
}

/**
 * Sync transcript.json with current manifest state.
 * Called automatically after manifest trim/split/remove operations.
 * Reads manifest from disk — no parameters needed.
 */
export async function syncTranscript(): Promise<void> {
  let raw: string;
  try {
    raw = await readFile('/workspace/docs/transcript-original.json', 'utf-8');
  } catch {
    // No original transcript — nothing to sync
    return;
  }

  const original: Transcript = JSON.parse(raw);

  const manifestRaw = await readFile('/workspace/manifest.json', 'utf-8');
  const manifest = JSON.parse(manifestRaw);
  const manifestItems: ManifestItem[] = manifest.items ?? [];

  const shifts = computeRippleShifts(original.words, manifestItems);

  const syncedWords = original.words
    .filter(w => !isWordRemoved(w, manifestItems))
    .map(w => ({
      ...w,
      startMs: Math.max(0, applyShifts(w.startMs, shifts)),
      endMs: Math.max(0, applyShifts(w.endMs, shifts)),
    }));

  const syncedSegments = original.segments
    .map(seg => ({
      ...seg,
      startMs: Math.max(0, applyShifts(seg.startMs, shifts)),
      endMs: Math.max(0, applyShifts(seg.endMs, shifts)),
    }))
    .filter(seg => seg.endMs > seg.startMs);

  const synced: Transcript = {
    words: syncedWords,
    segments: syncedSegments,
    language: original.language,
  };

  await writeFile('/workspace/docs/transcript.json', JSON.stringify(synced, null, 2));
}
