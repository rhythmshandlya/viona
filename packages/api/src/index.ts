import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';
import { config } from './config.js';
import { ensureBuckets, getObjectStream, objectExists, listObjects } from './services/minio.js';
import { projectRoutes } from './routes/projects.js';
import { userRoutes } from './routes/users.js';
import { agentRoutes } from './agent/agent-router.js';
import { setupWebSocket } from './ws/handler.js';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

/**
 * Create Claude credentials file from environment variables.
 * The Claude CLI (spawned by Agent SDK) reads credentials from ~/.claude/.credentials.json
 */
function setupClaudeCredentials(): void {
  const accessToken = process.env.CLAUDE_OAUTH_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('No CLAUDE_OAUTH_ACCESS_TOKEN set, skipping Claude credentials setup');
    return;
  }

  const claudeDir = join(homedir(), '.claude');
  const credentialsPath = join(claudeDir, '.credentials.json');

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  const credentials = {
    claudeAiOauth: {
      accessToken,
      refreshToken: process.env.CLAUDE_OAUTH_REFRESH_TOKEN || null,
      expiresAt: process.env.CLAUDE_OAUTH_EXPIRES_AT
        ? parseInt(process.env.CLAUDE_OAUTH_EXPIRES_AT, 10)
        : null,
      scopes: ['user:inference', 'user:profile'],
      subscriptionType: process.env.CLAUDE_SUBSCRIPTION_TYPE || 'max',
    },
  };

  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  console.log(`Claude credentials file created at ${credentialsPath}`);
}

