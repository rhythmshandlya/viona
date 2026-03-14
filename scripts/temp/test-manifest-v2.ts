/**
 * Comprehensive tests for Manifest v2 schema and v1→v2 migration.
 * Run: pnpm tsx scripts/temp/test-manifest-v2.ts
 */

import {
  validateManifestV2,
  safeValidateManifestV2,
  type ManifestV2,
  type ManifestItemV2,
} from '@viona/shared';
import { migrateManifestV1toV2 } from '@viona/shared';
import { dbToManifest, type DbToManifestInput } from '@viona/shared';
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

// ============================================================
// 1. v2 schema validates a valid manifest with all item types
// ============================================================
console.log('\n--- Test 1: v2 schema validates valid manifest with all item types ---');

const validManifestV2: unknown = {
  version: 2,
  fps: 30,
  durationMs: 60000,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 'track-video', type: 'video', name: 'Video', position: 0 },
    { id: 'track-audio', type: 'audio', name: 'Audio', position: 1 },
    { id: 'track-overlay', type: 'overlay', name: 'Overlay', position: 2 },
    { id: 'track-caption', type: 'caption', name: 'Caption', position: 3 },
  ],
  items: [
    {
      id: 'item-video',
      type: 'video',
      trackId: 'track-video',
      startMs: 0,
      endMs: 30000,
      transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
      data: { src: 'video.mp4', startFrom: 0, volume: 1, playbackRate: 1 },
    },
    {
      id: 'item-audio',
      type: 'audio',
      trackId: 'track-audio',
      startMs: 0,
      endMs: 60000,
      data: { src: 'audio.mp3', volume: 0.8, playbackRate: 1 },
    },
    {
      id: 'item-text',
      type: 'text',
      trackId: 'track-overlay',
      startMs: 5000,
      endMs: 10000,
      transform: { x: 10, y: 20, width: '80%', height: '20%', rotation: 0, opacity: 1 },
      data: { text: 'Hello World', fontFamily: 'Inter', fontSize: 48, fontWeight: 600, color: '#FFFFFF', textAlign: 'center', textTransform: 'none' },
    },
    {
      id: 'item-image',
      type: 'image',
      trackId: 'track-overlay',
      startMs: 10000,
      endMs: 20000,
      transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 0.9 },
      data: { src: 'logo.png' },
    },
    {
      id: 'item-scene',
      type: 'scene',
      trackId: 'track-overlay',
      startMs: 0,
      endMs: 30000,
      transform: { x: 0, y: '50%', width: '100%', height: '50%', rotation: 0, opacity: 1 },
      data: { sceneFile: 'scenes/Scene1.tsx' },
    },
    {
      id: 'item-caption',
      type: 'caption',
      trackId: 'track-caption',
      startMs: 0,
      endMs: 60000,
      data: {
        words: [
          { text: 'Hello', startMs: 0, endMs: 500 },
          { text: 'world', startMs: 500, endMs: 1000 },
        ],
      },
    },
    {
      id: 'item-shape',
      type: 'shape',
      trackId: 'track-overlay',
      startMs: 20000,
      endMs: 25000,
      transform: { x: 100, y: 100, width: 200, height: 200, rotation: 45, opacity: 0.5 },
      data: { shape: 'circle', fill: '#FF0000' },
    },
  ],
  assets: { 'video.mp4': '/storage/video.mp4' },
};

{
  const result = validateManifestV2(validManifestV2);
  assert(result.version === 2, 'version is 2');
  assert(result.items.length === 7, 'all 7 items validated');
  assert(result.tracks.length === 4, 'all 4 tracks validated');
  assert(result.canvas.width === 1080, 'canvas width preserved');
  assert(result.fps === 30, 'fps preserved');
}

// ============================================================
// 2. v1→v2 migration (visual→scene, broll→video, layout→transforms, pip, audio no-transform)
// ============================================================
console.log('\n--- Test 2: v1→v2 migration ---');

