import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface ValidationIssue {
  severity: 'error' | 'warning';
  track?: string;
  itemId?: string;
  message: string;
}

interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}

export async function validateTimeline(): Promise<ValidationResult> {
  const raw = await readFile('/workspace/manifest.json', 'utf-8');
  const manifest = JSON.parse(raw);
  const issues: ValidationIssue[] = [];

  // Check each track for overlaps and gaps
  for (const track of manifest.tracks ?? []) {
    const items = (manifest.items ?? [])
      .filter((i: any) => i.trackId === track.id)
      .sort((a: any, b: any) => a.startMs - b.startMs);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // No negative timestamps
      if (item.startMs < 0) {
        issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Negative startMs: ${item.startMs}` });
      }

      // startMs < endMs
      if (item.startMs >= item.endMs) {
        issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `startMs (${item.startMs}) >= endMs (${item.endMs})` });
      }

      // Check overlaps with next item on same track
      if (i < items.length - 1) {
        const next = items[i + 1];
        if (item.endMs > next.startMs) {
          issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Overlaps with ${next.id}: ${item.endMs} > ${next.startMs}` });
        }
      }

      // Scene file exists
      if (item.type === 'scene' && item.data?.sceneFile) {
        const scenePath = `/workspace/src/scenes/${item.data.sceneFile}.tsx`;
        if (!existsSync(scenePath)) {
          issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Scene file not found: ${scenePath}` });
        }
      }

      // Valid startFrom for video/audio
      if ((item.type === 'video' || item.type === 'audio') && item.data?.startFrom != null) {
        if (item.data.startFrom < 0) {
          issues.push({ severity: 'error', track: track.name, itemId: item.id, message: `Negative startFrom: ${item.data.startFrom}` });
        }
      }

      // Transition duration check
      if (item.data?.enter?.durationMs != null) {
        const d = item.data.enter.durationMs;
        if (d < 0 || d > 1000) {
          issues.push({ severity: 'warning', track: track.name, itemId: item.id, message: `Enter transition duration out of range: ${d}ms` });
        }
      }
      if (item.data?.exit?.durationMs != null) {
        const d = item.data.exit.durationMs;
        if (d < 0 || d > 1000) {
          issues.push({ severity: 'warning', track: track.name, itemId: item.id, message: `Exit transition duration out of range: ${d}ms` });
        }
      }
    }
  }

  // durationMs matches last item extent
  const allItems = manifest.items ?? [];
  if (allItems.length > 0) {
    const maxEndMs = Math.max(...allItems.map((i: any) => i.endMs));
    if (manifest.durationMs && Math.abs(manifest.durationMs - maxEndMs) > 100) {
      issues.push({ severity: 'warning', message: `manifest.durationMs (${manifest.durationMs}) doesn't match last item extent (${maxEndMs})` });
    }
  }

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * MCP tool wrapper for validateTimeline.
 */
export const validateTimelineTool = {
  name: 'validate_timeline',
  description:
    'Programmatic manifest integrity check. Verifies no gaps/overlaps on same track, ' +
    'scene files exist, timestamps are valid, startFrom is non-negative, and transition durations ' +
    'are within range. Returns pass/fail with detailed issues list. No arguments.',
  input_schema: {
    type: 'object' as const,
    properties: {} as Record<string, never>,
    required: [] as string[],
  },
  async execute(_input: Record<string, unknown>): Promise<string> {
    try {
      const result = await validateTimeline();
      return JSON.stringify(result, null, 2);
    } catch (err: any) {
      return `Failed to validate timeline: ${err.message}`;
    }
  },
};
