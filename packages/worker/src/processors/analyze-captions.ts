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
