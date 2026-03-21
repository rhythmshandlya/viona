/**
 * Quick validation of cover-transform math.
 * Run: npx tsx scripts/temp/test-cover-transform.ts
 */

// Inline the functions to test without import resolution issues
function computeCoverTransform(
  srcW: number, srcH: number,
  itemW: number, itemH: number,
  cropX = 50, cropY = 50, cropScale = 1,
) {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const offsetX = (renderedW - itemW) * (cropX / 100);
  const offsetY = (renderedH - itemH) * (cropY / 100);
  return { baseCoverScale, renderedW, renderedH, offsetX, offsetY, cropScale, itemW, itemH };
}

function sourceToCanvas(
  sourceX: number, sourceY: number,
  transform: ReturnType<typeof computeCoverTransform>,
  itemX = 0, itemY = 0,
) {
  const elementX = sourceX * transform.baseCoverScale - transform.offsetX;
  const elementY = sourceY * transform.baseCoverScale - transform.offsetY;
  return {
    x: itemX + (elementX - transform.itemW / 2) * transform.cropScale + transform.itemW / 2,
    y: itemY + (elementY - transform.itemH / 2) * transform.cropScale + transform.itemH / 2,
  };
}

function computeCenterCrop(
  faceCenterX: number, faceCenterY: number,
  srcW: number, srcH: number,
  itemW: number, itemH: number,
) {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const deltaW = renderedW - itemW;
  const deltaH = renderedH - itemH;
  const cropX = deltaW > 0.5
    ? (faceCenterX * baseCoverScale - itemW / 2) / deltaW * 100
    : 50;
  const cropY = deltaH > 0.5
    ? (faceCenterY * baseCoverScale - itemH / 2) / deltaH * 100
    : 50;
  return {
    x: Math.max(0, Math.min(100, cropX)),
    y: Math.max(0, Math.min(100, cropY)),
  };
}

// --- Tests ---
let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  PASS: ${msg}`); }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

function approx(a: number, b: number, eps = 1) {
  return Math.abs(a - b) < eps;
}

// Test 1: Landscape (1920x1080) into portrait canvas (1080x1920)
console.log('Test 1: Landscape → portrait, default crop');
{
  const t = computeCoverTransform(1920, 1080, 1080, 1920);
  assert(approx(t.baseCoverScale, 1.778, 0.01), `coverScale=${t.baseCoverScale.toFixed(3)}`);
  const p = sourceToCanvas(960, 540, t);
  assert(approx(p.x, 540, 2), `center X=${p.x.toFixed(0)} (expected ~540)`);
  assert(approx(p.y, 960, 2), `center Y=${p.y.toFixed(0)} (expected ~960)`);
}

// Test 2: Same aspect ratio — no cropping
console.log('Test 2: Same aspect ratio (1920x1080 → 1920x1080)');
{
  const t = computeCoverTransform(1920, 1080, 1920, 1080);
  assert(approx(t.baseCoverScale, 1, 0.01), `coverScale=${t.baseCoverScale}`);
  const p = sourceToCanvas(100, 200, t);
  assert(approx(p.x, 100, 1), `X=${p.x} (expected 100)`);
  assert(approx(p.y, 200, 1), `Y=${p.y} (expected 200)`);
}

// Test 3: computeCenterCrop — speaker at left of landscape video
console.log('Test 3: computeCenterCrop — speaker off-center left');
{
  const crop = computeCenterCrop(400, 540, 1920, 1080, 1080, 1920);
  const t = computeCoverTransform(1920, 1080, 1080, 1920, crop.x, crop.y);
  const p = sourceToCanvas(400, 540, t);
  assert(approx(p.x, 540, 5), `centered X=${p.x.toFixed(0)} (expected ~540)`);
  assert(approx(p.y, 960, 5), `centered Y=${p.y.toFixed(0)} (expected ~960)`);
  assert(crop.x >= 0 && crop.x <= 100, `cropX=${crop.x.toFixed(1)} in range`);
}

// Test 4: computeCenterCrop — division by zero edge case
console.log('Test 4: computeCenterCrop — matching aspect ratio');
{
  const crop = computeCenterCrop(960, 540, 1920, 1080, 1920, 1080);
  assert(crop.x === 50, `cropX=${crop.x} (expected 50)`);
  assert(crop.y === 50, `cropY=${crop.y} (expected 50)`);
}

// Test 5: sourceToCanvas with crop.scale > 1
console.log('Test 5: crop.scale zoom from center');
{
  const t = computeCoverTransform(1920, 1080, 1080, 1920, 50, 50, 1.5);
  const center = sourceToCanvas(960, 540, t);
  assert(approx(center.x, 540, 5), `zoom center X=${center.x.toFixed(0)} (expected ~540)`);
  const corner = sourceToCanvas(0, 0, t);
  const noZoom = sourceToCanvas(0, 0, computeCoverTransform(1920, 1080, 1080, 1920, 50, 50, 1));
  assert(corner.x < noZoom.x, `zoom pushes left point further left: ${corner.x.toFixed(0)} < ${noZoom.x.toFixed(0)}`);
}

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
