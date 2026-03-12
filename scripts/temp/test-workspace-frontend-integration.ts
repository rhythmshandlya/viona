/**
 * Workspace Frontend Integration Smoke Test
 *
 * Prerequisites: API server running on localhost:4000 with Redis + DB
 * Run: npx tsx scripts/temp/test-workspace-frontend-integration.ts
 */

const API_URL = 'http://localhost:4000';

const PROJECT_ID = process.env.TEST_PROJECT_ID || 'test';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

async function fetchApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('=== Workspace Frontend Integration Test ===\n');

  if (!AUTH_TOKEN) {
    console.log('Skipping (no TEST_AUTH_TOKEN set). Set TEST_PROJECT_ID and TEST_AUTH_TOKEN to run.');
    console.log('This test requires a running API server with valid auth.');
    return;
  }

  // 1. Spin up workspace
  console.log('1. Spinning up workspace...');
  const ws = await fetchApi(`/api/projects/${PROJECT_ID}/workspace`, { method: 'POST' });
  console.log(`   Status: ${ws.workspaceStatus}`);
  console.log(`   Manifest tracks: ${ws.manifest?.tracks?.length ?? 'N/A'}`);
  console.log(`   Manifest items: ${ws.manifest?.items?.length ?? 'N/A'}`);

  // 2. Read manifest
  console.log('\n2. Reading manifest...');
  const manifest = await fetchApi(`/api/projects/${PROJECT_ID}/workspace/manifest`);
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Duration: ${manifest.durationMs}ms`);

  // 3. Check lock status
  console.log('\n3. Checking lock status...');
  const lock = await fetchApi(`/api/projects/${PROJECT_ID}/workspace/lock`);
  console.log(`   Locked: ${lock.locked}`);

  // 4. Tear down
  console.log('\n4. Tearing down workspace...');
  const td = await fetchApi(`/api/projects/${PROJECT_ID}/workspace`, { method: 'DELETE' });
  console.log(`   Status: ${td.status}`);

  console.log('\n=== All checks passed ===');
}

main().catch(console.error);