const v1Manifest: Manifest = {
  version: 1,
  fps: 30,
  durationMs: 60000,
  canvas: { width: 1080, height: 1920 },
  tracks: [
    { id: 't-video', type: 'video', name: 'Video', position: 0 },
    { id: 't-audio', type: 'audio', name: 'Audio', position: 1 },
    { id: 't-visual', type: 'visual', name: 'Visual', position: 2 },
    { id: 't-broll', type: 'broll', name: 'B-Roll', position: 3 },
    { id: 't-caption', type: 'caption', name: 'Caption', position: 4 },
    { id: 't-text', type: 'text', name: 'Text', position: 5 },
    { id: 't-image', type: 'image', name: 'Image', position: 6 },
  ],
  items: [
    {
      id: 'i-video',
      type: 'video',
      trackId: 't-video',
      startMs: 0,
      endMs: 60000,
      data: { src: 'main.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 },
    },
    {
      id: 'i-audio',
      type: 'audio',
      trackId: 't-audio',
      startMs: 0,
      endMs: 60000,
      data: { src: 'audio.mp3', volume: 0.8, enhancedSrc: null },
    },
    {
      id: 'i-visual',
      type: 'visual',
      trackId: 't-visual',
      startMs: 0,
      endMs: 30000,
      data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0 },
    },
    {
      id: 'i-broll',
      type: 'broll',
      trackId: 't-broll',
      startMs: 10000,
      endMs: 20000,
      data: { sourceType: 'pexels', src: 'broll.mp4', filename: 'broll.mp4', volume: 0.5 },
    },
    {
      id: 'i-caption',
      type: 'caption',
      trackId: 't-caption',
      startMs: 0,
      endMs: 60000,
      data: {
        words: [
          { text: 'Hello', startMs: 0, endMs: 500 },
          { text: 'world', startMs: 500, endMs: 1000 },
        ],
      },
    },
    {
      id: 'i-text',
      type: 'text',
      trackId: 't-text',
      startMs: 5000,
      endMs: 10000,
      data: {
        text: 'Title',
        style: { fontFamily: 'Roboto', fontSize: 64, fontWeight: 700, color: '#FF0000', textAlign: 'left' },
        position: { x: 10, y: 20 },
        size: { width: 80, height: 30 },
      },
    },
    {
      id: 'i-image',
      type: 'image',
      trackId: 't-image',
      startMs: 15000,
      endMs: 25000,
      data: { src: 'logo.png', width: 50, height: 50, position: { x: 25, y: 25 }, opacity: 0.8 },
    },
  ],
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
  videoSettings: { cropX: 50, cropY: 50, scale: 1, sourceWidth: 1920, sourceHeight: 1080 },
};

{
  const v2 = migrateManifestV1toV2(v1Manifest);

  assert(v2.version === 2, 'migrated version is 2');
  assert(v2.items.length === 7, 'all 7 items migrated');

  // visual → scene
  const sceneItem = v2.items.find(i => i.id === 'i-visual');
  assert(sceneItem !== undefined, 'visual item found in v2');
  assert(sceneItem!.type === 'scene', 'visual→scene type migration');
  assert(sceneItem!.data.sceneFile === 'scenes/Scene1.tsx', 'scene data preserved');

  // broll → video
  const brollItem = v2.items.find(i => i.id === 'i-broll');
  assert(brollItem !== undefined, 'broll item found in v2');
  assert(brollItem!.type === 'video', 'broll→video type migration');
  if (brollItem!.type === 'video') {
    assert(brollItem!.data.src === 'broll.mp4', 'broll src preserved');
    assert(brollItem!.data.volume === 0.5, 'broll volume preserved');
  }

  // stacked layout → transforms
  const videoItem = v2.items.find(i => i.id === 'i-video');
  assert(videoItem !== undefined, 'video item found in v2');
  assert(videoItem!.transform !== undefined, 'video has transform from stacked layout');

  // track type migration
  const visualTrack = v2.tracks.find(t => t.id === 't-visual');
  assert(visualTrack!.type === 'overlay', 'visual track→overlay');
  const brollTrack = v2.tracks.find(t => t.id === 't-broll');
  assert(brollTrack!.type === 'video', 'broll track→video');
}

// ============================================================
// 3. Audio items have no transform
// ============================================================
console.log('\n--- Test 3: Audio items have no transform ---');

