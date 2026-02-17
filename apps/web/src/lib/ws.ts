const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

// Helper to get session token from cookies
function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  // Prefer JWT for faster validation
  return cookies['stytch_session_jwt'] || cookies['stytch_session_token'] || null;
}

export type WSMessageType =
  | 'connected'
  | 'job:progress'
  | 'job:complete'
  | 'job:error'
  | 'job:logs'
  | 'project:updated';

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

type MessageHandler = (message: WSMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pendingSubscriptions: Set<string> = new Set();
  private activeSubscriptions: Set<string> = new Set();

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
      // Flush pending subscriptions
      for (const jobId of this.pendingSubscriptions) {
        this.ws!.send(JSON.stringify({ type: 'subscribe:job', jobId }));
        this.activeSubscriptions.add(jobId);
      }
      this.pendingSubscriptions.clear();
      // Re-subscribe to active jobs (on reconnect)
      for (const jobId of this.activeSubscriptions) {
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

      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.projectId) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
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
    this.pendingSubscriptions.clear();
    this.activeSubscriptions.clear();
  }

  subscribeToJob(jobId: string): void {
    this.activeSubscriptions.add(jobId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe:job', jobId }));
    } else {
      // Queue for when connection opens
      this.pendingSubscriptions.add(jobId);
    }
  }

  unsubscribeFromJob(jobId: string): void {
    this.activeSubscriptions.delete(jobId);
    this.pendingSubscriptions.delete(jobId);
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
