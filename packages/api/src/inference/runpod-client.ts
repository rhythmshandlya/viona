import { config } from '../config.js';
import { logger } from '../logger.js';

const BASE = 'https://api.runpod.ai/v2';

interface RunPodSubmitRequest {
  input: Record<string, unknown>;
  webhook?: string;
  policy?: { executionTimeout?: number };
}

interface RunPodSubmitResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface RunPodStatusResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  output?: Record<string, unknown>;
  error?: string;
  executionTime?: number;
  delayTime?: number;
}

function authHeaders(): Record<string, string> {
  if (!config.runpod.apiKey) throw new Error('RUNPOD_API_KEY is not set');
  return {
    Authorization: `Bearer ${config.runpod.apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function runpodSubmit(
  endpointId: string,
  body: RunPodSubmitRequest,
): Promise<RunPodSubmitResponse> {
  const res = await fetch(`${BASE}/${endpointId}/run`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ endpointId, status: res.status, text }, 'RunPod /run failed');
    throw new Error(`RunPod submit failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RunPodSubmitResponse;
}

export async function runpodStatus(
  endpointId: string,
  runpodJobId: string,
): Promise<RunPodStatusResponse> {
  const res = await fetch(`${BASE}/${endpointId}/status/${runpodJobId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod status failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RunPodStatusResponse;
}

export async function runpodCancel(endpointId: string, runpodJobId: string): Promise<void> {
  const res = await fetch(`${BASE}/${endpointId}/cancel/${runpodJobId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`RunPod cancel failed: ${res.status} ${text}`);
  }
}

export function isTerminal(status: RunPodStatusResponse['status']): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT';
}
