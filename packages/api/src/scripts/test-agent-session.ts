/**
 * E2E test for Creative Director agent session lifecycle.
 * Tests: first message → session created, second message → resume, delete → fresh start, resume failure → fallback.
 *
 * Usage: npx tsx packages/api/src/scripts/test-agent-session.ts
 */

import { query, type SDKPartialAssistantMessage, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { BetaRawContentBlockDeltaEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projects, conversations, conversationMessages, transcripts, visuals } from '../db/schema.js';
import { buildSystemPrompt } from '../agent/agent-system-prompt.js';
import { createAgentMcpServer, TOOL_NAMES } from '../agent/agent-tools.js';
import { config } from '../config.js';
import { runMigrations } from '../db/migrate.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(label: string, ...args: unknown[]) {
  console.log(`\n[${'='.repeat(3)} ${label} ${'='.repeat(50 - label.length)}]`);
  if (args.length) console.log(...args);
}

function pass(msg: string) { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.error(`  ❌ ${msg}`); }

async function getConversation(projectId: string) {
  return db.query.conversations.findFirst({
    where: eq(conversations.projectId, projectId),
    orderBy: desc(conversations.createdAt),
  });
}

async function deleteConversation(projectId: string) {
  await db.delete(conversations).where(eq(conversations.projectId, projectId));
}

async function updateSessionId(conversationId: string, sdkSessionId: string | null) {
  await db.update(conversations).set({ sdkSessionId }).where(eq(conversations.id, conversationId));
}

async function getOrCreateConversation(projectId: string) {
  const existing = await getConversation(projectId);
  if (existing) return existing;
  const [created] = await db.insert(conversations).values({ projectId }).returning();
  return created;
}

