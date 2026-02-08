import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { redisSub, CHANNELS } from '../services/redis.js';
import { validateSession, validateSessionJwt } from '../services/stytch.js';
import { db, users, projects } from '../db/index.js';

interface WSConnection {
  socket: WebSocket;
  projectId: string;
  userId?: string;
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
      } else if (channel.includes(':logs')) {
        type = 'job:logs';
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
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    const token = url.searchParams.get('token');

    if (!projectId) {
      socket.close(4000, 'projectId is required');
      return;
    }

    if (!token) {
      socket.close(4001, 'Authentication token is required');
      return;
    }

    // Validate session token
    const isJwt = token.startsWith('eyJ');
    const session = isJwt
      ? await validateSessionJwt(token)
      : await validateSession(token);

    if (!session) {
      socket.close(4002, 'Invalid or expired session');
      return;
    }

    // Find user in our database
    const user = await db.query.users.findFirst({
      where: eq(users.stytchUserId, session.userId),
    });

    if (!user) {
      socket.close(4003, 'User not found');
      return;
    }

    // Verify user owns this project
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      socket.close(4004, 'Project not found');
      return;
    }

    // Allow access if project has no owner (legacy) or user owns it
    if (project.userId && project.userId !== user.id) {
      socket.close(4005, 'Access denied');
      return;
    }

    // Track this connection
    const conn: WSConnection = {
      socket,
      projectId,
      userId: user.id,
      jobIds: new Set(),
    };
    connections.set(socket, conn);

    console.log(`WebSocket connected for project: ${projectId}, user: ${user.id}`);

    // Handle incoming messages
    socket.on('message', (rawMessage: Buffer) => {
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

    socket.on('error', (err: Error) => {
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
