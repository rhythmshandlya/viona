import { addMessage } from '../agent/conversation-store.js';
import { redis } from './redis.js';

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

/**
 * Inserts a pipeline-role conversation message and fans out to the conversation's
 * SSE pub/sub channel so the frontend chat stream picks it up live.
 *
 * @remarks
 * Redis publish is best-effort; the DB row is already committed when publish runs.
 * SSE reconnecting clients should reconcile by re-reading conversation_messages.
 */
export async function insertPipelineMessage(input: PipelineMessageInput): Promise<PipelineMessageRow> {
  const content = [{
    type: 'pipeline_event' as const,
    eventType: input.eventType,
    details: input.details,
    ts: new Date().toISOString(),
  }];

  // addMessage's static role signature is narrow ('user' | 'assistant'); the underlying
  // column is varchar(50) and accepts any string. Cast to pass 'pipeline' through.
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

  // If the arrangement worker successfully persisted timeline items, also emit a
  // composition_updated envelope so the editor refetches its timeline state.
  // Frontend relay happens in agent-router's SSE side-channel.
  if (input.eventType === 'arranged' && (input.details as { ok?: unknown }).ok === true) {
    const compositionEnvelope = JSON.stringify({
      kind: 'composition_updated',
      projectId: input.projectId,
      trigger: 'arranged',
      itemCount: (input.details as { itemCount?: number }).itemCount ?? null,
    });
    await redis.publish(`conversation:${input.projectId}`, compositionEnvelope);
  }

  return row as PipelineMessageRow;
}
