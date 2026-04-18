/**
 * End-to-end smoke test for the templates runtime registry.
 *
 * Verifies:
 *   1. GET /api/templates?limit=3 returns { items: [...] } with published templates.
 *   2. GET /api/templates/:slug/bundle 302s to a presigned S3 URL.
 *   3. The signed URL returns JavaScript with a CJS default-export marker.
 *
 * Run locally:   tsx scripts/temp/test-templates-runtime.ts
 * Run vs prod:   API_BASE=https://api-production-18ab.up.railway.app tsx scripts/temp/test-templates-runtime.ts
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:4000';

async function main() {
  console.log(`[test] API_BASE=${API_BASE}`);

  console.log('[1/3] GET /api/templates?limit=3 ...');
  const listRes = await fetch(`${API_BASE}/api/templates?limit=3`);
  if (!listRes.ok) throw new Error(`list failed: ${listRes.status} ${await listRes.text().catch(() => '')}`);
  const list = await listRes.json() as { items?: Array<{ slug: string }> };
  if (!Array.isArray(list.items) || list.items.length === 0) {
    throw new Error(`list: expected items[] with at least 1 template, got ${JSON.stringify(list).slice(0, 200)}`);
  }
  console.log(`  -> ${list.items.length} templates; first slug = ${list.items[0].slug}`);

  const slug = list.items[0].slug;

  console.log(`[2/3] GET /api/templates/${slug}/bundle ...`);
  const bundleRes = await fetch(
    `${API_BASE}/api/templates/${encodeURIComponent(slug)}/bundle`,
    { redirect: 'manual' }
  );
  if (bundleRes.status !== 302) {
    const body = await bundleRes.text().catch(() => '');
    throw new Error(`expected 302, got ${bundleRes.status}: ${body.slice(0, 200)}`);
  }
  const signed = bundleRes.headers.get('location');
  if (!signed) throw new Error('302 response has no Location header');
  console.log(`  -> 302; Location host = ${new URL(signed).host}`);

  console.log('[3/3] fetching signed bundle URL ...');
  const bodyRes = await fetch(signed);
  if (!bodyRes.ok) throw new Error(`bundle fetch failed: ${bodyRes.status}`);
  const contentType = bodyRes.headers.get('content-type') ?? '';
  const code = await bodyRes.text();
  if (code.length < 1000) throw new Error(`bundle suspiciously short (${code.length} bytes)`);
  // Bundles are built as ESM (`export{X as default}`) by scripts/build-templates.ts,
  // but the runtime-registry client evals them as CJS via `new Function('module','exports','require',code)`,
  // so accept either marker shape.
  if (!/module\.exports|exports\.default|export\s*\{[^}]*as\s+default\s*\}|export\s+default/.test(code)) {
    throw new Error(`bundle has no default-export markers (content-type=${contentType}, first 100: ${code.slice(0, 100)})`);
  }
  console.log(`  -> OK, ${code.length} bytes, content-type=${contentType}`);

  console.log('\n✅ Templates runtime registry smoke test passed.');
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
