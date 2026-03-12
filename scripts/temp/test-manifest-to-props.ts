/**
 * Tests for manifest-to-props converter.
 * Run with: npx tsx scripts/temp/test-manifest-to-props.ts
 */
import { manifestToProps } from '../../packages/worker/src/processors/render/manifest-to-props.js';
import type { Manifest } from '@viona/shared';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
    console.error(`    expected: ${e}`);
    console.error(`    actual:   ${a}`);
  }
}

/** Helper to build a minimal valid manifest */
function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: 1 as const,
    fps: 30,
    durationMs: 10000,
    canvas: { width: 1080, height: 1920 },
    tracks: [],
    items: [],
    layout: {
      mode: 'stacked',
      split: { position: 'visuals-first', ratio: 50, gap: 0 },
      pip: {
        position: 'bottom-right',
        offsetX: 0, offsetY: 0, size: 25,
        shape: 'circle', borderRadius: 9999, borderWidth: 2,
        borderColor: '#FFFFFF', shadowEnabled: true, shadowColor: '#000000',
        shadowBlur: 10, opacity: 1, rotation: 0,
        crop: { cropX: 50, cropY: 50, zoom: 1 },
      },
    },
    captionStyle: {
      displayMode: 'phrase',
      wordsPerPhrase: 5,
      fontFamily: 'Inter',
      fontSize: 56,
      fontWeight: 800,
      color: '#FFFFFF',
      activeColor: '#FFD700',
      backgroundColor: 'transparent',
      activeBackgroundColor: 'transparent',
      animation: { in: 'elastic-pop', active: 'none', out: 'none', easing: 'spring' },
      position: { anchor: 'bottom', offsetX: 0, offsetY: 0, textAlign: 'center', rotation: 0 },
    },
    videoSettings: {
      cropX: 50, cropY: 50, scale: 1,
      sourceWidth: 1920, sourceHeight: 1080,
    },
    ...overrides,
  };
}

// ---- Test 1: Minimal manifest (no visuals, no captions) ----
console.log('\nTest 1: Minimal manifest (no visuals, no captions)');
{
  const manifest = makeManifest();
  const props = manifestToProps(manifest);

  assertEqual(props.layoutMode, 'stacked', 'layoutMode is stacked');
  assertEqual(props.layoutSegments.length, 1, 'exactly 1 default layout segment');
  assertEqual(props.layoutSegments[0].displayMode, 'default', 'segment displayMode is default');
  assertEqual(props.layoutSegments[0].startFrame, 0, 'segment starts at frame 0');
  assertEqual(props.layoutSegments[0].endFrame, 300, 'segment ends at frame 300 (10s * 30fps)');
  assert(props.subtitles === undefined, 'no subtitles');
  assert(props.defaultSubtitleStyle !== undefined, 'defaultSubtitleStyle is present');
  assertEqual(props.defaultSubtitleStyle?.fontFamily, 'Inter', 'default font is Inter');
}

// ---- Test 2: Visual items → correct layout segments ----
console.log('\nTest 2: Visual items produce correct layout segments');
{
  const manifest = makeManifest({
    items: [
      {
        id: 'v1', type: 'visual', trackId: 't1',
        startMs: 1000, endMs: 4000,
        data: {
          sceneFile: 'scene1.tsx',
          displayMode: 'fullscreen',
          frameOffset: 0,
        },
      },
      {
        id: 'v2', type: 'visual', trackId: 't1',
        startMs: 5000, endMs: 8000,
        data: {
          sceneFile: 'scene2.tsx',
          displayMode: 'overlay',
          frameOffset: 0,
        },
      },
    ],
  });
  const props = manifestToProps(manifest);

  // Expected segments: default 0-1s, fullscreen 1-4s, default 4-5s, overlay 5-8s, default 8-10s
  assertEqual(props.layoutSegments.length, 5, '5 layout segments (with gap fills)');
  assertEqual(props.layoutSegments[0].displayMode, 'default', 'leading gap filled with default');
  assertEqual(props.layoutSegments[0].startFrame, 0, 'leading gap starts at 0');
  assertEqual(props.layoutSegments[0].endFrame, 30, 'leading gap ends at 30');
  assertEqual(props.layoutSegments[1].displayMode, 'fullscreen', 'first visual is fullscreen');
  assertEqual(props.layoutSegments[1].startFrame, 30, 'fullscreen starts at frame 30');
  assertEqual(props.layoutSegments[1].endFrame, 120, 'fullscreen ends at frame 120');
  assertEqual(props.layoutSegments[2].displayMode, 'default', 'mid gap filled with default');
  assertEqual(props.layoutSegments[3].displayMode, 'overlay', 'second visual is overlay');
  assertEqual(props.layoutSegments[4].displayMode, 'default', 'trailing gap filled with default');
}

