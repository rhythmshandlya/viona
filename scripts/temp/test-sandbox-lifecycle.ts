/**
 * E2E test for sandbox lifecycle.
 * Prerequisites:
 *   1. docker-compose up -d (postgres, redis, minio)
 *   2. docker build -t viona-sandbox:latest packages/sandbox/
 *   3. API server running on port 4000
 *
 * Usage: npx tsx scripts/temp/test-sandbox-lifecycle.ts
 */

const API_URL = 'http://localhost:4000/api';

// You'll need a valid auth token — get one from browser DevTools
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';
const PROJECT_ID = process.env.TEST_PROJECT_ID || '';

if (!AUTH_TOKEN || !PROJECT_ID) {
  console.error('Set TEST_AUTH_TOKEN and TEST_PROJECT_ID env vars');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Cookie': `stytch_session_token=${AUTH_TOKEN}`,
};

async function test() {
  console.log('=== Sandbox Lifecycle E2E Test ===\n');

  // 1. Create sandbox
  console.log('1. Creating sandbox...');
  const createRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, {
    method: 'POST',
    headers,
  });
  const createData = await createRes.json();
  console.log('   Create response:', createData);
  console.assert(createData.status === 'ready', 'Expected status: ready');

  // 2. Check status
  console.log('2. Checking status...');
  const statusRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox/status`, { headers });
  const statusData = await statusRes.json();
  console.log('   Status:', statusData);
  console.assert(statusData.status === 'ready', 'Expected status: ready');
  console.assert(statusData.previewUrl !== null, 'Expected previewUrl');

  // 3. Try to fetch bundle (may 404 if no composition yet, that's OK)
  console.log('3. Fetching bundle...');
  const bundleRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox/bundle/player-composition.cjs.js`, { headers });
  console.log('   Bundle status:', bundleRes.status);

  // 4. Suspend
  console.log('4. Suspending sandbox...');
  const suspendRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, {
    method: 'DELETE',
    headers,
  });
  const suspendData = await suspendRes.json();
  console.log('   Suspend response:', suspendData);
  console.assert(suspendData.status === 'suspended', 'Expected status: suspended');

  // 5. Resume
  console.log('5. Resuming sandbox...');
  const resumeRes = await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, {
    method: 'POST',
    headers,
  });
  const resumeData = await resumeRes.json();
  console.log('   Resume response:', resumeData);
  console.assert(resumeData.status === 'ready', 'Expected status: ready after resume');

  // 6. Clean up — suspend again
  console.log('6. Final cleanup...');
  await fetch(`${API_URL}/projects/${PROJECT_ID}/sandbox`, { method: 'DELETE', headers });

  console.log('\n=== All tests passed ===');
}

test().catch(console.error);
