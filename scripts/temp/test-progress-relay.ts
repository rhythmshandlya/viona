// scripts/temp/test-progress-relay.ts
// Manual E2E test — run against a live sandbox session
//
// Usage: npx tsx scripts/temp/test-progress-relay.ts <projectId> [apiBaseUrl]
//
// Verifies:
// 1. Progress blocks are persisted in conversation_messages
// 2. GET /conversation returns the progress block on reload

const [projectId, apiBase = 'http://localhost:3001'] = process.argv.slice(2);
if (!projectId) {
  console.error('Usage: npx tsx scripts/temp/test-progress-relay.ts <projectId> [apiBaseUrl]');
  process.exit(1);
}

async function main() {
  // 1. Fetch conversation to see current state
  const convRes = await fetch(`${apiBase}/api/projects/${projectId}/agent/conversation`, {
    credentials: 'include',
  });

  if (!convRes.ok) {
    console.error(`Failed to fetch conversation: ${convRes.status} ${convRes.statusText}`);
    process.exit(1);
  }

  const conv = await convRes.json();
  console.log(`Conversation has ${conv.messages?.length ?? 0} messages`);

  // 2. Check last assistant message for progress blocks
  const lastAssistant = [...(conv.messages || [])].reverse().find((m: any) => m.role === 'assistant');
  if (!lastAssistant) {
    console.log('No assistant messages found — run a generation first');
    process.exit(0);
  }

  const blocks = lastAssistant.content as Array<{ type: string; phase?: string; percent?: number; message?: string }>;
  const progressBlocks = blocks.filter(b => b.type === 'progress');
  const textBlocks = blocks.filter(b => b.type === 'text');
  const widgetBlocks = blocks.filter(b => b.type === 'widget');

  console.log(`\nLast assistant message content blocks:`);
  console.log(`  Text blocks:     ${textBlocks.length}`);
  console.log(`  Widget blocks:   ${widgetBlocks.length}`);
  console.log(`  Progress blocks: ${progressBlocks.length}`);

  if (progressBlocks.length > 0) {
    console.log(`\nProgress block:`);
    console.log(JSON.stringify(progressBlocks[0], null, 2));
    console.log('\n✅ Progress relay is working — block persisted in DB');
  } else {
    console.log('\n⚠️  No progress blocks found in last assistant message');
    console.log('This is expected if the last turn did not trigger report_progress.');
    console.log('Run a generation (Phase 3) and check again.');
  }
}

main().catch(console.error);
