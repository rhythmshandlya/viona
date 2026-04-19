import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis.js';
import type { TranscribeJobData } from '../processors/transcribe.js';

// Worker-side producers. Normally producers live in the API, but the
// asset-metadata processor (Task 8) enqueues a follow-up `transcribe` job
// for audio/video assets, so we need a small producer here too.
//
// The `transcribe` queue is the SAME queue the worker consumes in
// `processors/transcribe.ts`. Since Task 9 the `TranscribeJobData` type is a
// discriminated union with `mode: 'project' | 'asset'` — the processor
// branches on `data.mode`. This helper can enqueue either variant.

const transcribeQueue = new Queue('transcribe', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Enqueues a transcribe job. `data.mode` determines the processor branch:
 *   - 'project' — legacy flow (projects table, jobs table, subtitles pipeline)
 *   - 'asset' — asset pipeline (derived transcript.json, parent asset update)
 */
export async function queueTranscribeJob(data: TranscribeJobData): Promise<void> {
  await transcribeQueue.add('transcribe', data, { attempts: 1 });
}

// Arrangement queue — the worker's transcribe processor (Task 12) auto-triggers
// a first-pass arrangement for a project once all of its linked assets finish
// transcribing. This is the same `arrangement` queue the API enqueues onto in
// packages/api/src/services/queue.ts; either side can push, the worker consumes.
export interface ArrangementJobData {
  projectId: string;
}

const arrangementQueue = new Queue<ArrangementJobData>('arrangement', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  },
});

export async function queueArrangementJob(data: ArrangementJobData): Promise<void> {
  await arrangementQueue.add('arrangement', data, { attempts: 2 });
}
