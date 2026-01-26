import { FastifyInstance } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { redisSub, CHANNELS } from '../services/redis.js';

interface WSConnection {
  socket: WebSocket;
  projectId: string;
  jobIds: Set<string>;
}

const connections = new Map<WebSocket, WSConnection>();

export async function setupWebSocket(fastify: FastifyInstance) {
  // Track active subscriptions
  const activeChannels = new Set<string>();

  // Handle Redis messages
  redisSub.on('pmessage', (pattern, channel, message) => {
    try {
      const data = JSON.parse(message);

      // Determine message type from channel
      let type: string;
      if (channel.includes(':progress')) {
        type = 'job:progress';
      } else if (channel.includes(':complete')) {
        type = 'job:complete';
      } else if (channel.includes(':error')) {
        type = 'job:error';
      } else if (channel.includes(':updated')) {
        type = 'project:updated';
      } else {
        return;
      }

      // Broadcast to relevant connections
      for (const [socket, conn] of connections) {
        if (socket.readyState !== WebSocket.OPEN) continue;

        // Check if this connection is interested in this message
        const isRelevant =
          (data.projectId && conn.projectId === data.projectId) ||
          (data.jobId && conn.jobIds.has(data.jobId));

        if (isRelevant) {
          socket.send(JSON.stringify({ type, payload: data }));
        }
      }
    } catch (err) {
      console.error('Error processing Redis message:', err);
    }
  });

  // Subscribe to job and project channels
  await redisSub.psubscribe('job:*:*', 'project:*:*');

  // WebSocket route
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      socket.close(4000, 'projectId is required');
      return;
    }

    // Track this connection
    const conn: WSConnection = {
      socket,
      projectId,
      jobIds: new Set(),
    };
    connections.set(socket, conn);

    console.log(`WebSocket connected for project: ${projectId}`);

    // Handle incoming messages
    socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        // Handle subscription to specific jobs
        if (message.type === 'subscribe:job' && message.jobId) {
          conn.jobIds.add(message.jobId);
        }

        if (message.type === 'unsubscribe:job' && message.jobId) {
          conn.jobIds.delete(message.jobId);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    });

    // Handle disconnection
    socket.on('close', () => {
      connections.delete(socket);
      console.log(`WebSocket disconnected for project: ${projectId}`);
    });

    socket.on('error', (err) => {
      console.error('WebSocket error:', err);
      connections.delete(socket);
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      payload: { projectId },
    }));
  });
}