// ---- Test 3: Caption items → subtitles with relative→absolute timing ----
console.log('\nTest 3: Caption items produce subtitles with absolute word timing');
{
  const manifest = makeManifest({
    items: [
      {
        id: 'c1', type: 'caption', trackId: 't2',
        startMs: 2000, endMs: 4000,
        data: {
          words: [
            { text: 'Hello', startMs: 0, endMs: 500 },
            { text: 'world', startMs: 500, endMs: 1000 },
          ],
        },
      },
      {
        id: 'c2', type: 'caption', trackId: 't2',
        startMs: 5000, endMs: 7000,
        data: {
          words: [
            { text: 'Goodbye', startMs: 0, endMs: 800 },
          ],
        },
      },
    ],
  });
  const props = manifestToProps(manifest);

  assert(props.subtitles !== undefined, 'subtitles are present');
  assertEqual(props.subtitles!.length, 2, '2 subtitle items');

  // First caption: words at relative 0-500, 500-1000 → absolute 2000-2500, 2500-3000
  assertEqual(props.subtitles![0].startMs, 2000, 'first subtitle startMs');
  assertEqual(props.subtitles![0].endMs, 4000, 'first subtitle endMs');
  assertEqual(props.subtitles![0].words[0].startMs, 2000, 'word "Hello" absolute startMs');
  assertEqual(props.subtitles![0].words[0].endMs, 2500, 'word "Hello" absolute endMs');
  assertEqual(props.subtitles![0].words[1].startMs, 2500, 'word "world" absolute startMs');
  assertEqual(props.subtitles![0].words[1].endMs, 3000, 'word "world" absolute endMs');

  // Second caption: word at relative 0-800 → absolute 5000-5800
  assertEqual(props.subtitles![1].words[0].startMs, 5000, 'word "Goodbye" absolute startMs');
  assertEqual(props.subtitles![1].words[0].endMs, 5800, 'word "Goodbye" absolute endMs');
}

// ---- Test 4: PiP layout mode → pipSettings populated ----
console.log('\nTest 4: PiP layout mode populates pipSettings');
{
  const manifest = makeManifest({
    layout: {
      mode: 'pip',
      split: { position: 'visuals-first', ratio: 50, gap: 0 },
      pip: {
        position: 'top-left',
        offsetX: 10, offsetY: 20, size: 30,
        shape: 'rounded', borderRadius: 16, borderWidth: 3,
        borderColor: '#FF0000', shadowEnabled: false, shadowColor: '#000',
        shadowBlur: 5, opacity: 0.9, rotation: 5,
        crop: { cropX: 40, cropY: 60, zoom: 1.5 },
      },
    },
  });
  const props = manifestToProps(manifest);

  assertEqual(props.layoutMode, 'pip', 'layoutMode is pip');
  assert(props.pipSettings !== undefined, 'pipSettings is present');
  assertEqual(props.pipSettings!.position, 'top-left', 'pip position');
  assertEqual(props.pipSettings!.size, 30, 'pip size is number (30)');
  assertEqual(props.pipSettings!.offsetX, 10, 'pip offsetX');
  assertEqual(props.pipSettings!.offsetY, 20, 'pip offsetY');
  assertEqual(props.pipSettings!.shape, 'rounded', 'pip shape');
  assertEqual(props.pipSettings!.borderRadius, 16, 'pip borderRadius');
  assertEqual(props.pipSettings!.shadowEnabled, false, 'pip shadowEnabled');
  assertEqual(props.pipSettings!.opacity, 0.9, 'pip opacity');
  assertEqual(props.pipSettings!.rotation, 5, 'pip rotation');
  // Verify crop is NOT present on pipSettings
  assert(!('crop' in props.pipSettings!), 'crop is omitted from pipSettings');
}

