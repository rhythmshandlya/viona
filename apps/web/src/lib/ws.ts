const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export type WSMessageType =
  | 'connected'
  | 'job:progress'
  | 'job:complete'
  | 'job:error'
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

type MessageHandler = (message: WSMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(projectId: string): void {
    if (this.ws && this.projectId === projectId) {
      return; // Already connected to this project
    }

    this.disconnect();
    this.projectId = projectId;

    const url = `${WS_URL}/ws?projectId=${projectId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
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
  }

  subscribeToJob(jobId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe:job', jobId }));
    }
  }

  unsubscribeFromJob(jobId: string): void {
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
