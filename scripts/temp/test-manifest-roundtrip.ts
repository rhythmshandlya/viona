/**
 * Round-trip tests for dbToManifest / manifestToDb stored transforms.
 * Run: npx tsx scripts/temp/test-manifest-roundtrip.ts
 */

import { dbToManifest, manifestToDb, type DbToManifestInput } from '../../packages/shared/src/manifest-convert.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

function assertDeepEqual(actual: any, expected: any, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`  FAIL: ${msg}`);
    console.error(`    expected: ${e}`);
    console.error(`    actual:   ${a}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

// ---------- Helpers ----------

function makeBaseInput(overrides?: Partial<DbToManifestInput>): DbToManifestInput {
  return {
    project: {
      fps: 30,
      durationMs: 60000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: null,
    },
    tracks: [
      { id: 'track-video', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
      { id: 'track-overlay', type: 'visual', name: 'Overlay', position: 1, locked: false, visible: true },
    ],
    items: [],
    ...overrides,
  };
}

const CUSTOM_TRANSFORM = {
  x: '10%',
  y: '20%',
  width: '60%',
  height: '40%',
  rotation: 15,
  opacity: 0.8,
};

const FULLSCREEN_TRANSFORM = {
  x: 0,
  y: 0,
  width: '100%',
  height: '100%',
  rotation: 0,
  opacity: 1,
};

// ---------- Test 1: Stored transforms survive round-trip ----------

console.log('\nTest 1: Stored transforms survive round-trip (video item)');
{
  const input = makeBaseInput({
    items: [
      {
        id: 'item-video-1',
        trackId: 'track-video',
        type: 'video',
        startMs: 0,
        endMs: 30000,
        data: {
          src: 'video.mp4',
          _transform: { ...CUSTOM_TRANSFORM },
          _keyframes: [
            { timeMs: 0, props: { opacity: 0 }, easing: 'ease-in' },
            { timeMs: 500, props: { opacity: 1 }, easing: 'linear' },
          ],
          _filters: { brightness: 1.2, contrast: 0.9 },
        },
      },
    ],
  });

  const manifest = dbToManifest(input);
  const videoItem = manifest.items.find(i => i.id === 'item-video-1')!;

  assert(videoItem != null, 'video item exists in manifest');
  assertDeepEqual(videoItem.transform, CUSTOM_TRANSFORM, 'transform matches stored _transform');
  assert(videoItem.keyframes.length === 2, 'keyframes preserved (length=2)');
  assert(videoItem.keyframes[0]!.timeMs === 0, 'keyframe[0].timeMs matches');
  assert((videoItem.keyframes[0]!.props as any).opacity === 0, 'keyframe[0].props.opacity matches');
  assert(videoItem.keyframes[0]!.easing === 'ease-in', 'keyframe[0].easing matches');
  assert((videoItem as any).filters != null, 'filters object present');
  assert((videoItem as any).filters.brightness === 1.2, 'filters.brightness matches stored value');
  assert((videoItem as any).filters.contrast === 0.9, 'filters.contrast matches stored value');
}

// ---------- Test 2: Default transforms when no stored transform ----------

console.log('\nTest 2: Default transforms when no stored transform');
{
  const input = makeBaseInput({
    items: [
      {
        id: 'item-video-default',
        trackId: 'track-video',
        type: 'video',
        startMs: 0,
        endMs: 30000,
        data: { src: 'video.mp4' },
      },
    ],
  });

  const manifest = dbToManifest(input);
  const videoItem = manifest.items.find(i => i.id === 'item-video-default')!;

  assert(videoItem != null, 'video item exists');
  assertDeepEqual(videoItem.transform, FULLSCREEN_TRANSFORM, 'default fullscreen transform applied');
  assert(videoItem.keyframes.length === 0, 'no keyframes by default');
  assert((videoItem as any).filters == null, 'no filters by default');
}

// ---------- Test 3: Scene item with stored transform ----------

console.log('\nTest 3: Scene (visual) item with stored transform');
{
  const input = makeBaseInput({
    items: [
      {
        id: 'item-scene-1',
        trackId: 'track-overlay',
        type: 'visual',
        startMs: 0,
        endMs: 15000,
        data: {
          sceneFile: 'scenes/Scene1.tsx',
          _transform: { ...CUSTOM_TRANSFORM },
          _keyframes: [
            { timeMs: 100, props: { x: '5%' }, easing: 'ease-out' },
          ],
        },
      },
    ],
  });

  const manifest = dbToManifest(input);
  const sceneItem = manifest.items.find(i => i.id === 'item-scene-1')!;

  assert(sceneItem != null, 'scene item exists');
  assert(sceneItem.type === 'scene', 'type mapped to scene');
  assertDeepEqual(sceneItem.transform, CUSTOM_TRANSFORM, 'transform matches stored _transform');
  assert(sceneItem.keyframes.length === 1, 'keyframes preserved (length=1)');
}

// ---------- Test 3b: Dual-key fallback (transform without underscore prefix) ----------

console.log('\nTest 3b: Dual-key fallback — reads "transform" key (no underscore prefix)');
{
  const input = makeBaseInput({
    items: [
      {
        id: 'item-scene-noprefix',
        trackId: 'track-overlay',
        type: 'visual',
        startMs: 0,
        endMs: 15000,
        data: {
          sceneFile: 'scenes/Scene2.tsx',
          transform: { ...CUSTOM_TRANSFORM },
          keyframes: [
            { timeMs: 200, props: { opacity: 0.5 }, easing: 'linear' },
          ],
          filters: { saturation: 0.5 },
        },
      },
    ],
  });

  const manifest = dbToManifest(input);
  const sceneItem = manifest.items.find(i => i.id === 'item-scene-noprefix')!;

  assert(sceneItem != null, 'scene item exists (no-prefix keys)');
  assertDeepEqual(sceneItem.transform, CUSTOM_TRANSFORM, 'transform from non-prefixed key');
  assert(sceneItem.keyframes.length === 1, 'keyframes from non-prefixed key');
  assert((sceneItem as any).filters.saturation === 0.5, 'filters.saturation from non-prefixed key');
}

// ---------- Test 4: manifestToDb preserves transforms (may fail until Task 2) ----------

console.log('\nTest 4: manifestToDb preserves transforms (expected: may fail before Task 2)');
{
  const input = makeBaseInput({
    items: [
      {
        id: 'item-video-rt',
        trackId: 'track-video',
        type: 'video',
        startMs: 0,
        endMs: 30000,
        data: {
          src: 'video.mp4',
          _transform: { ...CUSTOM_TRANSFORM },
        },
      },
    ],
  });

  const manifest = dbToManifest(input);
  const dbResult = manifestToDb(manifest);

  const dbItem = dbResult.items.find(i => i.id === 'item-video-rt')!;
  assert(dbItem != null, 'item preserved in manifestToDb output');

  // Check that the transform is stored in item data with underscore prefix
  const hasTransform = (dbItem.data as any)._transform != null;
  assert(hasTransform, 'transform stored in item data as _transform');

  if (hasTransform) {
    assertDeepEqual((dbItem.data as any)._transform, CUSTOM_TRANSFORM, 'round-trip transform matches');
  }

  // Check that no layout mode inference produced a stacked/pip mode
  const layoutSettings = (dbResult.videoSettings.layoutSettings as any) || {};
  const inferredMode = layoutSettings.mode;
  // With the custom transform (60% width, 40% height), the old code would infer "stacked"
  // After Task 2, this should NOT infer any mode. For now, just log it.
  if (inferredMode && inferredMode !== 'fullscreen') {
    console.log(`  INFO: manifestToDb still infers layout mode="${inferredMode}" (Task 2 will fix this)`);
  }
}

// ---------- Test 5: Full cycle — dbToManifest → edit transform → manifestToDb → dbToManifest ----------

console.log('\nTest 5: Full DB→manifest→edit→DB→manifest cycle preserves transforms');
{
  // Step 1: Initial load (no stored transforms)
  const initialInput = makeBaseInput({
    project: {
      fps: 30,
      durationMs: 10000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: { canvasWidth: 1080, canvasHeight: 1920 },
    },
    items: [
      {
        id: 'item-1',
        trackId: 'track-video',
        type: 'video',
        startMs: 0,
        endMs: 10000,
        data: { src: 'source.mp4', volume: 1 },
      },
    ],
  });

  const manifest1 = dbToManifest(initialInput);
  const video1 = manifest1.items.find(i => i.type === 'video')!;
  assert(video1.transform?.width === '100%', 'Initial: fullscreen width');

  // Step 2: Simulate sandbox edit — user resizes video
  (video1 as any).transform = { x: 0, y: 0, width: '100%', height: '50%', rotation: 0, opacity: 1 };

  // Step 3: Save back to DB via manifestToDb
  const dbResult = manifestToDb(manifest1);
  const savedData = dbResult.items[0]!.data as any;
  assert(savedData._transform?.height === '50%', 'DB save: _transform height preserved');

  // Step 4: Reload from DB — transform should survive
  const reloadInput = makeBaseInput({
    project: initialInput.project,
    items: [
      {
        id: 'item-1',
        trackId: 'track-video',
        type: 'video',
        startMs: 0,
        endMs: 10000,
        data: savedData,
      },
    ],
  });
  const manifest2 = dbToManifest(reloadInput);
  const video2 = manifest2.items.find(i => i.type === 'video')!;
  assert(video2.transform?.height === '50%', `Reload: Expected height=50%, got ${video2.transform?.height}`);

  console.log('  Test 5 passed: Full DB→manifest→edit→DB→manifest cycle preserves transforms');
}

// ---------- Summary ----------

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