{
  const v2 = migrateManifestV1toV2(v1Manifest);
  const audioItem = v2.items.find(i => i.id === 'i-audio');
  assert(audioItem !== undefined, 'audio item found');
  assert(audioItem!.type === 'audio', 'audio type correct');
  assert(audioItem!.transform === undefined, 'audio item has no transform');
}

// ============================================================
// 4. Discriminated union type narrowing works
// ============================================================
console.log('\n--- Test 4: Discriminated union type narrowing ---');

{
  const v2 = validateManifestV2(validManifestV2);

  for (const item of v2.items) {
    switch (item.type) {
      case 'video':
        // TypeScript narrows: item.data has src, volume, playbackRate
        assert(typeof item.data.src === 'string', `video item has src: ${item.data.src}`);
        assert(typeof item.data.volume === 'number', `video item has volume`);
        break;
      case 'audio':
        assert(typeof item.data.src === 'string', `audio item has src: ${item.data.src}`);
        assert(typeof item.data.volume === 'number', `audio item has volume`);
        break;
      case 'text':
        assert(typeof item.data.text === 'string', `text item has text: ${item.data.text}`);
        assert(typeof item.data.fontFamily === 'string', `text item has fontFamily`);
        break;
      case 'image':
        assert(typeof item.data.src === 'string', `image item has src: ${item.data.src}`);
        break;
      case 'scene':
        assert(typeof item.data.sceneFile === 'string', `scene item has sceneFile: ${item.data.sceneFile}`);
        break;
      case 'caption':
        assert(Array.isArray(item.data.words), `caption item has words array`);
        break;
      case 'shape':
        assert(typeof item.data.shape === 'string', `shape item has shape: ${item.data.shape}`);
        assert(typeof item.data.fill === 'string', `shape item has fill`);
        break;
    }
  }
}

// ============================================================
// 5. dbToManifest produces valid v2 output
// ============================================================
console.log('\n--- Test 5: dbToManifest produces valid v2 output ---');

{
  const dbInput: DbToManifestInput = {
    project: {
      fps: 30,
      durationMs: 60000,
      sourceWidth: 1920,
      sourceHeight: 1080,
      videoSettings: {
        canvasWidth: 1080,
        canvasHeight: 1920,
        cropX: 50,
        cropY: 50,
        scale: 1,
        layoutSettings: {
          mode: 'stacked',
          split: { position: 'visuals-first', ratio: 50, gap: 0 },
        },
      },
    },
    tracks: [
      { id: 'db-t1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
      { id: 'db-t2', type: 'audio', name: 'Audio', position: 1, locked: false, visible: true },
      { id: 'db-t3', type: 'visual', name: 'Visual', position: 2, locked: false, visible: true },
      { id: 'db-t4', type: 'subtitle', name: 'Captions', position: 3, locked: false, visible: true },
    ],
    items: [
      { id: 'db-i1', trackId: 'db-t1', type: 'video', startMs: 0, endMs: 60000, data: { src: 'main.mp4', volume: 1 } },
      { id: 'db-i2', trackId: 'db-t2', type: 'audio', startMs: 0, endMs: 60000, data: { src: 'audio.mp3', volume: 0.8 } },
      { id: 'db-i3', trackId: 'db-t3', type: 'visual', startMs: 0, endMs: 30000, data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'default' } },
      { id: 'db-i4', trackId: 'db-t4', type: 'subtitle', startMs: 0, endMs: 60000, data: { words: [{ text: 'Hi', startMs: 0, endMs: 300 }] } },
    ],
  };

  const manifest = dbToManifest(dbInput);
  assert(manifest.version === 2, 'dbToManifest version is 2');
  assert(manifest.items.length === 4, 'dbToManifest has 4 items');
  assert(manifest.canvas.width === 1080, 'dbToManifest canvas width from videoSettings');

  // visual → scene in db path too
  const sceneItem = manifest.items.find(i => i.id === 'db-i3');
  assert(sceneItem!.type === 'scene', 'dbToManifest: visual→scene');

  // subtitle → caption
  const captionItem = manifest.items.find(i => i.id === 'db-i4');
  assert(captionItem!.type === 'caption', 'dbToManifest: subtitle→caption');

  // audio has no transform
  const audioItem = manifest.items.find(i => i.id === 'db-i2');
  assert(audioItem!.transform === undefined, 'dbToManifest: audio has no transform');

  // Validate through schema
  const revalidated = validateManifestV2(manifest);
  assert(revalidated.version === 2, 'dbToManifest output passes v2 schema validation');
}

