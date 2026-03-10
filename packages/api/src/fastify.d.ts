import 'fastify';
import type { User } from './db/index.js';
import type { StytchSession } from './services/stytch.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    stytchSession?: StytchSession;
  }
}
