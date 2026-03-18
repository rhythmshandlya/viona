/**
 * JobLogsPanel Component
 * Displays real-time streaming logs from AI agent jobs
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, X, ChevronDown, ChevronUp, Trash2, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useJobLogs } from '../hooks/use-job-logs';
import { LogEntry, LogLevel } from '@/lib/ws';

interface JobLogsPanelProps {
  projectId: string | null;
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
  // Progress state
  isGenerating?: boolean;
  progress?: number;
  status?: string;
  error?: string | null;
  isComplete?: boolean;
  onCancel?: () => void;
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  error: 'text-red-400',
  progress: 'text-blue-400',
  tool: 'text-emerald-400',
  debug: 'text-zinc-500',
};

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: 'ERR',
  progress: 'INF',
  tool: 'TOOL',
  debug: 'DBG',
};

export function JobLogsPanel({
  projectId,
  jobId,
  isOpen,
  onClose,
  isGenerating = false,
  progress = 0,
  status = '',
  error = null,
  isComplete = false,
  onCancel,
}: JobLogsPanelProps) {
  const [minLevel, setMinLevel] = useState<LogLevel>('tool');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { logs, isSubscribed, clearLogs } = useJobLogs(projectId, jobId, {
    maxEntries: 1000,
    minLevel,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  if (!isOpen) return null;

  const panelHeight = isExpanded ? 'h-96' : 'h-48';

  return (
    <div
      className={`${panelHeight} relative border-t border-[var(--editor-border-subtle)] bg-[var(--editor-bg-base)] flex flex-col transition-all duration-200`}
    >
      {/* Header with progress bar */}
      <div className="flex-shrink-0 bg-[var(--editor-bg-surface)] border-b border-[var(--editor-border-subtle)]">
        {/* Progress bar row - only show when generating */}
        {(isGenerating || isComplete || error) && (
          <div className="px-3 py-2 border-b border-[var(--editor-border-subtle)]">
            <div className="flex items-center justify-between gap-3">
              {/* Status and progress */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isGenerating && (
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {isComplete && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                )}
                {error && (
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="text-xs text-[var(--editor-text-secondary)] truncate">
                  {error ? 'Generation failed' : status || 'Processing...'}
                </span>
                {isGenerating && (
                  <span className="text-xs text-[var(--editor-text-muted)] flex-shrink-0">
                    {progress}%
                  </span>
                )}
              </div>

              {/* Cancel button */}
              {isGenerating && onCancel && (
                <button
                  onClick={onCancel}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                >
                  <XCircle className="w-3 h-3" />
                  Cancel
                </button>
              )}
            </div>

            {/* Progress bar */}
            {isGenerating && (
              <div className="mt-2 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.max(2, progress)}%` }}
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <p className="mt-2 text-xs text-red-400 line-clamp-2">{error}</p>
            )}
          </div>
        )}

        {/* Main header row */}
        <div className="h-8 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[var(--editor-text-muted)]" />
            <span className="text-xs font-normal text-[var(--editor-text-secondary)]">
              Agent Logs
            </span>
            {isSubscribed && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500">LIVE</span>
              </span>
            )}
            <span className="text-[10px] text-[var(--editor-text-muted)]">
              {logs.length} entries
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Level filter */}
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value as LogLevel)}
              className="h-5 px-1 text-[10px] bg-[var(--editor-bg-hover)] border border-[var(--editor-border-subtle)] rounded text-[var(--editor-text-secondary)] focus:outline-none"
            >
              <option value="error">Errors only</option>
              <option value="progress">Progress+</option>
              <option value="tool">Tools+</option>
              <option value="debug">All (debug)</option>
            </select>

            {/* Clear button */}
            <button
              onClick={clearLogs}
              className="p-1 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3 text-[var(--editor-text-muted)]" />
            </button>

            {/* Expand/collapse button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-[var(--editor-text-muted)]" />
              ) : (
                <ChevronUp className="w-3 h-3 text-[var(--editor-text-muted)]" />
              )}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--editor-bg-hover)] transition-colors"
              title="Close"
            >
              <X className="w-3 h-3 text-[var(--editor-text-muted)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--editor-text-muted)]">
            {jobId ? 'Waiting for logs...' : 'No job selected'}
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {logs.map((entry, index) => (
              <LogEntryRow key={`${entry.timestamp}-${index}`} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-2 right-4 px-2 py-1 text-[10px] bg-[var(--editor-bg-hover)] border border-[var(--editor-border-subtle)] rounded shadow-lg hover:bg-[var(--editor-bg-surface)] transition-colors"
        >
          Jump to bottom
        </button>
      )}
    </div>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = entry.toolCall || entry.data || entry.errorContext;

  const timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="group">
      <div
        className={`flex items-start gap-2 px-1 py-0.5 rounded hover:bg-[var(--editor-bg-hover)] ${
          hasDetails ? 'cursor-pointer' : ''
        }`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {/* Timestamp */}
        <span className="text-[var(--editor-text-muted)] flex-shrink-0 select-none">
          {timestamp}
        </span>

        {/* Level badge */}
        <span className={`${LOG_LEVEL_COLORS[entry.level]} flex-shrink-0 w-8 select-none`}>
          [{LOG_LEVEL_LABELS[entry.level]}]
        </span>

        {/* Message */}
        <span className="text-[var(--editor-text-primary)] break-all flex-1">
          {entry.message}
        </span>

        {/* Expand indicator */}
        {hasDetails && (
          <span className="text-[var(--editor-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
            {isExpanded ? '[-]' : '[+]'}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="ml-[88px] pl-2 border-l border-[var(--editor-border-subtle)] my-1 text-[10px]">
          {entry.toolCall && (
            <ToolCallDetails toolCall={entry.toolCall} />
          )}
          {entry.data && (
            <div className="mt-1">
              <span className="text-[var(--editor-text-muted)]">Data: </span>
              <pre className="text-[var(--editor-text-secondary)] whitespace-pre-wrap">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          )}
          {entry.errorContext && entry.errorContext.length > 0 && (
            <div className="mt-1">
              <span className="text-red-400">Error context ({entry.errorContext.length} recent calls):</span>
              {entry.errorContext.map((tc, i) => (
                <div key={i} className="ml-2 mt-0.5 text-[var(--editor-text-muted)]">
                  - {tc.tool}: {tc.success ? 'ok' : 'failed'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCallDetails({ toolCall }: { toolCall: NonNullable<LogEntry['toolCall']> }) {
  return (
    <div className="space-y-0.5">
      <div>
        <span className="text-[var(--editor-text-muted)]">Tool: </span>
        <span className="text-emerald-400">{toolCall.tool}</span>
        {toolCall.success !== undefined && (
          <span className={toolCall.success ? 'text-emerald-400 ml-2' : 'text-red-400 ml-2'}>
            {toolCall.success ? 'SUCCESS' : 'FAILED'}
          </span>
        )}
        {toolCall.durationMs !== undefined && (
          <span className="text-[var(--editor-text-muted)] ml-2">
            ({toolCall.durationMs}ms)
          </span>
        )}
      </div>

      {toolCall.command && (
        <div>
          <span className="text-[var(--editor-text-muted)]">Command: </span>
          <code className="text-amber-400">{toolCall.command}</code>
        </div>
      )}

      {toolCall.filePath && (
        <div>
          <span className="text-[var(--editor-text-muted)]">File: </span>
          <span className="text-blue-400">{toolCall.filePath}</span>
        </div>
      )}

      {toolCall.exitCode !== undefined && (
        <div>
          <span className="text-[var(--editor-text-muted)]">Exit code: </span>
          <span className={toolCall.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}>
            {toolCall.exitCode}
          </span>
        </div>
      )}

      {toolCall.error && (
        <div>
          <span className="text-red-400">Error: </span>
          <span className="text-red-300">{toolCall.error}</span>
        </div>
      )}

      {toolCall.output && (
        <div>
          <span className="text-[var(--editor-text-muted)]">Output: </span>
          <pre className="text-[var(--editor-text-secondary)] whitespace-pre-wrap max-h-32 overflow-y-auto">
            {toolCall.output}
          </pre>
        </div>
      )}

      {toolCall.contentPreview && (
        <div>
          <span className="text-[var(--editor-text-muted)]">Content: </span>
          <pre className="text-[var(--editor-text-secondary)] whitespace-pre-wrap max-h-32 overflow-y-auto">
            {toolCall.contentPreview}
          </pre>
        </div>
      )}

      {toolCall.scoreBreakdown && (
        <div>
          <span className="text-[var(--editor-text-muted)]">Score breakdown: </span>
          <span className="text-[var(--editor-text-secondary)]">
            {Object.entries(toolCall.scoreBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}
          </span>
        </div>
      )}

      {toolCall.issues && toolCall.issues.length > 0 && (
        <div>
          <span className="text-amber-400">Issues:</span>
          <ul className="ml-2">
            {toolCall.issues.map((issue, i) => (
              <li key={i} className="text-amber-300">- {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {toolCall.suggestion && (
        <div>
          <span className="text-[var(--editor-text-muted)]">Suggestion: </span>
          <span className="text-[var(--editor-text-secondary)]">{toolCall.suggestion}</span>
        </div>
      )}
    </div>
  );
}