// ============================================================
// 6. Text item migration (style extraction)
// ============================================================
console.log('\n--- Test 6: Text item migration (style extraction) ---');

{
  const v2 = migrateManifestV1toV2(v1Manifest);
  const textItem = v2.items.find(i => i.id === 'i-text');
  assert(textItem !== undefined, 'text item found');
  assert(textItem!.type === 'text', 'text type preserved');
  if (textItem!.type === 'text') {
    assert(textItem!.data.fontFamily === 'Roboto', 'style.fontFamily extracted → data.fontFamily');
    assert(textItem!.data.fontSize === 64, 'style.fontSize extracted → data.fontSize');
    assert(textItem!.data.fontWeight === 700, 'style.fontWeight extracted → data.fontWeight');
    assert(textItem!.data.color === '#FF0000', 'style.color extracted → data.color');
    assert(textItem!.data.textAlign === 'left', 'style.textAlign extracted → data.textAlign');
  }

  // Transform from position/size
  assert(textItem!.transform !== undefined, 'text item has transform');
  assert(textItem!.transform!.x === 10, 'text transform.x from position.x');
  assert(textItem!.transform!.y === 20, 'text transform.y from position.y');
  assert(textItem!.transform!.width === '80%', 'text transform.width from size.width');
  assert(textItem!.transform!.height === '30%', 'text transform.height from size.height');
}

// ============================================================
// 7. Image item migration (position/size → transform)
// ============================================================
console.log('\n--- Test 7: Image item migration (position/size → transform) ---');

{
  const v2 = migrateManifestV1toV2(v1Manifest);
  const imageItem = v2.items.find(i => i.id === 'i-image');
  assert(imageItem !== undefined, 'image item found');
  assert(imageItem!.type === 'image', 'image type preserved');
  if (imageItem!.type === 'image') {
    assert(imageItem!.data.src === 'logo.png', 'image src preserved');
  }

  // Transform from position/width/height/opacity
  assert(imageItem!.transform !== undefined, 'image item has transform');
  assert(imageItem!.transform!.x === 25, 'image transform.x from position.x');
  assert(imageItem!.transform!.y === 25, 'image transform.y from position.y');
  assert(imageItem!.transform!.width === '50%', 'image transform.width from width');
  assert(imageItem!.transform!.height === '50%', 'image transform.height from height');
  assert(imageItem!.transform!.opacity === 0.8, 'image transform.opacity from opacity');
}

// ============================================================
// 8. Invalid manifest rejection (negative tests)
// ============================================================
console.log('\n--- Test 8: Invalid manifest rejection ---');

