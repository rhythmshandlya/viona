/**
 * Hook for subscribing to real-time job logs via WebSocket
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { wsClient, WSMessage, JobLogsPayload, LogEntry } from '@/lib/ws';

interface UseJobLogsOptions {
  /** Maximum number of log entries to keep (default: 500) */
  maxEntries?: number;
  /** Minimum log level to display (default: 'tool') */
  minLevel?: 'error' | 'progress' | 'tool' | 'debug';
}

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  error: 0,
  progress: 1,
  tool: 2,
  debug: 3,
};

export function useJobLogs(
  projectId: string | null,
  jobId: string | null,
  options: UseJobLogsOptions = {}
) {
  const { maxEntries = 500, minLevel = 'tool' } = options;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const logsRef = useRef<LogEntry[]>([]);

  // Clear logs
  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  // Filter logs by level
  const filterByLevel = useCallback(
    (entry: LogEntry): boolean => {
      const entryPriority = LOG_LEVEL_PRIORITY[entry.level] ?? 3;
      const minPriority = LOG_LEVEL_PRIORITY[minLevel] ?? 2;
      return entryPriority <= minPriority;
    },
    [minLevel]
  );

  // Connect and subscribe
  useEffect(() => {
    if (!projectId || !jobId) {
      return;
    }

    // Connect to WebSocket if not already connected
    wsClient.connect(projectId);

    // Subscribe to the job
    wsClient.subscribeToJob(jobId);
    setIsSubscribed(true);

    // Handle incoming messages
    const handleMessage = (message: WSMessage) => {
      if (message.type === 'job:logs') {
        const payload = message.payload as JobLogsPayload;

        // Only process logs for our job
        if (payload.jobId !== jobId) return;

        // Filter and add new logs
        const newLogs = payload.logs.filter(filterByLevel);

        if (newLogs.length > 0) {
          logsRef.current = [...logsRef.current, ...newLogs];

          // Trim to max entries
          if (logsRef.current.length > maxEntries) {
            logsRef.current = logsRef.current.slice(-maxEntries);
          }

          setLogs([...logsRef.current]);
        }
      }
    };

    const removeHandler = wsClient.addHandler(handleMessage);

    return () => {
      removeHandler();
      wsClient.unsubscribeFromJob(jobId);
      setIsSubscribed(false);
    };
  }, [projectId, jobId, maxEntries, filterByLevel]);

  return {
    logs,
    isSubscribed,
    clearLogs,
  };
}
