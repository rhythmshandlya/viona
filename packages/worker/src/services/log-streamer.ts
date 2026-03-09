/**
 * LogStreamer - Debounced log streaming for Docker agent output.
 *
 * Features:
 * - Debounces logs at 500ms intervals
 * - Filters by importance level (error, progress, tool, debug)
 * - Sanitizes sensitive data (API keys, paths)
 * - Batches similar events to reduce noise
 * - Verbose mode for full tool input/output (opt-in)
 * - Error context tracking (last N tool calls before error)
 */

import { redis } from './redis.js';
import { logger } from '../logger.js';

export type LogLevel = 'error' | 'progress' | 'tool' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  /** Optional structured data */
  data?: Record<string, unknown>;
  /** Tool call details for verbose mode */
  toolCall?: ToolCallDetails;
  /** Error context - recent tool calls leading to error */
  errorContext?: ToolCallDetails[];
}

/** Detailed tool call information for debugging */
export interface ToolCallDetails {
  tool: string;
  /** Input parameters (truncated in non-verbose mode) */
  input?: Record<string, unknown>;
  /** Output/result (truncated in non-verbose mode) */
  output?: string;
  /** Duration in ms */
  durationMs?: number;
  /** Success/failure */
  success?: boolean;
  /** Error message if failed */
  error?: string;
  /** For file operations: path */
  filePath?: string;
  /** For file operations: content preview */
  contentPreview?: string;
  /** For bash: full command */
  command?: string;
  /** For bash: exit code */
  exitCode?: number;
  /** For critic: score breakdown */
  scoreBreakdown?: Record<string, number>;
  /** For critic: issues list */
  issues?: string[];
  /** For critic: suggestion */
  suggestion?: string;
}

interface LogStreamerOptions {
  /** Job ID for Redis channel */
  jobId: string;
  /** Debounce interval in ms (default: 500) */
  debounceMs?: number;
  /** Minimum log level to stream (default: 'tool') */
  minLevel?: LogLevel;
  /** Max entries per batch (default: 20) */
  maxBatchSize?: number;
  /** Enable verbose mode with full tool inputs/outputs (default: false) */
  verbose?: boolean;
  /** Max content preview length in chars (default: 500, verbose: 2000) */
  maxContentLength?: number;
  /** Number of recent tool calls to keep for error context (default: 5) */
  errorContextSize?: number;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  progress: 1,
  tool: 2,
  debug: 3,
};