// ---- Test 5: Gap filling between visuals ----
console.log('\nTest 5: Gap filling between visuals');
{
  const manifest = makeManifest({
    durationMs: 6000,
    items: [
      {
        id: 'v1', type: 'visual', trackId: 't1',
        startMs: 0, endMs: 2000,
        data: { sceneFile: 's1.tsx', displayMode: 'default', frameOffset: 0 },
      },
      {
        id: 'v2', type: 'visual', trackId: 't1',
        startMs: 2030, endMs: 4000, // 30ms gap — should be absorbed (< 50ms threshold)
        data: { sceneFile: 's2.tsx', displayMode: 'default', frameOffset: 0 },
      },
      {
        id: 'v3', type: 'visual', trackId: 't1',
        startMs: 4100, endMs: 5500, // 100ms gap — should be filled
        data: { sceneFile: 's3.tsx', displayMode: 'fullscreen', frameOffset: 0 },
      },
    ],
  });
  const props = manifestToProps(manifest);

  // v1 (0-2000), v2 (2030-4000) — 30ms gap absorbed, no filler
  // gap (4000-4100) — 100ms, filled with default
  // v3 (4100-5500)
  // trailing gap (5500-6000) — 500ms, filled with default

  // Count: v1 + v2 + gap-filler + v3 + trailing = 5
  assertEqual(props.layoutSegments.length, 5, '5 segments (small gap absorbed, large gap filled)');
  assertEqual(props.layoutSegments[0].displayMode, 'default', 'v1 default');
  assertEqual(props.layoutSegments[1].displayMode, 'default', 'v2 default');
  assertEqual(props.layoutSegments[2].displayMode, 'default', 'gap filler default');
  assertEqual(props.layoutSegments[2].startFrame, 120, 'gap filler starts at frame 120 (4000ms)');
  assertEqual(props.layoutSegments[2].endFrame, 123, 'gap filler ends at frame 123 (4100ms)');
  assertEqual(props.layoutSegments[3].displayMode, 'fullscreen', 'v3 fullscreen');
  assertEqual(props.layoutSegments[4].displayMode, 'default', 'trailing default');
}

// ---- Test 6: Display mode normalization (pip → default) ----
console.log('\nTest 6: Display mode normalization (pip → default)');
{
  const manifest = makeManifest({
    items: [
      {
        id: 'v1', type: 'visual', trackId: 't1',
        startMs: 0, endMs: 5000,
        data: {
          sceneFile: 's1.tsx',
          displayMode: 'default', // Using 'default' since schema only allows 'default'|'fullscreen'|'overlay'
          frameOffset: 0,
        },
      },
    ],
  });

  // Manually set displayMode to 'pip' to test normalization
  // (This can happen with legacy data before schema enforcement)
  (manifest.items[0].data as any).displayMode = 'pip';

  const props = manifestToProps(manifest);

  assertEqual(props.layoutSegments.length, 2, '2 segments (visual + trailing)');
  assertEqual(props.layoutSegments[0].displayMode, 'default', 'pip normalised to default');
}

// ---- Test: stacked mode has no pipSettings ----
console.log('\nTest 7: Stacked mode omits pipSettings');
{
  const manifest = makeManifest(); // default is stacked
  const props = manifestToProps(manifest);
  assertEqual(props.pipSettings, undefined, 'pipSettings is undefined for stacked mode');
}

// ---- Summary ----
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
