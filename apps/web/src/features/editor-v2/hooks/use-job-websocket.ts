/**
 * WebSocket hook for real-time job progress updates.
 * Delegates to the singleton wsClient — no duplicate connections.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { wsClient, WSMessage } from '@/lib/ws';

export interface JobProgress {
  jobId: string;
  progress: number;
  /** Alias for progress — some backends send percent instead */
  percent?: number;
  message?: string;
  phase?: string;
  phaseName?: string;
  jobType?: string;
  meta?: {
    phase?: string;
    phaseName?: string;
    scene?: number;
    totalScenes?: number;
    iteration?: number;
    maxIterations?: number;
    score?: number;
    detail?: string;
    agentName?: string;
  };
}

export interface JobComplete {
  jobId: string;
  projectId: string;
}

export interface JobError {
  jobId: string;
  error: string;
}

type MessageHandler = {
  onProgress?: (data: JobProgress) => void;
  onComplete?: (data: JobComplete) => void;
  onError?: (data: JobError) => void;
  onHealth?: (data: any) => void;
  onActivity?: (data: any) => void;
};

export function useJobWebSocket(
  projectId: string | null,
  handlers: MessageHandler
) {
  const [isConnected, setIsConnected] = useState(wsClient.isConnected);
  const handlersRef = useRef(handlers);

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Ensure wsClient is connected and track connection state
  useEffect(() => {
    if (!projectId) return;

    wsClient.connect(projectId);
    setIsConnected(wsClient.isConnected);

    const removeStateHandler = wsClient.addStateHandler((connected) => {
      setIsConnected(connected);
    });

    return removeStateHandler;
  }, [projectId]);

  // Route job-related WS messages to handlers
  useEffect(() => {
    if (!projectId) return;

    const removeHandler = wsClient.addHandler((message: WSMessage) => {
      const h = handlersRef.current;
      switch (message.type) {
        case 'job:progress':
          h.onProgress?.(message.payload as JobProgress);
          break;
        case 'job:complete':
          h.onComplete?.(message.payload as JobComplete);
          break;
        case 'job:error':
          h.onError?.(message.payload as JobError);
          break;
        case 'job:health':
          h.onHealth?.(message.payload);
          break;
        case 'job:activity':
          h.onActivity?.(message.payload);
          break;
      }
    });

    return removeHandler;
  }, [projectId]);

  // Subscribe to a job via the singleton client
  const subscribeToJob = useCallback((jobId: string) => {
    wsClient.subscribeToJob(jobId);
  }, []);

  // Unsubscribe from a job
  const unsubscribeFromJob = useCallback((jobId: string) => {
    wsClient.unsubscribeFromJob(jobId);
  }, []);

  return {
    isConnected,
    subscribeToJob,
    unsubscribeFromJob,
  };
}
