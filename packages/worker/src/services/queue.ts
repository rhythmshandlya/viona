import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis.js';

// Worker-side producers. Normally producers live in the API, but the
// asset-metadata processor (Task 8) enqueues a follow-up `transcribe` job
// for audio/video assets, so we need a small producer here too.
//
// The `transcribe` queue is the SAME queue the worker consumes in
// `processors/transcribe.ts`. Task 9 will update the transcribe processor
// to branch on `data.mode` ('project' | 'asset') to handle asset-mode
// payloads. Until then, the existing processor only understands the
// project-mode shape.

export interface TranscribeAssetJobData {
  mode: 'asset';
  assetId: string;
  userId: string;
  storageKey: string;
}

const transcribeQueue = new Queue('transcribe', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Enqueues a transcribe job in asset mode (new pipeline, Task 8+).
 * TODO(Task 9): extend the transcribe processor to branch on data.mode.
 */
export async function queueTranscribeJob(data: TranscribeAssetJobData): Promise<void> {
  await transcribeQueue.add('transcribe', data, { attempts: 1 });
}
