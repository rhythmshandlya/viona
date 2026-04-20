import { buildArrangementInput } from './arrangement-input-builder.js';
import { runArrangementAgent } from '../agent/arrangement-agent.js';
import { persistArrangement } from './arrangement-persister.js';
import { insertPipelineMessage } from './pipeline-messages.js';
import { getOrCreateConversation, addMessage } from '../agent/conversation-store.js';
import { redis } from './redis.js';
import type { ArrangementOutput } from '../agent/arrangement-types.js';

// Mirror of `packages/api/src/services/arrangement-orchestrator.ts`. The
// BullMQ `arrangement` processor (Task 11) calls this when the async path
// fires. Kept in lockstep with the API so both paths produce identical
// behavior: same pipeline events, same persistence, same assistant summary.

/**
 * Computes + persists a first-pass timeline arrangement for the given project.
 *
 * Lifecycle:
 *   1. Resolve the project's conversation.
 *   2. Emit a `pipeline: arranging` message.
 *   3. Build input (prompt + assets + transcripts) from DB + MinIO.
 *   4. Run the arrangement agent (Claude).
 *   5. Persist the output to `tracks` + `timelineItems`.
 *   6. Emit a `pipeline: arranged` message with `ok: true` + `itemCount`.
 *   7. Post the agent's `summary` as an assistant message in the chat.
 *
 * On any failure: emit `pipeline: arranged` with `ok: false` + error text,
 * then rethrow so the BullMQ worker can apply its retry policy.
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
  } finally {
    // Prod blocker 2: release the SETNX idempotency lock acquired by
    // `enqueueArrangementIfReady` in transcribe.ts. Runs on both the success
    // and failure paths so a failed arrangement doesn't block retries for
    // 5 minutes. If the lock wasn't acquired here (e.g. manual endpoint or
    // direct invocation), `del` is a no-op — safe to call unconditionally.
    await redis.del(`arrangement:in-flight:${projectId}`).catch(() => { /* swallow */ });
  }
}
