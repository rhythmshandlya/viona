import { getSessionToken } from './auth';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export type WSMessageType =
  | 'connected'
  | 'job:progress'
  | 'job:complete'
  | 'job:error'
  | 'job:logs'
  | 'project:updated'
  | 'workspace:ready'
  | 'manifest:updated'
  | 'bundle:ready'
  | 'bundle:error'
  | 'workspace:lock_acquired'
  | 'workspace:lock_released'
  | 'workspace:teardown';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
}

export interface JobProgressPayload {
  jobId: string;
  progress: number;
  message?: string;
}

export interface JobCompletePayload {
  jobId: string;
  projectId: string;
}

export interface JobErrorPayload {
  jobId: string;
  error: string;
}

export type LogLevel = 'error' | 'progress' | 'tool' | 'debug';

export interface ToolCallDetails {
  tool: string;
  input?: Record<string, unknown>;
  output?: string;
  durationMs?: number;
  success?: boolean;
  error?: string;
  filePath?: string;
  contentPreview?: string;
  command?: string;
  exitCode?: number;
  scoreBreakdown?: Record<string, number>;
  issues?: string[];
  suggestion?: string;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
  toolCall?: ToolCallDetails;
  errorContext?: ToolCallDetails[];
}

export interface JobLogsPayload {
  jobId: string;
  logs: LogEntry[];
  timestamp: string;
}

// ---- Workspace event payloads ----

export interface WorkspaceReadyPayload {
  projectId: string;
  bundleUrl: string;
}

export interface ManifestUpdatedPayload {
  projectId: string;
  source: 'user' | 'ai';
  ops?: unknown[];
}

export interface BundleReadyPayload {
  projectId: string;
  bundleUrl?: string;
  hash?: string;
}

export interface BundleErrorPayload {
  projectId: string;
  error: string;
}

export interface WorkspaceLockPayload {
  projectId: string;
  holder: 'user' | 'ai';
}

export interface WorkspaceTeardownPayload {
  projectId: string;
}

type MessageHandler = (message: WSMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  // Track subscribed job IDs so we can re-subscribe on reconnect
  // and queue subscriptions if WS isn't open yet
  private subscribedJobIds: Set<string> = new Set();

  connect(projectId: string): void {
    if (this.ws && this.projectId === projectId) {
      return; // Already connected to this project
    }

    this.disconnect();
    this.projectId = projectId;

    // Get auth token for WebSocket connection
    const token = getSessionToken();
    if (!token) {
      console.error('No auth token available for WebSocket connection');
      return;
    }

    const url = `${WS_URL}/ws?projectId=${projectId}&token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;

      // Flush any pending/previously-subscribed job IDs
      for (const jobId of this.subscribedJobIds) {
        this.ws!.send(JSON.stringify({ type: 'subscribe:job', jobId }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;
        this.handlers.forEach((handler) => handler(message));
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.ws = null;

      // Attempt to reconnect (subscribedJobIds are preserved so onopen re-subscribes)
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.projectId) {
        this.reconnectAttempts++;
        const delay = Math.min(
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          10_000, // Cap at 10 seconds
        );
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => {
          if (this.projectId) {
            this.connect(this.projectId);
          }
        }, delay);
      }
    };

    this.ws.onerror = () => {
      // Logged as warn — onerror provides no useful detail (the Event
      // object is opaque) and the onclose handler already triggers
      // reconnection.  Using console.error would cause Next.js dev
      // overlay to surface this as a visible error.
      console.warn('WebSocket connection error — will reconnect on close');
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.projectId = null;
    this.reconnectAttempts = 0;
    this.subscribedJobIds.clear();
  }

  subscribeToJob(jobId: string): void {
    this.subscribedJobIds.add(jobId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe:job', jobId }));
    }
    // If WS isn't open yet, onopen will flush subscribedJobIds
  }

  unsubscribeFromJob(jobId: string): void {
    this.subscribedJobIds.delete(jobId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe:job', jobId }));
    }
  }

  addHandler(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  removeHandler(handler: MessageHandler): void {
    this.handlers.delete(handler);
  }
}

export const wsClient = new WebSocketClient();
