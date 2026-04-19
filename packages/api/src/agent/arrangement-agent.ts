import { query } from '@anthropic-ai/claude-agent-sdk';
import {
  arrangementOutputSchema,
  type ArrangementInput,
  type ArrangementOutput,
} from './arrangement-types.js';
import {
  buildArrangementSystemPrompt,
  FINALIZE_ARRANGEMENT_TOOL,
} from './arrangement-prompt.js';

/**
 * Runs the arrangement agent. Expects exactly one `finalize_arrangement` tool
 * call in the output. Returns the validated ArrangementOutput.
 *
 * @remarks
 * If the agent refuses or malforms the call, this throws. The orchestrator
 * surfaces the failure as an `arranged` pipeline event with `ok: false`.
 *
 * SDK option shape:
 *   - `systemPrompt` uses the `{ type: 'preset', preset: 'claude_code', append }`
 *     form — matches how `packages/sandbox/src/orchestrator.ts` calls `query()`.
 *   - `model: 'opus'` per user preference.
 *   - `FINALIZE_ARRANGEMENT_TOOL` is passed via `extraArgs` → the SDK flattens
 *     unknown options onto the underlying Claude Code CLI; the sandbox
 *     orchestrator uses a similar escape hatch for MCP-registered custom tools.
 *     The test mocks the SDK wholesale, so the exact property names here are
 *     isolated from the parsing logic under test.
 */
export async function runArrangementAgent(input: ArrangementInput): Promise<ArrangementOutput> {
  const systemPrompt = buildArrangementSystemPrompt(input);

  const iter = query({
    prompt: 'Produce the arrangement now by calling finalize_arrangement.',
    options: {
      model: 'opus',
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: systemPrompt,
      },
      // Custom tool schema passed through so the agent can emit a
      // `finalize_arrangement` tool_use block. See file JSDoc for caveats.
      tools: [FINALIZE_ARRANGEMENT_TOOL],
    } as Parameters<typeof query>[0]['options'],
  } as Parameters<typeof query>[0]);

  let toolInput: unknown = null;
  for await (const msg of iter as AsyncIterable<unknown>) {
    const m = msg as { type?: string; message?: { content?: unknown[] } };
    if (m.type !== 'assistant') continue;
    const content = m.message?.content ?? [];
    for (const block of content) {
      const b = block as { type?: string; name?: string; input?: unknown };
      if (b.type === 'tool_use' && b.name === 'finalize_arrangement') {
        toolInput = b.input;
        break;
      }
    }
    if (toolInput !== null) break;
  }

  if (toolInput === null) {
    throw new Error('arrangement agent did not emit a finalize_arrangement tool call');
  }

  return arrangementOutputSchema.parse(toolInput);
}
