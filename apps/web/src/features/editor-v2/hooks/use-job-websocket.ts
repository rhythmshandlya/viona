/**
 * WebSocket hook for real-time job progress updates
 * Replaces polling with push-based updates
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

interface JobProgress {
  jobId: string;
  progress: number;
  message?: string;
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
};

export function useJobWebSocket(
  projectId: string | null,
  handlers: MessageHandler
) {
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedJobsRef = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);

  // Keep handlers ref up to date
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Connect to WebSocket
  useEffect(() => {
    if (!projectId) return;

    const socket = new WebSocket(`${WS_URL}/ws?projectId=${projectId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');

      // Re-subscribe to any jobs
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
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [projectId]);

  // Subscribe to a job
  const subscribeToJob = useCallback((jobId: string) => {
    subscribedJobsRef.current.add(jobId);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'subscribe:job', jobId }));
    }
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