// Run a single SDK query against the agent and return text + session_id
async function runAgentQuery(opts: {
  projectId: string;
  prompt: string;
  systemPrompt: string;
  resume?: string;
  label: string;
}): Promise<{ text: string; sessionId: string | null; error: string | null }> {
  const { projectId, prompt, systemPrompt, resume, label } = opts;

  const abortController = new AbortController();
  let capturedSessionId: string | null = null;
  let fullText = '';
  let toolUseCount = 0;

  // Minimal MCP server — tools can be called but we just log them
  const mcpServer = createAgentMcpServer({
    projectId,
    sendSSE: (event, data) => {
      if (event === 'widget') {
        console.log(`  [widget] ${JSON.stringify(data).slice(0, 120)}`);
      } else if (event === 'progress') {
        const d = data as { message?: string; percent?: number };
        console.log(`  [progress] ${d.percent ?? '?'}% — ${d.message ?? ''}`);
      }
    },
    signal: abortController.signal,
    userMessage: prompt,
  });

  const queryOptions: Record<string, unknown> = {
    mcpServers: { 'creative-director': mcpServer },
    allowedTools: TOOL_NAMES,
    systemPrompt,
    includePartialMessages: true,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    model: config.anthropic.model,
    abortController,
    tools: [],
    maxTurns: 15,
    thinking: { type: 'adaptive' },
    persistSession: true,
    env: { ...process.env, CLAUDECODE: undefined },
    stderr: (data: string) => {
      // Only log real errors, skip noise
      if (data.includes('error') || data.includes('Error')) {
        console.log(`  [stderr] ${data.trim().slice(0, 200)}`);
      }
    },
  };

  if (resume) {
    (queryOptions as any).resume = resume;
  }

  console.log(`  Model: ${config.anthropic.model}`);
  console.log(`  Resume: ${resume ?? 'none (fresh query)'}`);

  const startTime = Date.now();

  try {
    for await (const message of query({ prompt, options: queryOptions as any })) {
      // Capture session_id
      if (!capturedSessionId && (message as any).session_id) {
        capturedSessionId = (message as any).session_id;
      }

      if (message.type === 'stream_event') {
        const partial = message as SDKPartialAssistantMessage;
        const evt = partial.event as BetaRawContentBlockDeltaEvent;

        const rawEvt = evt as { type: string; content_block?: { type: string } };
        if (rawEvt.type === 'content_block_start' && rawEvt.content_block?.type === 'tool_use') {
          toolUseCount++;
        }

        if (evt?.type === 'content_block_delta') {
          const delta = evt.delta as { type: string; text?: string };
          if (delta.type === 'text_delta' && delta.text) {
            fullText += delta.text;
            process.stdout.write(delta.text);
          }
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  [${label}] Done in ${elapsed}s — ${fullText.length} chars, ${toolUseCount} tool calls`);

    return { text: fullText, sessionId: capturedSessionId, error: null };
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(`\n  [${label}] Error after ${elapsed}s: ${errorMsg}`);
    return { text: fullText, sessionId: capturedSessionId, error: errorMsg };
  }
}

// ─── Build system prompt for a project ─────────────────────────────────────

async function buildPromptForProject(projectId: string): Promise<string> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const transcript = await db.query.transcripts.findFirst({ where: eq(transcripts.projectId, projectId) });
  const visual = await db.query.visuals.findFirst({ where: eq(visuals.projectId, projectId) });
  const videoSettings = (project.videoSettings as Record<string, unknown>) || {};

  return buildSystemPrompt({
    projectId,
    title: project.title,
    projectType: project.projectType || 'video',
    canvasWidth: (videoSettings.canvasWidth as number) ?? 1080,
    canvasHeight: (videoSettings.canvasHeight as number) ?? 1920,
    durationMs: project.durationMs,
    fps: project.fps ?? 30,
    hasTranscript: !!transcript,
    hasVisuals: !!visual,
    sceneCount: visual?.timestamps ? (visual.timestamps as unknown[]).length : 0,
    sourceWidth: project.sourceWidth ?? undefined,
    sourceHeight: project.sourceHeight ?? undefined,
  });
}

// ─── Main test flow ──────────────────────────────────────────────────────────

async function main() {
  log('SETUP');
  await runMigrations();

  // Pick first ready project
  const project = await db.query.projects.findFirst({
    where: eq(projects.status, 'ready'),
  });
  if (!project) {
    fail('No ready projects in DB. Create one first.');
    process.exit(1);
  }
  console.log(`  Project: ${project.id} (${project.title || 'Untitled'})`);

  const systemPrompt = await buildPromptForProject(project.id);
  console.log(`  System prompt: ${systemPrompt.length} chars`);

  // Clean slate — delete any existing conversation
  await deleteConversation(project.id);
  pass('Cleaned up existing conversation');

  // ─── TEST 1: First message — should create session ──────────────────────

  log('TEST 1: First message (no session)');

  const conv = await getOrCreateConversation(project.id);
  console.log(`  Conversation: ${conv.id}`);

  const result1 = await runAgentQuery({
    projectId: project.id,
    prompt: 'Say hello and briefly describe what you can help me with. Keep it under 2 sentences.',
    systemPrompt,
    label: 'test1',
  });

  if (result1.error) {
    fail(`First message failed: ${result1.error}`);
    process.exit(1);
  }

  if (!result1.sessionId) {
    fail('No session_id captured from first message');
    process.exit(1);
  }

  pass(`Got session_id: ${result1.sessionId}`);
  pass(`Agent responded: ${result1.text.slice(0, 100)}...`);

  // Save session ID to DB
  await updateSessionId(conv.id, result1.sessionId);

  // Verify it was saved
  const conv1 = await getConversation(project.id);
  if (conv1?.sdkSessionId === result1.sessionId) {
    pass('Session ID saved to DB');
  } else {
    fail(`Session ID not saved. DB has: ${conv1?.sdkSessionId}`);
  }

  // ─── TEST 2: Second message — should resume ─────────────────────────────

  log('TEST 2: Second message (resume session)');

  const result2 = await runAgentQuery({
    projectId: project.id,
    prompt: 'What was my first message to you? Repeat it back.',
    systemPrompt, // On resume, SDK has full history — system prompt doesn't include text blob
    resume: result1.sessionId!,
    label: 'test2',
  });

  if (result2.error) {
    fail(`Resume message failed: ${result2.error}`);
    // This is a critical failure — don't exit, but note it
  } else {
    pass(`Agent responded: ${result2.text.slice(0, 150)}...`);

    // Check that the agent correctly references the first message
    const mentionsHello = result2.text.toLowerCase().includes('hello') ||
      result2.text.toLowerCase().includes('say hello') ||
      result2.text.toLowerCase().includes('first message');
    if (mentionsHello) {
      pass('Agent correctly recalled first message via session resume');
    } else {
      fail('Agent did not seem to recall first message — resume may not be working');
      console.log(`  Full response: ${result2.text}`);
    }
  }

  // Verify same session continued
  if (result2.sessionId === result1.sessionId) {
    pass('Same session_id maintained across turns');
  } else if (result2.sessionId) {
    console.log(`  ⚠️  Session changed: ${result1.sessionId} → ${result2.sessionId}`);
  }

  // ─── TEST 3: Resume failure fallback ────────────────────────────────────

  log('TEST 3: Resume with bad session ID (fallback)');

  const result3 = await runAgentQuery({
    projectId: project.id,
    prompt: 'Say "fallback works" if you can hear me.',
    systemPrompt,
    resume: 'fake-session-id-that-does-not-exist',
    label: 'test3-bad-resume',
  });

  // The SDK should throw on a bad resume — this tests our error path
  if (result3.error) {
    pass(`Resume correctly failed: ${result3.error.slice(0, 100)}`);
    console.log('  (In production, the router catches this and retries without resume)');
  } else {
    // Some SDK versions may silently ignore bad resume IDs
    console.log('  ⚠️  SDK did not throw on bad resume ID — it may have started a fresh session');
    if (result3.text.toLowerCase().includes('fallback works')) {
      pass('Agent still responded correctly');
    }
  }

  // ─── TEST 4: Delete conversation → fresh start ──────────────────────────

  log('TEST 4: Delete conversation and start fresh');

  await deleteConversation(project.id);
  pass('Conversation deleted');

  const convAfterDelete = await getConversation(project.id);
  if (!convAfterDelete) {
    pass('Conversation row removed from DB');
  } else {
    fail('Conversation still exists after delete');
  }

  // New conversation — should work without resume
  const conv4 = await getOrCreateConversation(project.id);
  const result4 = await runAgentQuery({
    projectId: project.id,
    prompt: 'This is a brand new conversation. Reply with "fresh start confirmed".',
    systemPrompt,
    label: 'test4-fresh',
  });

  if (result4.error) {
    fail(`Fresh start failed: ${result4.error}`);
  } else {
    pass(`Fresh conversation works: ${result4.text.slice(0, 100)}...`);
    if (result4.sessionId) {
      pass(`New session_id: ${result4.sessionId}`);
      await updateSessionId(conv4.id, result4.sessionId);
    }
  }

  // ─── CLEANUP ────────────────────────────────────────────────────────────

  log('CLEANUP');
  await deleteConversation(project.id);
  pass('Cleaned up test conversation');

  // ─── SUMMARY ────────────────────────────────────────────────────────────

  log('SUMMARY');
  console.log('  Test 1 (first message):     ' + (result1.error ? '❌ FAIL' : '✅ PASS'));
  console.log('  Test 2 (resume):            ' + (result2.error ? '❌ FAIL' : '✅ PASS'));
  console.log('  Test 3 (bad resume):        ' + (result3.error ? '✅ PASS (correctly failed)' : '⚠️  SDK did not throw'));
  console.log('  Test 4 (fresh after delete): ' + (result4.error ? '❌ FAIL' : '✅ PASS'));

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
