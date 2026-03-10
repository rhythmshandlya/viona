/**
 * WebSocket hook for real-time job progress updates
 * Replaces polling with push-based updates.
 * Includes auto-reconnect with exponential backoff.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  return cookies['stytch_session_jwt'] || cookies['stytch_session_token'] || null;
}

interface JobProgress {
  jobId: string;
  progress: number;
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
  };
}

interface JobComplete {
  jobId: string;
  projectId: string;
}

interface JobError {
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

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function useJobWebSocket(
  projectId: string | null,
  handlers: MessageHandler
) {
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedJobsRef = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Connect to WebSocket with auto-reconnect
  useEffect(() => {
    mountedRef.current = true;
    if (!projectId) return;

    function connect() {
      const token = getSessionToken();
      if (!token || !mountedRef.current) return;

      // Clean up previous socket if any
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.close();
      }

      const socket = new WebSocket(`${WS_URL}/ws?projectId=${projectId}&token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) { socket.close(); return; }
        setIsConnected(true);
        reconnectAttemptRef.current = 0; // Reset backoff on successful connect

        // Re-subscribe to any jobs that were being tracked
        subscribedJobsRef.current.forEach((jobId) => {
          socket.send(JSON.stringify({ type: 'subscribe:job', jobId }));
        });
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;

          switch (type) {
            case 'job:progress':
              handlersRef.current.onProgress?.(payload);
              break;
            case 'job:complete':
              handlersRef.current.onComplete?.(payload);
              break;
            case 'job:error':
              handlersRef.current.onError?.(payload);
              break;
            case 'job:health':
              handlersRef.current.onHealth?.(payload);
              break;
            case 'job:activity':
              handlersRef.current.onActivity?.(payload);
              break;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);

        // Auto-reconnect with exponential backoff
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
          MAX_RECONNECT_DELAY,
        );
        reconnectAttemptRef.current++;

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };

      socket.onerror = () => {
        // onclose will fire after onerror, which handles reconnection
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect on intentional close
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [projectId]);

  // Subscribe to a job — queues the subscription if socket isn't ready yet
  const subscribeToJob = useCallback((jobId: string) => {
    subscribedJobsRef.current.add(jobId);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'subscribe:job', jobId }));
    }
    // If not connected, the subscription will be sent on reconnect (onopen handler)
  }, []);

  // Unsubscribe from a job
  const unsubscribeFromJob = useCallback((jobId: string) => {
    subscribedJobsRef.current.delete(jobId);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'unsubscribe:job', jobId }));
    }
  }, []);

  return {
    isConnected,
    subscribeToJob,
    unsubscribeFromJob,
  };
}