{
  // Missing version
  const noVersion = safeValidateManifestV2({ fps: 30, durationMs: 1000, canvas: { width: 1080, height: 1920 }, tracks: [], items: [] });
  assert(!noVersion.success, 'rejects manifest without version');

  // Wrong version
  const wrongVersion = safeValidateManifestV2({ version: 1, fps: 30, durationMs: 1000, canvas: { width: 1080, height: 1920 }, tracks: [], items: [] });
  assert(!wrongVersion.success, 'rejects manifest with version 1');

  // Invalid item type in items array
  const badItemType = safeValidateManifestV2({
    version: 2,
    fps: 30,
    durationMs: 1000,
    canvas: { width: 1080, height: 1920 },
    tracks: [],
    items: [
      { id: 'x', type: 'invalid_type', trackId: 't', startMs: 0, endMs: 100, data: {} },
    ],
  });
  assert(!badItemType.success, 'rejects item with invalid type');

  // Negative startMs
  const negativeStart = safeValidateManifestV2({
    version: 2,
    fps: 30,
    durationMs: 1000,
    canvas: { width: 1080, height: 1920 },
    tracks: [],
    items: [
      { id: 'x', type: 'video', trackId: 't', startMs: -1, endMs: 100, data: { src: 'a.mp4', volume: 1, playbackRate: 1 } },
    ],
  });
  assert(!negativeStart.success, 'rejects negative startMs');

  // Missing canvas
  const noCanvas = safeValidateManifestV2({ version: 2, fps: 30, durationMs: 1000, tracks: [], items: [] });
  assert(!noCanvas.success, 'rejects manifest without canvas');

  // Invalid track type
  const badTrackType = safeValidateManifestV2({
    version: 2,
    fps: 30,
    durationMs: 1000,
    canvas: { width: 1080, height: 1920 },
    tracks: [{ id: 't', type: 'invalid_track', name: 'T', position: 0 }],
    items: [],
  });
  assert(!badTrackType.success, 'rejects invalid track type');

  // Video item missing src in data
  const noSrc = safeValidateManifestV2({
    version: 2,
    fps: 30,
    durationMs: 1000,
    canvas: { width: 1080, height: 1920 },
    tracks: [],
    items: [
      { id: 'x', type: 'video', trackId: 't', startMs: 0, endMs: 100, data: { volume: 1, playbackRate: 1 } },
    ],
  });
  assert(!noSrc.success, 'rejects video item without src');
}

// ============================================================
// Test for PiP layout migration
// ============================================================
console.log('\n--- Test 9: PiP layout migration ---');

{
  const v1Pip: Manifest = {
    ...v1Manifest,
    tracks: [
      { id: 't-video1', type: 'video', name: 'Main', position: 0 },
      { id: 't-video2', type: 'video', name: 'PiP', position: 1 },
    ],
    items: [
      {
        id: 'i-main',
        type: 'video',
        trackId: 't-video1',
        startMs: 0,
        endMs: 60000,
        data: { src: 'main.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 },
      },
      {
        id: 'i-pip',
        type: 'video',
        trackId: 't-video2',
        startMs: 0,
        endMs: 60000,
        data: { src: 'cam.mp4', crop: { x: 50, y: 50, scale: 1 }, volume: 1, playbackRate: 1 },
      },
    ],
    layout: {
      mode: 'pip',
      split: { position: 'visuals-first', ratio: 50, gap: 0 },
      pip: {
        position: 'bottom-right',
        offsetX: 5, offsetY: 5, size: 25,
        shape: 'circle', borderRadius: 9999, borderWidth: 2,
        borderColor: '#FFFFFF', shadowEnabled: true, shadowColor: '#000000',
        shadowBlur: 10, opacity: 0.9, rotation: 0,
        crop: { cropX: 40, cropY: 60, zoom: 1.5 },
      },
    },
  };

  const v2 = migrateManifestV1toV2(v1Pip);

  // Main video should be fullscreen
  const mainItem = v2.items.find(i => i.id === 'i-main');
  assert(mainItem!.transform!.x === 0, 'pip main video: fullscreen x=0');
  assert(mainItem!.transform!.width === '100%', 'pip main video: fullscreen width');

  // PiP video should have pip transform coordinates
  const pipItem = v2.items.find(i => i.id === 'i-pip');
  assert(pipItem!.transform !== undefined, 'pip video has transform');
  assert(pipItem!.transform!.width === '25%', 'pip video: size 25%');
  assert(pipItem!.transform!.opacity === 0.9, 'pip video: opacity from pip settings');

  // PiP video crop from pip settings
  if (pipItem!.type === 'video') {
    assert(pipItem!.data.crop !== undefined, 'pip video has crop');
    assert(pipItem!.data.crop!.x === 40, 'pip video crop.x from pip.crop.cropX');
    assert(pipItem!.data.crop!.y === 60, 'pip video crop.y from pip.crop.cropY');
    assert(pipItem!.data.crop!.scale === 1.5, 'pip video crop.scale from pip.crop.zoom');
  }
}

// ============================================================
// Summary
// ============================================================
console.log('\n============================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);

if (failed > 0) {
  console.error('\nSome tests failed!');
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
}
