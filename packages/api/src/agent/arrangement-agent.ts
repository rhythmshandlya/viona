import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import {
  arrangementOutputSchema,
  type ArrangementInput,
  type ArrangementOutput,
} from './arrangement-types.js';
import {
  buildArrangementSystemPrompt,
  FINALIZE_ARRANGEMENT_TOOL,
} from './arrangement-prompt.js';

const client = new Anthropic();  // reads ANTHROPIC_API_KEY from env

/**
 * Runs the arrangement agent as a single-turn tool-use call. Expects exactly one
 * `finalize_arrangement` tool_use block in the response. Returns the validated
 * ArrangementOutput.
 *
 * @remarks
 * Uses @anthropic-ai/sdk directly rather than @anthropic-ai/claude-agent-sdk because
 * the Agent SDK's `tools` option restricts built-in Claude Code tool names (string[]),
 * not custom JSON-schema tools. This is a single-turn agent; the full Agent SDK
 * machinery (subagents, permissions, hooks) is overkill.
 */
export async function runArrangementAgent(input: ArrangementInput): Promise<ArrangementOutput> {
  const systemPrompt = buildArrangementSystemPrompt(input);

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 4096,
    system: systemPrompt,
    tools: [{
      name: FINALIZE_ARRANGEMENT_TOOL.name,
      description: FINALIZE_ARRANGEMENT_TOOL.description,
      input_schema: FINALIZE_ARRANGEMENT_TOOL.input_schema as unknown as Anthropic.Tool.InputSchema,
    }],
    tool_choice: { type: 'tool', name: FINALIZE_ARRANGEMENT_TOOL.name },
    messages: [{
      role: 'user',
      content: 'Produce the arrangement now by calling finalize_arrangement.',
    }],
  });

  let toolInput: unknown = null;
  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === FINALIZE_ARRANGEMENT_TOOL.name) {
      toolInput = block.input;
      break;
    }
  }

  if (toolInput === null) {
    throw new Error('arrangement agent did not emit a finalize_arrangement tool call');
  }

  return arrangementOutputSchema.parse(toolInput);
}
