import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';

interface WebhookClaims extends JWTPayload {
  jobId: string;
  capability: string;
}

function getSecret(): Uint8Array {
  if (!config.runpod.webhookSecret) throw new Error('RUNPOD_WEBHOOK_SECRET is not set');
  return new TextEncoder().encode(config.runpod.webhookSecret);
}

/**
 * Issue a scoped JWT for a RunPod webhook callback.
 * Expires at submittedAt + executionTimeoutSec + 60s grace.
 */
export async function issueWebhookToken(
  jobId: string,
  capability: string,
  executionTimeoutSec: number,
): Promise<string> {
  return new SignJWT({ jobId, capability })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${executionTimeoutSec + 60}s`)
    .sign(getSecret());
}

/**
 * Verify a webhook token. Throws if invalid, expired, or mismatched.
 * Returns the payload on success.
 */
export async function verifyWebhookToken(
  token: string,
  expectedJobId: string,
  expectedCapability: string,
): Promise<WebhookClaims> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
  const claims = payload as WebhookClaims;
  if (claims.jobId !== expectedJobId) throw new Error('webhook: jobId mismatch');
  if (claims.capability !== expectedCapability) throw new Error('webhook: capability mismatch');
  return claims;
}
