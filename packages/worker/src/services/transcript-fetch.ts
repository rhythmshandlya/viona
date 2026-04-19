import type { Readable } from 'node:stream';
import { minioClient } from './minio.js';
import { config } from '../config.js';

// Mirror of `packages/api/src/services/transcript-fetch.ts`. Streams a
// transcript JSON from MinIO and parses it. Used by the arrangement input
// builder to attach transcript data for each asset.

export interface TranscriptJson {
  text: string;
  segments?: {
    start?: number;      // seconds (Whisper default)
    end?: number;
    startMs?: number;    // ms (normalized variant)
    endMs?: number;
    text: string;
  }[];
  words?: { start?: number; end?: number; word: string }[];
  language?: string;
}

/**
 * Streams a transcript JSON file from MinIO and parses it.
 *
 * @param storageKey Full S3 key (e.g. `users/{userId}/derived/{assetId}/transcript.json`).
 */
export async function fetchTranscriptJson(storageKey: string): Promise<TranscriptJson> {
  const stream = (await minioClient.getObject(config.minio.bucket, storageKey)) as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text) as TranscriptJson;
}
