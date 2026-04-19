import type { ArrangementInput } from './arrangement-types.js';

export const FINALIZE_ARRANGEMENT_TOOL = {
  name: 'finalize_arrangement',
  description:
    'Commit the final timeline arrangement for this project. Call this exactly once at the end. ' +
    'timelineItems must be chronological per track (no overlaps within a track). Tracks are indexed from 0. ' +
    'Each item references an asset by its id from the input list.',
  input_schema: {
    type: 'object' as const,
    properties: {
      timelineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            trackIndex: { type: 'integer', minimum: 0 },
            startMs: { type: 'integer', minimum: 0 },
            durationMs: { type: 'integer', minimum: 1 },
            sourceStartMs: { type: 'integer', minimum: 0 },
            sourceDurationMs: { type: 'integer', minimum: 1 },
          },
          required: ['assetId', 'trackIndex', 'startMs', 'durationMs'],
        },
      },
      summary: {
        type: 'string',
        description: 'A short (1–3 sentence) human-readable explanation of the arrangement.',
      },
    },
    required: ['timelineItems', 'summary'],
  },
} as const;

export function buildArrangementSystemPrompt(input: ArrangementInput): string {
  const lines: string[] = [];
  lines.push(
    'You are the Arrangement Agent for an AI-first video editor. Your job: take the user\'s prompt,',
    'the uploaded assets, and any analysis signals, and produce a first-pass timeline arrangement.',
    '',
    'Output by calling the `finalize_arrangement` tool EXACTLY ONCE. Do not explain in text;',
    'only the tool call is read.',
    '',
    '### User prompt',
    input.prompt && input.prompt.length > 0
      ? input.prompt
      : '(empty — infer a reasonable short-form edit from the assets)',
    '',
    '### Assets',
  );
  for (const a of input.assets) {
    const dur = a.durationMs != null ? ` (${Math.round(a.durationMs / 1000)}s)` : '';
    const intent = a.userIntent ? ` [intent: ${a.userIntent}]` : '';
    const desc = a.userDescription ? ` [desc: ${a.userDescription}]` : '';
    lines.push(`- ${a.id} :: ${a.filename} (${a.mimeType})${dur}${intent}${desc}`);
  }

  if (input.transcripts.length > 0) {
    lines.push('', '### Transcripts');
    for (const t of input.transcripts) {
      lines.push(`- ${t.assetId}: "${truncate(t.text, 400)}"`);
      if (t.segments.length > 0) {
        lines.push(`  (${t.segments.length} segments)`);
      }
    }
  }

  if (input.visualAnalyses && input.visualAnalyses.length > 0) {
    lines.push('', '### Visual analyses (visualAnalyses available)');
    for (const v of input.visualAnalyses) {
      lines.push(`- ${v.assetId}: labels=${(v.labels ?? []).join(',')}`);
    }
  }
  if (input.sceneBoundaries && input.sceneBoundaries.length > 0) {
    lines.push('', '### Scene boundaries (sceneBoundaries available)');
    for (const s of input.sceneBoundaries) {
      lines.push(`- ${s.assetId}: cuts at ms ${s.cuts.join(',')}`);
    }
  }
  if (input.speakerDiarization && input.speakerDiarization.length > 0) {
    lines.push('', '### Speaker diarization (speakerDiarization available)');
  }
  if (input.highlights && input.highlights.length > 0) {
    lines.push('', '### Highlight scores (highlights available)');
  }
  if (input.autoDescriptions && input.autoDescriptions.length > 0) {
    lines.push('', '### Auto descriptions (autoDescriptions available)');
    for (const d of input.autoDescriptions) {
      lines.push(`- ${d.assetId}: ${truncate(d.description, 200)}`);
    }
  }

  lines.push(
    '',
    '### Rules',
    '- Only reference assetIds present in the asset list above.',
    '- Items on the same track must not overlap: `startMs + durationMs` of item N <= `startMs` of item N+1.',
    '- Prefer track 0 for the primary visual, track 1 for overlays / b-roll.',
    '- If transcripts exist, use them to decide ordering and trim points via sourceStartMs / sourceDurationMs.',
    '- Keep the arrangement short — 15s–90s total is a good default for a first pass.',
  );

  return lines.join('\n');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
