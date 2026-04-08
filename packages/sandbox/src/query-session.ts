// packages/sandbox/src/query-session.ts
//
// Persistent long-lived SDK Query that accepts injected messages via
// streamInput() — eliminates per-turn session resume overhead and
// frontend message queueing.
//
// Lifecycle:
//   1. First submitTurn() → creates the Query (via SDK query()) and starts drainLoop()
//   2. Subsequent submitTurn() → injects message via Query.streamInput()
//   3. drainLoop() routes SDK events to the correct turn's callbacks
//   4. On query death → recreates on next submitTurn (with session resume fallback)

import {
  query as sdkQuery,
  type SDKMessage,
  type SDKUserMessage,
  type Query,
} from '@anthropic-ai/claude-agent-sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources';
import pino from 'pino';
import {
  startJob, finishJob, failJob, completeTask, getJobState,
} from './job-state.js';
import { flushCallbacks } from './api-callback.js';
import { checkpoint } from './checkpoint.js';
import {
  type OrchestratorRequest,
  type OrchestratorCallbacks,
  type TurnState,
  buildOrchestratorOptions,
  buildUserMessage,
  processSDKMessage,
  createTurnState,
} from './orchestrator.js';
import type { PromptContext } from './prompts/prompt-loader.js';

const logger = pino({ name: 'query-session' });

// ---- Turn entry ----

interface TurnEntry {
  turnId: string;
  request: OrchestratorRequest;
  callbacks: OrchestratorCallbacks;
  userMessage: string;
  turn: TurnState;
  startedAt: number;
  /** Resolves when this turn's processing completes (done or error). */
  resolve: () => void;
  reject: (err: Error) => void;
}

// ---- QuerySession ----

export class QuerySession {
  private activeQuery: Query | null = null;
  private sessionId: string | null = null;
  private cachedOptions: Record<string, unknown> | null = null;
  private mcpServers: Record<string, unknown>;

  // Turn management — SDK processes one user message at a time
  private currentTurn: TurnEntry | null = null;
  private pendingTurns: TurnEntry[] = [];
  private drainRunning = false;
  private destroyed = false;

  constructor(mcpServers: Record<string, unknown>) {
    this.mcpServers = mcpServers;
  }

  /**
   * Submit a new turn. If the query exists, injects via streamInput().
   * If not, creates a fresh query.
   */
  /**
   * Submit a new turn. Returns a Promise that resolves when the turn
   * completes (done or error), keeping the SSE connection alive.
   */
  submitTurn(
    turnId: string,
    request: OrchestratorRequest,
    callbacks: OrchestratorCallbacks,
  ): Promise<void> {
    if (this.destroyed) {
      callbacks.onError('Session has been destroyed');
      return Promise.resolve();
    }

    const isResuming = !!this.sessionId || !!request.sessionId;
    const userMessage = buildUserMessage(request, isResuming);

    return new Promise<void>((resolve, reject) => {
      const entry: TurnEntry = {
        turnId,
        request,
        callbacks,
        userMessage,
        turn: createTurnState(),
        startedAt: Date.now(),
        resolve,
        reject,
      };

      if (!this.activeQuery) {
        // First turn — create the query
        this.currentTurn = entry;
        startJob(turnId);
        this.createAndDrain(entry).catch(reject);
      } else {
        // Query alive — inject message for next turn
        this.pendingTurns.push(entry);
        logger.info({ turnId, queueDepth: this.pendingTurns.length }, 'Turn queued for injection');

        const sdkMsg = this.buildSDKUserMessage(userMessage, 'next');
        this.activeQuery.streamInput(singleMessage(sdkMsg)).then(() => {
          logger.info({ turnId }, 'Message injected via streamInput');
        }).catch((err) => {
          logger.error({ err, turnId }, 'streamInput failed — will retry on next drain');
        });
        // Promise resolves later via finishCurrentTurn() or handleQueryDeath()
      }
    });
  }

  /**
   * Cancel the current turn. Uses interrupt() to stop processing.
   */
  async cancel(): Promise<void> {
    if (this.destroyed) return;
    if (!this.activeQuery) return;

    // Close the query — interrupt can leave the drain loop hanging
    this.activeQuery.close();
    this.activeQuery = null;
    logger.info('Query closed for cancellation');

    // Error current turn and release its SSE connection
    if (this.currentTurn) {
      failJob('Cancelled by user');
      flushCallbacks();
      this.currentTurn.callbacks.onError('Cancelled by user');
      this.currentTurn.resolve();
      this.currentTurn = null;
    }

    // Error pending turns
    for (const pending of this.pendingTurns) {
      pending.callbacks.onError('Cancelled — previous turn was cancelled');
      pending.resolve();
    }
    this.pendingTurns = [];
  }

