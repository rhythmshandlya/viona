import { manifestSchema, validateManifest, safeValidateManifest } from '../../packages/shared/src/manifest.js';

// Minimal valid manifest
const minimal: unknown = {
  version: 1,
  fps: 30,
  durationMs: 10000,
  canvas: { width: 1080, height: 1920 },
  tracks: [],
  items: [],
};

// Full manifest with all item types
const full: unknown = {
  version: 1,
  fps: 30,
  durationMs: 30000,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 't1', type: 'video', name: 'Speaker', position: 0 },
    { id: 't2', type: 'visual', name: 'Visuals', position: 1 },
    { id: 't3', type: 'caption', name: 'Captions', position: 2 },
    { id: 't4', type: 'audio', name: 'Audio', position: 3 },
  ],
  items: [
    {
      id: 'i1', type: 'video', trackId: 't1', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', crop: { x: 50, y: 50, scale: 1.0 }, volume: 1, playbackRate: 1 },
    },
    {
      id: 'i2', type: 'visual', trackId: 't2', startMs: 0, endMs: 8000,
      data: {
        sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0,
        transition: { enter: { type: 'fade', durationMs: 200 }, exit: { type: 'crossfade', durationMs: 300 } },
      },
    },
    {
      id: 'i3', type: 'caption', trackId: 't3', startMs: 0, endMs: 3500,
      data: {
        words: [
          { text: 'Revenue', startMs: 0, endMs: 400, classification: 'power' },
          { text: 'grew', startMs: 400, endMs: 700 },
        ],
      },
    },
    {
      id: 'i4', type: 'audio', trackId: 't4', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', volume: 1.0, enhancedSrc: null },
    },
  ],
  layout: {
    mode: 'stacked',
    split: { position: 'visuals-first', ratio: 50, gap: 0 },
    pip: { position: 'bottom-right', size: 25, shape: 'circle' },
  },
  captionStyle: {
    displayMode: 'word-by-word',
    fontFamily: 'Inter',
    fontSize: 64,
    color: '#FFFFFF',
    activeColor: '#FFD700',
    animation: { in: 'elastic-pop', active: 'none', out: 'fade', easing: 'ease-out' },
  },
  videoSettings: { cropX: 50, cropY: 50, scale: 1.0, sourceWidth: 1920, sourceHeight: 1080 },
};

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`    ${e.message || JSON.stringify(e)}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Test 1: Minimal manifest validates
test('Minimal manifest validates', () => {
  const result = safeValidateManifest(minimal);
  assert(result.success, 'Minimal manifest should validate');
});

// Test 2: Full manifest validates
test('Full manifest validates', () => {
  const result = safeValidateManifest(full);
  if (!result.success) {
    throw new Error(JSON.stringify(result.error.issues, null, 2));
  }
});

// Test 3: Invalid version rejects
test('Invalid version rejects', () => {
  const result = safeValidateManifest({ ...(minimal as any), version: 2 });
  assert(!result.success, 'Version 2 should be rejected');
});

// Test 4: Missing required fields reject
test('Missing canvas rejects', () => {
  const { canvas, ...noCanvas } = minimal as any;
  const result = safeValidateManifest(noCanvas);
  assert(!result.success, 'Missing canvas should be rejected');
});

// Test 5: Invalid displayMode rejects
test('Invalid visual displayMode rejects', () => {
  const badItem = {
    ...(minimal as any),
    items: [{
      id: 'x', type: 'visual', trackId: 't1', startMs: 0, endMs: 1000,
      data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'stacked', frameOffset: 0 },
    }],
  };
  const result = safeValidateManifest(badItem);
  assert(!result.success, 'displayMode "stacked" should be rejected');
});

// Test 6: Defaults are applied
test('Defaults are applied', () => {
  const parsed = validateManifest(minimal);
  assert(parsed.layout.mode === 'stacked', 'Default layout mode should be stacked');
  assert(parsed.layout.split.ratio === 50, 'Default split ratio should be 50');
  assert(parsed.captionStyle.fontSize === 56, 'Default font size should be 56');
});

// Test 7: Transition duration clamped
test('Transition duration > 2000ms rejects', () => {
  const badTransition = safeValidateManifest({
    ...(minimal as any),
    items: [{
      id: 'x', type: 'visual', trackId: 't1', startMs: 0, endMs: 1000,
      data: {
        sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0,
        transition: { enter: { type: 'crossfade', durationMs: 5000 } },
      },
    }],
  });
  assert(!badTransition.success, 'Transition > 2000ms should be rejected');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
