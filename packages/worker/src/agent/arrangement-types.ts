import { z } from 'zod';

// Mirror of `packages/api/src/agent/arrangement-types.ts`. Kept in sync so the
// worker-side orchestrator can validate agent output identically to the API.

export interface ArrangementInput {
  prompt: string;
  assets: {
    id: string;
    filename: string;
    mimeType: string;
    durationMs?: number;
    userIntent?: string;
    userDescription?: string;
  }[];
  transcripts: {
    assetId: string;
    text: string;
    segments: { startMs: number; endMs: number; text: string }[];
  }[];

  // Forward-compatible sockets — empty today, populated by future workers.
  visualAnalyses?: { assetId: string; embedding?: number[]; labels?: string[] }[];
  sceneBoundaries?: { assetId: string; cuts: number[] }[];
  speakerDiarization?: {
    assetId: string;
    segments: { speakerId: string; startMs: number; endMs: number }[];
  }[];
  highlights?: {
    assetId: string;
    scores: { startMs: number; endMs: number; score: number }[];
  }[];
  autoDescriptions?: { assetId: string; description: string }[];
}

export const arrangementOutputSchema = z.object({
  timelineItems: z.array(z.object({
    assetId: z.string().min(1),
    trackIndex: z.number().int().nonnegative(),
    startMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    sourceStartMs: z.number().int().nonnegative().optional(),
    sourceDurationMs: z.number().int().positive().optional(),
  })),
  summary: z.string().min(1),
});

export type ArrangementOutput = z.infer<typeof arrangementOutputSchema>;
