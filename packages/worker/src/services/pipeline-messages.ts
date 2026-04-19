import { addMessage } from '../agent/conversation-store.js';
import { redis } from './redis.js';

// Mirror of `packages/api/src/services/pipeline-messages.ts`. The worker emits
// `arranging` / `arranged` pipeline events when the `arrangement` queue fires
// (Task 11) — these land as pipeline-role conversation messages + a Redis
// publish so the frontend chat stream picks them up live.

export type PipelineEventType =
  | 'transcribing'
  | 'transcribed'
  | 'analyzing'
  | 'analyzed'
  | 'arranging'
  | 'arranged'
  | 'ready';

export interface PipelineMessageInput {
  conversationId: string;
  projectId: string;
  eventType: PipelineEventType;
  details: Record<string, unknown>;
}

export interface PipelineMessageRow {
  id: string;
  conversationId: string;
  role: string;
  content?: unknown;
}

export async function insertPipelineMessage(input: PipelineMessageInput): Promise<PipelineMessageRow> {
  const content = [{
    type: 'pipeline_event' as const,
    eventType: input.eventType,
    details: input.details,
    ts: new Date().toISOString(),
  }];

  // addMessage's static role signature is narrow ('user' | 'assistant'); the
  // underlying column is varchar(50) and accepts any string. Cast to pass
  // 'pipeline' through, matching the API-side mirror.
  const row = await addMessage(
    input.conversationId,
    'pipeline' as unknown as 'user' | 'assistant',
    content,
  );

  const envelope = JSON.stringify({
    kind: 'pipeline_message',
    messageId: row.id,
    conversationId: row.conversationId,
    eventType: input.eventType,
    details: input.details,
  });
  await redis.publish(`conversation:${input.projectId}`, envelope);

  return row as PipelineMessageRow;
}