async function main() {
  if (isProduction && !process.env.COOKIE_SECRET) {
    console.error('FATAL: COOKIE_SECRET must be set in production. Exiting.');
    process.exit(1);
  }

  const fastify = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: isProduction
      ? (config.corsOrigin ? config.corsOrigin.split(',') : true)
      : true,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'cllipify-dev-secret-change-in-production',
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max file size
    },
  });

  await fastify.register(websocket);

  // Serve bundles statically (local development only)
  // In production (Railway), bundles are on separate worker containers
  if (!isProduction) {
    if (!existsSync(config.bundles.dir)) {
      mkdirSync(config.bundles.dir, { recursive: true });
    }
    await fastify.register(fastifyStatic, {
      root: config.bundles.dir,
      prefix: '/bundles/',
      decorateReply: false,
    });
    fastify.log.info(`Serving bundles from: ${config.bundles.dir}`);
  }

  // Production bundle serving from S3
  // Route: /api/bundles/:compositionId/*
  fastify.get('/api/bundles/:compositionId/*', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };
    const filePath = (request.params as { '*': string })['*'] || 'index.html';

    // Construct S3 key: outputs/bundles/{compositionId}/{filePath}
    const s3Key = `bundles/${compositionId}/${filePath}`;

    try {
      // Check if file exists
      const exists = await objectExists('outputs', s3Key);
      if (!exists) {
        return reply.code(404).send({ error: 'Bundle file not found' });
      }

      // Get content type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const contentTypes: Record<string, string> = {
        'html': 'text/html',
        'js': 'application/javascript',
        'cjs': 'application/javascript',
        'mjs': 'application/javascript',
        'css': 'text/css',
        'json': 'application/json',
        'map': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // Stream file from S3
      const stream = await getObjectStream('outputs', s3Key);
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err, compositionId, filePath }, 'Failed to serve bundle');
      return reply.code(500).send({ error: 'Failed to serve bundle' });
    }
  });

  // Production source files serving from S3
  // Route: /api/sources/:compositionId/*
  // These are the source project files (index.tsx, metadata.json, etc.) for AI context restoration
  fastify.get('/api/sources/:compositionId/*', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };
    const filePath = (request.params as { '*': string })['*'] || 'index.tsx';

    // Construct S3 key: outputs/sources/{compositionId}/{filePath}
    const s3Key = `sources/${compositionId}/${filePath}`;

    try {
      // Check if file exists
      const exists = await objectExists('outputs', s3Key);
      if (!exists) {
        return reply.code(404).send({ error: 'Source file not found' });
      }

      // Get content type based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const contentTypes: Record<string, string> = {
        'tsx': 'text/typescript',
        'ts': 'text/typescript',
        'jsx': 'text/javascript',
        'js': 'application/javascript',
        'json': 'application/json',
        'css': 'text/css',
      };

      const contentType = contentTypes[ext] || 'text/plain';
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Stream file from S3
      const stream = await getObjectStream('outputs', s3Key);
      return reply.send(stream);
    } catch (err) {
      fastify.log.error({ err, compositionId, filePath }, 'Failed to serve source file');
      return reply.code(500).send({ error: 'Failed to serve source file' });
    }
  });

  // List all source files for a composition (for restoring AI context)
  fastify.get('/api/sources/:compositionId', async (request, reply) => {
    const { compositionId } = request.params as { compositionId: string };

    try {
      // List all files in the source directory
      const rawFiles = await listObjects('outputs', `sources/${compositionId}/`);
      const files = rawFiles.map(f => f.replace(`sources/${compositionId}/`, ''));

      // Categorize files for AI context restoration
      const planFiles = files.filter(f => f.endsWith('.md') || f === 'scenes.json');
      const codeFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
      const configFiles = files.filter(f => f.endsWith('.json') && f !== 'scenes.json');

      return {
        compositionId,
        files,
        categories: {
          // AI planning context - Director's plan and implementation log
          planning: planFiles,
          // Source code - compositions, scenes, components
          code: codeFiles,
          // Configuration - metadata, etc.
          config: configFiles,
        },
        // Suggested restore order for AI context
        restoreOrder: [
          'SCENE_PLAN.md',           // Director's visual story plan
          'IMPLEMENTATION_LOG.md',   // Implementation decisions
          'scenes.json',             // Scene definitions
          'metadata.json',           // Composition metadata
          'constants.ts',            // Colors, timing configs
          'index.tsx',               // Main composition
          ...files.filter(f => f.startsWith('components/')),
          ...files.filter(f => f.startsWith('scenes/')),
        ].filter(f => files.includes(f)),
      };
    } catch (err) {
      fastify.log.error({ err, compositionId }, 'Failed to list source files');
      return reply.code(500).send({ error: 'Failed to list source files' });
    }
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Debug: test claude subprocess
  fastify.get('/debug/claude-test', async (_request, reply) => {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('claude', ['-p', 'say hello in 5 words', '--output-format', 'text'], {
        env: { ...process.env, CLAUDECODE: undefined },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code: number) => {
        reply.send({ code, stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) });
        resolve(undefined);
      });
      setTimeout(() => { proc.kill(); reply.send({ error: 'timeout' }); resolve(undefined); }, 15000);
    });
  });

  // Register routes
  await fastify.register(projectRoutes, { prefix: '/api' });
  await fastify.register(userRoutes, { prefix: '/api' });
  await fastify.register(agentRoutes, { prefix: '/api' });

  // Setup WebSocket
  await setupWebSocket(fastify);

  // Ensure storage bucket exists
  try {
    await ensureBuckets();
    fastify.log.info('Storage bucket ready');
  } catch (err) {
    fastify.log.error(err, 'Failed to ensure storage bucket');
    // Continue anyway, bucket might already exist
  }

  // Set up Claude CLI credentials from env vars (Agent SDK spawns claude subprocess)
  setupClaudeCredentials();

  // Verify Claude CLI is available for Agent SDK
  try {
    const claudeVersion = execSync('claude --version 2>&1', { encoding: 'utf-8', timeout: 10000 }).trim();
    fastify.log.info(`Claude CLI available: ${claudeVersion}`);
  } catch (err: any) {
    fastify.log.error(`Claude CLI check failed: ${err.message}\nstdout: ${err.stdout}\nstderr: ${err.stderr}`);
  }

  // Start server
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
