import type { Job } from 'bullmq';
import { computeArrangement } from '../services/arrangement-orchestrator.js';

// BullMQ processor for the `arrangement` queue. Delegates to the worker-side
// mirror of `computeArrangement` — see `services/arrangement-orchestrator.ts`.
// Thin by design: BullMQ owns retries, logging, and stall handling; the
// orchestrator owns the business logic.

export interface ArrangementJobData {
  projectId: string;
}

export async function processArrangementJob(job: Job<ArrangementJobData>): Promise<void> {
  await computeArrangement(job.data.projectId);
}
