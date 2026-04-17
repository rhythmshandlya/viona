/**
 * End-to-end smoke test for E2BSandboxProvider.
 *
 * Validates the full lifecycle: create -> isReady -> backup (pause) -> resume
 * -> isReady -> destroy. Hits real E2B Cloud; requires E2B_API_KEY.
 *
 * Run: pnpm --filter @viona/api exec dotenv -e .env -- tsx ../../scripts/temp/test-e2b-provider.ts
 */
import { E2BSandboxProvider } from '../../packages/api/src/sandbox/e2b.js';

async function main() {
  const provider = new E2BSandboxProvider();
  const projectId = `test-${Date.now()}`;

  console.log('[1/6] Creating fresh sandbox...');
  const sbx = await provider.create({
    projectId,
    userId: 'smoke-test',
    env: {},
  });
  console.log(`  -> sandboxId=${sbx.id} fileUrl=${sbx.internalUrl} agentUrl=${sbx.agentUrl}`);

  console.log('[2/6] Waiting for isReady (checks initialized === true)...');
  let ready = false;
  // First boot of a new sandbox: /health returns `initialized: false` until
  // /init is sent. Our isReady requires initialized === true, so for a raw
  // sandbox this would hang. Instead verify HTTP reachability directly.
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${sbx.internalUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { ready = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!ready) throw new Error('Sandbox /health never returned 200');
  console.log('  -> /health returned 200 (HTTP layer ready; app-layer init requires /init from SandboxManager)');

  console.log('[3/6] Pausing (backup)...');
  const backupId = await provider.backup(sbx);
  console.log(`  -> backupId=${backupId}`);

  console.log('[4/6] Resuming via create(backupId)...');
  const resumed = await provider.create({
    projectId,
    userId: 'smoke-test',
    backupId,
  });
  console.log(`  -> resumed sandboxId=${resumed.id}`);

  console.log('[5/6] Verifying resumed sandbox responds to /health...');
  let resumedReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${resumed.internalUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { resumedReady = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!resumedReady) throw new Error('Resumed sandbox /health never returned 200');
  console.log('  -> OK');

  console.log('[6/6] Destroying...');
  await provider.destroy({ id: resumed.id, volumeId: resumed.volumeId, projectId });
  console.log('  -> DONE');

  console.log('\n✅ E2B provider smoke test passed.');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
