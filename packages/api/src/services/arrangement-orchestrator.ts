import { buildArrangementInput } from './arrangement-input-builder.js';
import { runArrangementAgent } from '../agent/arrangement-agent.js';
import { persistArrangement } from './arrangement-persister.js';
import { insertPipelineMessage } from './pipeline-messages.js';
import { getOrCreateConversation, addMessage } from '../agent/conversation-store.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

/**
 * Computes + persists a first-pass timeline arrangement for the given project.
 *
 * Lifecycle:
 *   1. Resolve the project's conversation.
 *   2. Emit a `pipeline: arranging` message.
 *   3. Build input (prompt + assets + transcripts) from DB + MinIO.
 *   4. Run the arrangement agent (Claude Opus).
 *   5. Persist the output to `tracks` + `timelineItems`.
 *   6. Emit a `pipeline: arranged` message with `ok: true` + `itemCount`.
 *   7. Post the agent's `summary` as an assistant message in the chat.
 *
 * On any failure: emit `pipeline: arranged` with `ok: false` + error text,
 * then rethrow so the caller (endpoint or worker) can report the failure.
 */
export async function computeArrangement(projectId: string): Promise<ArrangementOutput> {
  const convo = await getOrCreateConversation(projectId);

  await insertPipelineMessage({
    conversationId: convo.id,
    projectId,
    eventType: 'arranging',
    details: {},
  });

  try {
    const input = await buildArrangementInput(projectId);
    const output = await runArrangementAgent(input);
    await persistArrangement(projectId, output);

    await insertPipelineMessage({
      conversationId: convo.id,
      projectId,
      eventType: 'arranged',
      details: { ok: true, itemCount: output.timelineItems.length },
    });

    await addMessage(convo.id, 'assistant', [
      { type: 'text', text: output.summary },
    ]);

    return output;
  } catch (err) {
    await insertPipelineMessage({
      conversationId: convo.id,
      projectId,
      eventType: 'arranged',
      details: { ok: false, error: (err as Error).message },
    });
    throw err;
  }
}