// Patterns to sanitize from logs
const SANITIZE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys
  { pattern: /\b[A-Za-z0-9_-]{32,}\b/g, replacement: '[REDACTED]' },
  { pattern: /(api[_-]?key|apikey|secret|token|password)["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, replacement: '$1=[REDACTED]' },
  // Absolute paths (keep relative)
  { pattern: /\/home\/[^/\s]+/g, replacement: '/home/***' },
  { pattern: /\/Users\/[^/\s]+/g, replacement: '/Users/***' },
  { pattern: /C:\\Users\\[^\\]+/gi, replacement: 'C:\\Users\\***' },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
];

export class LogStreamer {
  private jobId: string;
  private debounceMs: number;
  private minLevel: LogLevel;
  private maxBatchSize: number;
  private verbose: boolean;
  private maxContentLength: number;
  private errorContextSize: number;

  private buffer: LogEntry[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastFlush: number = 0;
  private isClosed: boolean = false;

  /** Recent tool calls for error context */
  private recentToolCalls: ToolCallDetails[] = [];

  constructor(options: LogStreamerOptions) {
    this.jobId = options.jobId;
    this.debounceMs = options.debounceMs ?? 500;
    this.minLevel = options.minLevel ?? 'tool';
    this.maxBatchSize = options.maxBatchSize ?? 20;
    this.verbose = options.verbose ?? false;
    this.maxContentLength = options.maxContentLength ?? (options.verbose ? 2000 : 500);
    this.errorContextSize = options.errorContextSize ?? 5;
  }

  /** Add a tool call to recent history for error context */
  private trackToolCall(details: ToolCallDetails): void {
    this.recentToolCalls.push({
      ...details,
      // Truncate content in tracking to save memory
      contentPreview: this.truncate(details.contentPreview, this.maxContentLength),
      output: this.truncate(details.output, this.maxContentLength),
    });

    // Keep only last N entries
    if (this.recentToolCalls.length > this.errorContextSize) {
      this.recentToolCalls.shift();
    }
  }

  /** Truncate string to max length with ellipsis */
  private truncate(str: string | undefined, maxLen: number): string | undefined {
    if (!str) return str;
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
  }

  /**
   * Add a log entry to the stream.
   * Will be debounced and batched before sending.
   */
  log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    toolCall?: ToolCallDetails
  ): void {
    if (this.isClosed) return;

    // Filter by level
    if (LOG_LEVEL_PRIORITY[level] > LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message: this.sanitize(message),
      timestamp: new Date().toISOString(),
      data: data ? this.sanitizeObject(data) : undefined,
    };

    // Add tool call details if provided
    if (toolCall) {
      entry.toolCall = this.sanitizeToolCall(toolCall);
      this.trackToolCall(toolCall);
    }

    // For errors, attach recent tool calls as context
    if (level === 'error' && this.recentToolCalls.length > 0) {
      entry.errorContext = this.recentToolCalls.map(tc => this.sanitizeToolCall(tc));
    }

    this.buffer.push(entry);

    // Immediate flush for errors
    if (level === 'error') {
      this.flush();
      return;
    }

    // Schedule debounced flush
    this.scheduleFlush();
  }

  /** Sanitize tool call details */
  private sanitizeToolCall(tc: ToolCallDetails): ToolCallDetails {
    return {
      ...tc,
      input: tc.input ? this.sanitizeObject(tc.input) : undefined,
      output: tc.output ? this.sanitize(this.truncate(tc.output, this.maxContentLength) || '') : undefined,
      contentPreview: tc.contentPreview
        ? this.sanitize(this.truncate(tc.contentPreview, this.maxContentLength) || '')
        : undefined,
      command: tc.command ? this.sanitize(tc.command) : undefined,
      filePath: tc.filePath ? this.sanitize(tc.filePath) : undefined,
      error: tc.error ? this.sanitize(tc.error) : undefined,
    };
  }

  /** Convenience methods */
  error(message: string, data?: Record<string, unknown>, toolCall?: ToolCallDetails): void {
    this.log('error', message, data, toolCall);
  }

  progress(message: string, data?: Record<string, unknown>, toolCall?: ToolCallDetails): void {
    this.log('progress', message, data, toolCall);
  }

  tool(message: string, data?: Record<string, unknown>, toolCall?: ToolCallDetails): void {
    this.log('tool', message, data, toolCall);
  }

  debug(message: string, data?: Record<string, unknown>, toolCall?: ToolCallDetails): void {
    this.log('debug', message, data, toolCall);
  }

  /** Get current error context (recent tool calls) */
  getErrorContext(): ToolCallDetails[] {
    return [...this.recentToolCalls];
  }

  /** Clear error context (e.g., after successful iteration) */
  clearErrorContext(): void {
    this.recentToolCalls = [];
  }

  /**
   * Parse and log an agent event from Docker stdout.
   * Maps agent event types to appropriate log levels.
   */
  logAgentEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'error':
        this.error(event.message || 'Unknown error', {
          raw: event,
          errorType: event.error_type,
          stackTrace: event.stack_trace,
        });
        break;

      case 'cancelled':
        this.progress('Agent cancelled');
        break;

      case 'started':
        this.progress(`Agent started (max ${event.max_iterations || 3} iterations)`, {
          model: event.model,
          maxIterations: event.max_iterations,
        });
        break;

      case 'iteration_start':
        this.progress(`Starting iteration ${event.iteration}/${event.max_iterations || 3}`);
        break;

      case 'iteration_complete':
        // Log full critic details in verbose mode, limited otherwise
        const issueLimit = this.verbose ? 10 : 3;
        this.progress(
          `Iteration ${event.iteration} complete: score ${event.score || 0}/100`,
          {
            score: event.score,
            breakdown: event.breakdown,
            issues: event.issues?.slice(0, issueLimit),
            suggestion: this.verbose ? event.suggestion : undefined,
          }
        );
        break;

      case 'critic_result':
        // Detailed critic feedback
        this.logCriticResult(event);
        break;

      case 'complete':
        this.progress(
          `Agent ${event.status || 'completed'}: score ${event.final_score || 0}/100, ${event.total_iterations || 0} iterations`,
          {
            status: event.status,
            finalScore: event.final_score,
            totalIterations: event.total_iterations,
            filesWritten: event.files_written,
            editsCount: event.edits_made,
            screenshotsTaken: event.screenshots_taken,
          }
        );
        break;

      case 'tool_call':
        this.logToolCall(event);
        break;

      case 'tool_result':
        this.logToolResult(event);
        break;

      case 'validation_error':
        this.logValidationError(event);
        break;

      case 'llm_reasoning':
        // Log LLM's thinking/reasoning (verbose only)
        if (this.verbose) {
          this.debug(`LLM reasoning: ${this.truncate(event.reasoning, 500)}`, {
            fullReasoning: event.reasoning,
          });
        }
        break;

      default:
        this.debug(`Unknown event: ${event.type}`, { raw: event });
    }
  }

  /** Log detailed critic feedback */
  private logCriticResult(event: AgentEvent): void {
    const toolCall: ToolCallDetails = {
      tool: 'critic',
      success: (event.score || 0) >= (event.threshold || 80),
      scoreBreakdown: event.breakdown,
      issues: event.issues,
      suggestion: event.suggestion,
    };

    const message = `Critic score: ${event.score || 0}/100 (threshold: ${event.threshold || 80})`;

    this.log('tool', message, {
      score: event.score,
      threshold: event.threshold,
      breakdown: event.breakdown,
      issueCount: event.issues?.length || 0,
    }, toolCall);

    // Log individual issues as debug
    if (this.verbose && event.issues) {
      for (const issue of event.issues) {
        this.debug(`  Issue: ${issue}`);
      }
    }
  }

  /** Log tool execution result */
  private logToolResult(event: AgentEvent): void {
    const tool = event.tool || 'unknown';
    const success = event.success !== false;
    const durationMs = event.duration_ms;

    const toolCall: ToolCallDetails = {
      tool,
      success,
      durationMs,
      output: event.output,
      error: event.error,
      exitCode: event.exit_code,
    };

    if (!success) {
      this.error(`Tool ${tool} failed: ${event.error || 'unknown error'}`, {
        tool,
        exitCode: event.exit_code,
      }, toolCall);
    } else if (this.verbose) {
      this.debug(`Tool ${tool} completed in ${durationMs || '?'}ms`, {
        outputPreview: this.truncate(event.output, 200),
      }, toolCall);
    }
  }

  /** Log validation errors (TypeScript, Remotion build, etc.) */
  private logValidationError(event: AgentEvent): void {
    const errorType = event.validation_type || 'unknown';
    const errors = event.errors || [];

    this.error(`Validation failed (${errorType}): ${errors.length} error(s)`, {
      validationType: errorType,
      errorCount: errors.length,
      errors: this.verbose ? errors : errors.slice(0, 5),
    });

    // Log individual errors
    for (const err of errors.slice(0, this.verbose ? 20 : 5)) {
      if (typeof err === 'string') {
        this.debug(`  ${err}`);
      } else {
        this.debug(`  ${err.file || ''}:${err.line || ''} - ${err.message || ''}`);
      }
    }
  }

  private logToolCall(event: AgentEvent): void {
    const tool = event.tool || 'unknown';

    switch (tool) {
      case 'generator':
        this.tool('Running code generator', { iteration: event.iteration });
        break;

      case 'critic':
        this.tool('Running validation', { iteration: event.iteration });
        break;

      case 'root_generator':
        this.log('tool', event.message || 'Generating Root.tsx', {
          compositionsFound: event.compositions_found,
        }, {
          tool: 'root_generator',
          success: event.success,
          output: event.output,
        });
        break;

      case 'write': {
        const filePath = event.file_path || event.path;
        const contentPreview = this.verbose ? event.content : this.truncate(event.content, 200);

        this.log('tool', `Writing file: ${filePath || `#${event.count || '?'}`}`, {
          filePath,
          contentLength: event.content?.length,
        }, {
          tool: 'write',
          filePath,
          contentPreview,
          success: event.success,
        });
        break;
      }

      case 'edit': {
        const filePath = event.file_path || event.path;
        const oldStr = this.truncate(event.old_string, this.verbose ? 500 : 100);
        const newStr = this.truncate(event.new_string, this.verbose ? 500 : 100);

        this.log('tool', `Editing file: ${filePath || `#${event.count || '?'}`}`, {
          filePath,
          oldLength: event.old_string?.length,
          newLength: event.new_string?.length,
        }, {
          tool: 'edit',
          filePath,
          input: this.verbose ? { old_string: oldStr, new_string: newStr } : undefined,
          success: event.success,
          error: event.error,
        });
        break;
      }

      case 'screenshot': {
        const frame = event.frame ?? event.count;
        this.log('tool', `Screenshot #${event.count || '?'} at frame ${frame}`, {
          frame,
          outputPath: event.output_path,
        }, {
          tool: 'screenshot',
          input: { frame, compositionId: event.composition_id },
          success: event.success,
        });
        break;
      }

      case 'bash': {
        const fullCmd = event.command || '';
        const cmdPreview = this.verbose
          ? fullCmd
          : this.truncate(fullCmd, 100);

        this.log('tool', `Running: ${this.truncate(fullCmd, 60) || 'command'}`, {
          commandLength: fullCmd.length,
        }, {
          tool: 'bash',
          command: cmdPreview,
          input: this.verbose ? { command: fullCmd } : undefined,
        });
        break;
      }

      case 'bash_result': {
        // Detailed bash result with output
        const exitCode = event.exit_code ?? 0;
        const output = event.output || '';
        const stderr = event.stderr || '';

        this.log('tool', `Command ${exitCode === 0 ? 'succeeded' : `failed (exit ${exitCode})`}`, {
          exitCode,
          outputLength: output.length,
          stderrLength: stderr.length,
        }, {
          tool: 'bash',
          exitCode,
          success: exitCode === 0,
          output: this.truncate(output, this.maxContentLength),
          error: stderr ? this.truncate(stderr, this.maxContentLength) : undefined,
        });
        break;
      }

      case 'read': {
        const filePath = event.file_path || event.path;
        this.log('tool', `Reading: ${filePath || 'files'}`, {
          filePath,
          contentLength: event.content?.length,
        }, {
          tool: 'read',
          filePath,
          contentPreview: this.verbose ? this.truncate(event.content, this.maxContentLength) : undefined,
          success: event.success,
        });
        break;
      }

      case 'typescript_validate': {
        const errors = event.errors || [];
        this.log('tool', `TypeScript validation: ${errors.length === 0 ? 'passed' : `${errors.length} error(s)`}`, {
          errorCount: errors.length,
          errors: this.verbose ? errors : errors.slice(0, 3),
        }, {
          tool: 'typescript_validate',
          success: errors.length === 0,
          error: errors.length > 0 ? errors.map((e: any) => e.message || e).join('; ') : undefined,
        });
        break;
      }

      case 'remotion_bundle': {
        this.log('tool', `Remotion bundle: ${event.success ? 'succeeded' : 'failed'}`, {
          bundlePath: event.bundle_path,
        }, {
          tool: 'remotion_bundle',
          success: event.success,
          error: event.error,
          output: event.output,
        });
        break;
      }

      case 'remotion_still': {
        this.log('tool', `Rendering still at frame ${event.frame}`, {
          frame: event.frame,
          compositionId: event.composition_id,
          outputPath: event.output_path,
        }, {
          tool: 'remotion_still',
          success: event.success,
          error: event.error,
        });
        break;
      }

      default:
        this.tool(`Tool: ${tool}`, { raw: event });
    }
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) return;

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  private async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.buffer.length === 0) return;

    // Take entries up to max batch size
    const entries = this.buffer.splice(0, this.maxBatchSize);

    // Dedupe similar consecutive messages
    const deduped = this.dedupeEntries(entries);

    try {
      await redis.publish(
        `job:${this.jobId}:logs`,
        JSON.stringify({
          jobId: this.jobId,
          logs: deduped,
          timestamp: new Date().toISOString(),
        })
      );

      this.lastFlush = Date.now();
    } catch (err) {
      logger.error({ err, jobId: this.jobId }, 'Failed to publish logs');
    }

    // If there are more entries, schedule another flush
    if (this.buffer.length > 0) {
      this.scheduleFlush();
    }
  }

  private dedupeEntries(entries: LogEntry[]): LogEntry[] {
    const result: LogEntry[] = [];
    let lastMessage = '';
    let repeatCount = 0;

    for (const entry of entries) {
      if (entry.message === lastMessage && entry.level !== 'error') {
        repeatCount++;
      } else {
        if (repeatCount > 1) {
          // Add a note about repeated messages
          result[result.length - 1].message += ` (×${repeatCount})`;
        }
        result.push(entry);
        lastMessage = entry.message;
        repeatCount = 1;
      }
    }

    if (repeatCount > 1 && result.length > 0) {
      result[result.length - 1].message += ` (×${repeatCount})`;
    }

    return result;
  }

  private sanitize(text: string): string {
    let result = text;
    for (const { pattern, replacement } of SANITIZE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.sanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = Array.isArray(value)
          ? value.map(v => typeof v === 'string' ? this.sanitize(v) : v)
          : this.sanitizeObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Flush remaining logs and close the streamer.
   */
  async close(): Promise<void> {
    this.isClosed = true;
    await this.flush();
  }
}

/** Agent event structure (matches visual_generator.py output) */
interface AgentEvent {
  type: string;
  tool?: string;
  count?: number;
  command?: string;
  message?: string;
  model?: string;
  files_written?: number;
  edits_made?: number;
  screenshots_taken?: number;
  input_tokens?: number;
  output_tokens?: number;
  iteration?: number;
  max_iterations?: number;
  score?: number;
  breakdown?: Record<string, number>;
  issues?: string[];
  status?: string;
  final_score?: number;
  best_iteration?: number;
  total_iterations?: number;
  threshold?: number;

  // Enhanced fields for detailed logging
  /** Error details */
  error?: string;
  error_type?: string;
  stack_trace?: string;

  /** Tool result fields */
  success?: boolean;
  output?: string;
  stderr?: string;
  exit_code?: number;
  duration_ms?: number;

  /** File operation fields */
  file_path?: string;
  path?: string;
  content?: string;
  old_string?: string;
  new_string?: string;

  /** Screenshot fields */
  frame?: number;
  composition_id?: string;
  output_path?: string;

  /** Validation fields */
  validation_type?: string;
  errors?: Array<{ file?: string; line?: number; message?: string } | string>;

  /** Critic fields */
  suggestion?: string;

  /** Root generator fields */
  compositions_found?: number;

  /** Bundle fields */
  bundle_path?: string;

  /** LLM reasoning */
  reasoning?: string;
}

/**
 * Create a LogStreamer for a job.
 *
 * @param jobId - The job ID for Redis channel
 * @param options - Optional configuration
 * @param options.verbose - Enable verbose mode with full tool inputs/outputs (default: false)
 * @param options.debounceMs - Debounce interval in ms (default: 500)
 * @param options.minLevel - Minimum log level to stream (default: 'tool')
 * @param options.maxContentLength - Max content preview length (default: 500, verbose: 2000)
 * @param options.errorContextSize - Number of recent tool calls to keep for error context (default: 5)
 */
export function createLogStreamer(jobId: string, options?: Partial<LogStreamerOptions>): LogStreamer {
  return new LogStreamer({ jobId, ...options });
}

/**
 * Create a verbose LogStreamer for debugging.
 * Captures full tool inputs/outputs and more context.
 */
export function createVerboseLogStreamer(jobId: string, options?: Partial<LogStreamerOptions>): LogStreamer {
  return new LogStreamer({
    jobId,
    verbose: true,
    minLevel: 'debug',
    maxContentLength: 2000,
    errorContextSize: 10,
    ...options,
  });
}
