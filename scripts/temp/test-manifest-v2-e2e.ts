import {
  dbToManifest,
  validateManifestV2,
  migrateManifestV1toV2,
  validateManifest,
} from '@viona/shared';

console.log('=== E2E: Manifest v2 Pipeline ===\n');

// 1. Simulate DB data
const dbInput = {
  project: {
    fps: 30,
    durationMs: 120000,
    sourceWidth: 1920,
    sourceHeight: 1080,
    videoSettings: {
      cropX: 50,
      cropY: 50,
      scale: 1,
      canvasWidth: 1080,
      canvasHeight: 1920,
      layoutSettings: {
        mode: 'stacked',
        split: { position: 'visuals-first', ratio: 50, gap: 0 },
      },
      captionStyle: {
        displayMode: 'phrase',
        wordsPerPhrase: 5,
        fontFamily: 'Inter',
        fontSize: 56,
        fontWeight: 800,
        color: '#FFF',
        activeColor: '#FFD700',
        backgroundColor: 'transparent',
        activeBackgroundColor: 'transparent',
      },
    },
  },
  tracks: [
    { id: 't1', type: 'video', name: 'Video', position: 0, locked: false, visible: true },
    { id: 't2', type: 'audio', name: 'Audio', position: 1, locked: false, visible: true },
    { id: 't3', type: 'subtitle', name: 'Captions', position: 2, locked: false, visible: true },
  ],
  items: [
    {
      id: 'v1',
      trackId: 't1',
      type: 'video',
      startMs: 0,
      endMs: 120000,
      data: { src: 'source.mp4', volume: 1, playbackRate: 1, crop: { x: 50, y: 50, scale: 1 } },
    },
    {
      id: 'a1',
      trackId: 't2',
      type: 'audio',
      startMs: 0,
      endMs: 120000,
      data: { src: 'source.mp4', volume: 1, enhancedSrc: null },
    },
    {
      id: 'c1',
      trackId: 't3',
      type: 'subtitle',
      startMs: 0,
      endMs: 120000,
      data: { words: [{ text: 'Hello', startMs: 100, endMs: 500 }] },
    },
  ],
};

// 2. Generate v2 manifest from DB
console.log('Step 1: dbToManifest (v2)');
const manifest = dbToManifest(dbInput);
console.assert(manifest.version === 2, `Expected version 2, got ${manifest.version}`);
console.assert(!('layout' in manifest), 'v2 should not have layout');
console.assert('assets' in manifest, 'v2 should have assets map');
console.assert(manifest.items.length === 3, `Expected 3 items, got ${manifest.items.length}`);
console.log('  PASS\n');

// 3. Validate v2 schema
console.log('Step 2: validateManifestV2');
const validated = validateManifestV2(manifest);
console.assert(validated.items.length === 3, `Expected 3 items, got ${validated.items.length}`);
console.assert(validated.version === 2, 'Validated version should be 2');
console.assert(validated.canvas.width === 1080, `Canvas width should be 1080, got ${validated.canvas.width}`);
console.assert(validated.canvas.height === 1920, `Canvas height should be 1920, got ${validated.canvas.height}`);
console.log('  PASS\n');

// 4. Test v1 migration path (for stored manifests)
console.log('Step 3: v1 → v2 migration');
const v1Raw = {
  version: 1,
  fps: 30,
  durationMs: 60000,
  canvas: { width: 1080, height: 1920 },
  tracks: [{ id: 't1', type: 'video', name: 'V', position: 0 }],
  items: [
    {
      id: 'i1',
      type: 'video',
      trackId: 't1',
      startMs: 0,
      endMs: 60000,
      data: {
        src: 'source.mp4',
        crop: { x: 50, y: 50, scale: 1 },
        volume: 1,
        playbackRate: 1,
      },
    },
  ],
  layout: {
    mode: 'stacked',
    split: { position: 'visuals-first', ratio: 50, gap: 0 },
    pip: {
      position: 'bottom-right',
      size: 25,
      shape: 'circle',
      borderRadius: 9999,
      borderWidth: 2,
      borderColor: '#FFF',
      shadowEnabled: true,
      shadowColor: '#000',
      shadowBlur: 10,
      opacity: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      crop: { cropX: 50, cropY: 50, zoom: 1 },
    },
  },
  videoSettings: {
    cropX: 50,
    cropY: 50,
    scale: 1,
    sourceWidth: 1920,
    sourceHeight: 1080,
  },
};
const v1 = validateManifest(v1Raw);
console.assert(v1.version === 1, 'v1 version should be 1');

const migrated = migrateManifestV1toV2(v1);
console.assert(migrated.version === 2, 'Migrated version should be 2');
console.assert(migrated.items.length === 1, `Should have 1 item, got ${migrated.items.length}`);
console.assert(migrated.items[0]!.type === 'video', `Item type should be video, got ${migrated.items[0]!.type}`);

const v2Validated = validateManifestV2(migrated);
console.assert(v2Validated.items.length === 1, 'Validated migrated should have 1 item');
console.log('  PASS\n');

// 5. Verify item type mapping (DB → v2)
console.log('Step 4: Item type mapping');
const videoItem = manifest.items.find((i) => i.id === 'v1');
console.assert(videoItem?.type === 'video', `v1 should be video, got ${videoItem?.type}`);

const audioItem = manifest.items.find((i) => i.id === 'a1');
console.assert(audioItem?.type === 'audio', `a1 should be audio, got ${audioItem?.type}`);

const captionItem = manifest.items.find((i) => i.id === 'c1');
console.assert(captionItem?.type === 'caption', `c1 should be caption, got ${captionItem?.type}`);
console.log('  PASS\n');

// 6. Verify track type mapping (DB subtitle → v2 caption)
console.log('Step 5: Track type mapping');
const captionTrack = manifest.tracks.find((t) => t.id === 't3');
console.assert(captionTrack?.type === 'caption', `t3 should be caption track, got ${captionTrack?.type}`);
console.log('  PASS\n');

// 7. Verify stacked layout produces correct transforms
console.log('Step 6: Stacked layout transforms');
const videoItemFull = manifest.items.find((i) => i.id === 'v1') as any;
console.assert(videoItemFull.transform !== undefined, 'Video item should have transform');
console.assert(videoItemFull.transform.height === '50%', `Video height should be 50%, got ${videoItemFull.transform.height}`);
console.log('  PASS\n');

console.log('=== All E2E tests passed! ===');
