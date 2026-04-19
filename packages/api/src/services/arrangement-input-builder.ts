import { inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { assets } from '../db/schema.js';
import { listProjectAssets } from './asset-link-service.js';
import { fetchTranscriptJson, type TranscriptJson } from './transcript-fetch.js';
import { getOrCreateConversation, getConversationMessages } from '../agent/conversation-store.js';
import type { ArrangementInput } from '../agent/arrangement-types.js';

/**
 * Gathers everything the arrangement agent needs for a project:
 *   - The create-time prompt (first `user` message with a `text` block)
 *   - All linked assets (minimal metadata)
 *   - Transcripts for assets with a `transcriptAssetId` (fetched from MinIO)
 *
 * Forward-compatible sockets (visualAnalyses, sceneBoundaries, etc.) are
 * populated only if their workers have run; always undefined today.
 *
 * @remarks
 * If a transcript fails to fetch (missing key, parse error, etc.) it is silently
 * skipped. The agent will arrange without it rather than failing the whole job.
 */
export async function buildArrangementInput(projectId: string): Promise<ArrangementInput> {
  const convo = await getOrCreateConversation(projectId);
  const messages = await getConversationMessages(convo.id);
  const firstUserMsg = messages.find((m) => m.role === 'user');
  const prompt = extractPromptText(firstUserMsg?.content) ?? '';

  const rows = await listProjectAssets(projectId);

  const assetSummaries: ArrangementInput['assets'] = rows.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    durationMs: a.durationMs ?? undefined,
    userIntent: a.userIntent ?? undefined,
    userDescription: a.userDescription ?? undefined,
  }));

  const transcriptAssetIds = rows
    .map((a) => a.transcriptAssetId)
    .filter((id): id is string => !!id);

  const transcripts: ArrangementInput['transcripts'] = [];
  if (transcriptAssetIds.length > 0) {
    const derivedRows = await db
      .select({
        id: assets.id,
        storageKey: assets.storageKey,
        parentAssetIds: assets.parentAssetIds,
      })
      .from(assets)
      .where(inArray(assets.id, transcriptAssetIds));

    for (const derived of derivedRows) {
      const parent = rows.find((a) => a.transcriptAssetId === derived.id);
      if (!parent) continue;
      try {
        const json = await fetchTranscriptJson(derived.storageKey);
        transcripts.push({
          assetId: parent.id,
          text: json.text,
          segments: normalizeSegments(json.segments),
        });
      } catch {
        // Missing or unreadable transcript: skip.
        continue;
      }
    }
  }

  return { prompt, assets: assetSummaries, transcripts };
}

function extractPromptText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
      const text = (block as { text?: string }).text;
      if (text && text.length > 0) return text;
    }
  }
  return null;
}

function normalizeSegments(
  segments?: TranscriptJson['segments'],
): ArrangementInput['transcripts'][number]['segments'] {
  if (!segments) return [];
  return segments.map((s) => {
    const startMs = s.startMs ?? (typeof s.start === 'number' ? Math.round(s.start * 1000) : 0);
    const endMs = s.endMs ?? (typeof s.end === 'number' ? Math.round(s.end * 1000) : startMs);
    return { startMs, endMs, text: s.text ?? '' };
  });
}