  /**
   * Destroy the session — close the query and clear all state.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.activeQuery) {
      this.activeQuery.close();
      this.activeQuery = null;
    }
    if (this.currentTurn) {
      failJob('Session destroyed');
      flushCallbacks();
      this.currentTurn.resolve();
      this.currentTurn = null;
    }
    for (const pending of this.pendingTurns) {
      pending.callbacks.onError('Session destroyed');
      pending.resolve();
    }
    this.pendingTurns = [];
    this.cachedOptions = null;
    this.sessionId = null;
    logger.info('QuerySession destroyed');
  }

  /** Whether a turn is currently being processed. */
  get isBusy(): boolean {
    return this.currentTurn !== null;
  }

  /** Whether the query is alive. */
  get isAlive(): boolean {
    return this.activeQuery !== null;
  }

  /** Number of turns waiting to be processed. */
  get queueDepth(): number {
    return this.pendingTurns.length;
  }

  // ---- Internal ----

  private async createAndDrain(firstTurn: TurnEntry): Promise<void> {
    if (this.drainRunning) return;
    this.drainRunning = true;

    try {
      // Build options (loads prompts, subagent definitions)
      if (!this.cachedOptions) {
        this.cachedOptions = await buildOrchestratorOptions(
          firstTurn.request.projectContext,
          this.mcpServers,
        );
      }

      const opts: Record<string, unknown> = { ...this.cachedOptions };

      // Resume from previous session if available
      const resumeId = this.sessionId ?? firstTurn.request.sessionId;
      if (resumeId) {
        opts.resume = resumeId;
        logger.info({ sessionId: resumeId }, 'Creating query with session resume');
      } else {
        logger.info('Creating fresh query');
      }

      firstTurn.callbacks.onProgress({
        phase: 'connecting',
        percent: 0,
        message: resumeId ? 'Resuming session...' : 'Starting session...',
        agentName: 'Viona',
      });

      const q = sdkQuery({ prompt: firstTurn.userMessage, options: opts });
      this.activeQuery = q;

      await this.drainLoop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, 'createAndDrain failed');

      // If resume failed, retry fresh
      if ((this.sessionId || firstTurn.request.sessionId) && !this.destroyed) {
        logger.warn('Resume failed — retrying fresh');
        this.sessionId = null;
        this.cachedOptions = null;
        firstTurn.turn = createTurnState();
        firstTurn.callbacks.onText(''); // Signal reset

        try {
          this.cachedOptions = await buildOrchestratorOptions(
            firstTurn.request.projectContext,
            this.mcpServers,
          );
          const q = sdkQuery({ prompt: firstTurn.userMessage, options: this.cachedOptions });
          this.activeQuery = q;
          await this.drainLoop();
        } catch (retryErr) {
          this.handleQueryDeath(retryErr instanceof Error ? retryErr : new Error(String(retryErr)));
        }
      } else {
        this.handleQueryDeath(err instanceof Error ? err : new Error(msg));
      }
    } finally {
      this.drainRunning = false;
    }
  }

  /**
   * Core event loop — iterates over the Query's AsyncGenerator continuously.
   * Routes each SDK message to the current turn's callbacks.
   * On `result` message → finishes current turn, advances to next.
   */
  private async drainLoop(): Promise<void> {
    if (!this.activeQuery) return;

    for await (const message of this.activeQuery) {
      if (this.destroyed) break;

      // Capture session ID
      if (!this.sessionId && message.session_id) {
        this.sessionId = message.session_id;
        logger.info({ sessionId: this.sessionId }, 'Session ID captured');
      }

      if (!this.currentTurn) {
        // No active turn — this shouldn't happen but log it
        logger.warn({ type: message.type }, 'SDK message received with no active turn');
        continue;
      }

      const status = processSDKMessage(message, this.currentTurn.turn, this.currentTurn.callbacks);

      if (status === 'result') {
        this.finishCurrentTurn();
        this.advanceToNextTurn();
      }
    }

    // Query generator completed — the query is done
    logger.info('Query generator completed');
    this.activeQuery = null;

    // If we still have a current turn, it ended without a result
    if (this.currentTurn) {
      this.handleQueryDeath(new Error('Query ended unexpectedly'));
    }
  }

  private finishCurrentTurn(): void {
    if (!this.currentTurn) return;

    const { turn, callbacks, startedAt, request } = this.currentTurn;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);

    // Complete Viona's task
    if (turn.vionaTaskId) {
      completeTask(turn.vionaTaskId);
      turn.vionaTaskId = null;
    }

    // Health check
    const userPrompt = request.prompt.toLowerCase();
    const isActionable = ['fix', 'error', 'change', 'update', 'add', 'remove', 'edit', 'debug']
      .some(w => userPrompt.includes(w));
    if (isActionable && turn.toolUses === 0 && turn.textChunks > 50) {
      logger.warn({
        prompt: request.prompt.substring(0, 100),
        textChunks: turn.textChunks,
        toolUses: turn.toolUses,
      }, 'Agent produced long text response without tool use');
    }

    // Completion widget
    const VIDEO_PHASES = ['animator', 'final_editor', 'layout_editor', 'setup_agent'];
    const videoWorkDone = VIDEO_PHASES.some(p => turn.subagentTypesDispatched.has(p));
    if (videoWorkDone) {
      const jobState = getJobState();
      callbacks.onWidget({
        kind: 'completion',
        id: `completion-${Date.now()}`,
        durationSeconds: elapsed,
        cost: turn.lastResultCost,
        plan: jobState?.plan ?? undefined,
      });
    }

    const doneResult = {
      sessionId: turn.capturedSessionId ?? this.sessionId ?? undefined,
      cost: turn.lastResultCost,
      numTurns: turn.lastResultTurns,
    };

    logger.info({
      elapsed,
      messageCount: turn.messageCount,
      textChunks: turn.textChunks,
      toolUses: turn.toolUses,
      sessionId: this.sessionId,
    }, 'Turn completed');

    finishJob(doneResult);
    flushCallbacks();
    callbacks.onDone(doneResult);

    // Checkpoint at turn boundary
    checkpoint().catch(err => {
      logger.warn({ err }, 'Turn-end checkpoint failed');
    });

    // Resolve the submitTurn() promise so the SSE handler can close
    const { resolve } = this.currentTurn;
    this.currentTurn = null;
    resolve();
  }

  private advanceToNextTurn(): void {
    if (this.pendingTurns.length === 0) return;

    const next = this.pendingTurns.shift()!;
    this.currentTurn = next;
    startJob(next.turnId);

    logger.info({ turnId: next.turnId, remaining: this.pendingTurns.length }, 'Advancing to next turn');

    next.callbacks.onProgress({
      phase: 'connecting',
      percent: 0,
      message: 'Processing your message...',
      agentName: 'Viona',
    });
  }

  private handleQueryDeath(error: Error): void {
    logger.error({ err: error.message }, 'Query died');
    this.activeQuery = null;

    // Error current turn — resolve its promise so SSE handler can close
    if (this.currentTurn) {
      failJob(error.message);
      flushCallbacks();
      this.currentTurn.callbacks.onError(error.message);
      this.currentTurn.resolve(); // Resolve (not reject) — error already sent via onError callback
      this.currentTurn = null;
    }

    // Retry first pending turn (which will recreate the query)
    if (this.pendingTurns.length > 0 && !this.destroyed) {
      const next = this.pendingTurns.shift()!;
      logger.info({ turnId: next.turnId }, 'Retrying pending turn after query death');
      this.currentTurn = next;
      startJob(next.turnId);
      this.createAndDrain(next).catch(err => {
        logger.error({ err }, 'Retry after query death also failed');
      });

      // Error remaining pending turns
      for (const remaining of this.pendingTurns) {
        remaining.callbacks.onError('Query died — please retry');
        remaining.resolve(); // Release their SSE connections
      }
      this.pendingTurns = [];
    }
  }

  private buildSDKUserMessage(text: string, priority: 'now' | 'next' | 'later'): SDKUserMessage {
    return {
      type: 'user',
      message: { role: 'user', content: text } as MessageParam,
      parent_tool_use_id: null,
      priority,
      session_id: this.sessionId ?? '',
    };
  }
}

// ---- Helpers ----

async function* singleMessage(msg: SDKUserMessage): AsyncIterable<SDKUserMessage> {
  yield msg;
}
