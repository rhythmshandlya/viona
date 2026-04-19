import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, assets } from '../db/index.js';
import { emitAssetEvent } from '../services/asset-events.js';
import { runFfprobe, runFfmpegThumbnail, runFfmpegWaveform } from '../services/media.js';
import { downloadToTmp, uploadFile } from '../services/asset-storage.js';
import { queueTranscribeJob } from '../services/queue.js';

export interface AssetMetadataJobData {
  assetId: string;
}

function isVideo(mime: string): boolean { return mime.startsWith('video/'); }
function isAudio(mime: string): boolean { return mime.startsWith('audio/'); }
function isImage(mime: string): boolean { return mime.startsWith('image/'); }

/**
 * Processes an `asset-metadata` job:
 *  1. Looks up the asset row.
 *  2. Downloads the source to a tmp path.
 *  3. Probes with ffprobe for duration/width/height/audio.
 *  4. Generates a thumbnail (video/image) + waveform (video/audio).
 *  5. Updates the asset row with metadata and derived keys.
 *  6. Emits a `metadata_ready` event.
 *  7. Enqueues `transcribe` for audio/video assets.
 *
 * On any failure after the row lookup, emits a `failed` event and rethrows so
 * BullMQ can apply its retry policy.
 */
export async function processAssetMetadataJob(job: Job<AssetMetadataJobData>): Promise<void> {
  const { assetId } = job.data;

  const rows = await db.select().from(assets).where(eq(assets.id, assetId));
  const asset = rows[0] as typeof assets.$inferSelect | undefined;
  if (!asset) {
    throw new Error(`asset not found: ${assetId}`);
  }

  try {
    const localPath = await downloadToTmp(asset.storageKey);
    const probe = await runFfprobe(localPath);

    const derivedPrefix = `users/${asset.userId}/derived/${asset.sha256}`;
    let thumbnailKey: string | null = null;
    let waveformKey: string | null = null;

    if (isVideo(asset.mimeType) || isImage(asset.mimeType)) {
      const thumbBuf = await runFfmpegThumbnail(localPath, isVideo(asset.mimeType));
      thumbnailKey = await uploadFile(`${derivedPrefix}/thumbnail.jpg`, thumbBuf, 'image/jpeg');
    }
    if (isVideo(asset.mimeType) || isAudio(asset.mimeType)) {
      const waveBuf = await runFfmpegWaveform(localPath);
      waveformKey = await uploadFile(`${derivedPrefix}/waveform.png`, waveBuf, 'image/png');
    }

    const needsTranscribe = isVideo(asset.mimeType) || isAudio(asset.mimeType);

    await db.update(assets).set({
      durationMs: probe.durationMs,
      width: probe.width,
      height: probe.height,
      thumbnailKey,
      waveformKey,
      thumbnailStatus: thumbnailKey ? 'ready' : 'not_applicable',
      waveformStatus: waveformKey ? 'ready' : 'not_applicable',
      transcriptStatus: needsTranscribe ? 'pending' : 'not_applicable',
      updatedAt: new Date(),
    }).where(eq(assets.id, assetId));

    await emitAssetEvent({
      assetId,
      userId: asset.userId,
      projectId: null,
      type: 'metadata_ready',
      payload: {
        durationMs: probe.durationMs,
        width: probe.width,
        height: probe.height,
        thumbnailKey,
        waveformKey,
      },
    });

    if (needsTranscribe) {
      await queueTranscribeJob({
        mode: 'asset',
        assetId,
        userId: asset.userId,
        storageKey: asset.storageKey,
      });
    }
  } catch (err) {
    await emitAssetEvent({
      assetId,
      userId: asset.userId,
      projectId: null,
      type: 'failed',
      payload: { stage: 'metadata', message: (err as Error).message },
    });
    throw err;
  }
}
