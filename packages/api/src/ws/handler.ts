import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { redisSub, CHANNELS } from '../services/redis.js';
import { validateSession, validateSessionJwt } from '../services/stytch.js';
import { db, users, projects } from '../db/index.js';
import { logger } from '../logger.js';

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
        // Activity events are published on the :progress channel with _type: 'activity'.
        // Route them as job:activity so the frontend can handle them separately.
        type = data._type === 'activity' ? 'job:activity' : 'job:progress';
      } else if (channel.includes(':workspace:ready')) {
        type = 'workspace:ready';
      } else if (channel.includes(':manifest:updated')) {
        type = 'manifest:updated';
      } else if (channel.includes(':bundle:ready')) {
        type = 'bundle:ready';
      } else if (channel.includes(':bundle:error')) {
        type = 'bundle:error';
      } else if (channel.includes(':workspace:lock_acquired')) {
        type = 'workspace:lock_acquired';
      } else if (channel.includes(':workspace:lock_released')) {
        type = 'workspace:lock_released';
      } else if (channel.includes(':workspace:teardown')) {
        type = 'workspace:teardown';
      } else if (channel.includes(':complete')) {
        type = 'job:complete';
      } else if (channel.includes(':error')) {
        type = 'job:error';
      } else if (channel.includes(':health')) {
        type = 'job:health';
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

        // Check if this connection is interested in this message.
        // Job events require explicit subscription (subscribe:job) to prevent
        // plan-visuals completion events from triggering false "visuals ready" messages.
        // Project-level events (project:updated) still use projectId matching.
        const isJobEvent = type.startsWith('job:');
        const isRelevant = isJobEvent
          ? (data.jobId && conn.jobIds.has(data.jobId))
          : (data.projectId && conn.projectId === data.projectId);

        if (isRelevant) {
          socket.send(JSON.stringify({ type, payload: data }));
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error processing Redis message');
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

    // Reject if no owner (legacy) or wrong owner
    if (!project.userId || project.userId !== user.id) {
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

    logger.info({ projectId, userId: user.id }, 'WebSocket connected');

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
        logger.error({ err }, 'Error parsing WebSocket message');
      }
    });

    // Handle disconnection
    socket.on('close', () => {
      connections.delete(socket);
      logger.info({ projectId }, 'WebSocket disconnected');
    });

    socket.on('error', (err: Error) => {
      logger.error({ err }, 'WebSocket error');
      connections.delete(socket);
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      payload: { projectId },
    }));
  });
}
