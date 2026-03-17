#!/usr/bin/env tsx
/**
 * Test: Prompt Assembly Module
 *
 * Validates that buildAnimatorPrompt(), computeEffectiveDimensions(),
 * and buildAnimatorVariantPrompt() produce correct outputs for each display mode.
 *
 * Run: pnpm tsx scripts/temp/test-prompt-assembly.ts
 */

// Direct import from source (not compiled) — tsx handles .ts imports
import {
  computeEffectiveDimensions,
  buildAnimatorDispatchMessage,
  buildAnimatorVariantPrompt,
  type DisplayMode,
  type SceneConfig,
} from '../../packages/sandbox/src/prompt-assembly.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function main() {
  // ---- Test: computeEffectiveDimensions ----

  console.log('\n=== computeEffectiveDimensions ===\n');

  // Stacked mode
  const stacked = computeEffectiveDimensions(1080, 1920, 'default', 55);
  assert(stacked.width === 1080, 'Stacked width = canvas width (1080)');
  assert(stacked.height === 1056, `Stacked height = 55% of 1920 = 1056 (got ${stacked.height})`);
  assert(stacked.position === 'video-bottom', 'Stacked position = video-bottom');

  // Fullscreen mode
  const fullscreen = computeEffectiveDimensions(1080, 1920, 'fullscreen', 55);
  assert(fullscreen.width === 1080, 'Fullscreen width = canvas width (1080)');
  assert(fullscreen.height === 1920, 'Fullscreen height = canvas height (1920)');
  assert(fullscreen.position === 'full', 'Fullscreen position = full');

  // Overlay mode
  const overlay = computeEffectiveDimensions(1080, 1920, 'overlay', 55);
  assert(overlay.width === 1080, 'Overlay width = canvas width (1080)');
  assert(overlay.height === 1920, 'Overlay height = canvas height (1920)');
  assert(overlay.position === 'overlay', 'Overlay position = overlay');

  // Different split ratio
  const stacked70 = computeEffectiveDimensions(1080, 1920, 'default', 70);
  assert(stacked70.height === 1344, `70% split: height = 1344 (got ${stacked70.height})`);

  // Different canvas size
  const landscape = computeEffectiveDimensions(1920, 1080, 'default', 55);
  assert(landscape.width === 1920, 'Landscape width = 1920');
  assert(landscape.height === 594, `Landscape stacked height = 594 (got ${landscape.height})`);

  // ---- Test: buildAnimatorDispatchMessage ----

  console.log('\n=== buildAnimatorDispatchMessage ===\n');

  const config: SceneConfig = {
    sceneName: 'Hook Title',
    sceneFile: 'HookTitle',
    displayMode: 'default',
    splitRatio: 55,
    sceneBrief: 'Bold title fills the visual region with kinetic typography.',
    syncPoints: [
      { frame: 45, action: 'Title springs in' },
      { frame: 120, action: 'Subtitle fades up' },
    ],
    durationFrames: 300,
    canvasWidth: 1080,
    canvasHeight: 1920,
    fps: 30,
    theme: 'studio-dark',
  };

  const msg = buildAnimatorDispatchMessage(config);

  assert(msg.includes('HookTitle'), 'Dispatch message includes scene file name');
  assert(msg.includes('default'), 'Dispatch message includes display mode');
  assert(msg.includes('1080×1056'), 'Dispatch message includes effective dimensions');
  assert(msg.includes('300 frames'), 'Dispatch message includes duration');
  assert(msg.includes('Title springs in'), 'Dispatch message includes sync points');
  assert(msg.includes('kinetic typography'), 'Dispatch message includes scene brief');

  // Fullscreen dispatch message
  const fullscreenConfig: SceneConfig = {
    ...config,
    sceneName: 'Data Reveal',
    sceneFile: 'DataReveal',
    displayMode: 'fullscreen',
  };

  const fullMsg = buildAnimatorDispatchMessage(fullscreenConfig);
  assert(fullMsg.includes('1080×1920'), 'Fullscreen dispatch has full canvas dimensions');
  assert(fullMsg.includes('fullscreen'), 'Fullscreen dispatch includes display mode');

  // Overlay dispatch message
  const overlayConfig: SceneConfig = {
    ...config,
    sceneName: 'Speaker Insight',
    sceneFile: 'SpeakerInsight',
    displayMode: 'overlay',
  };

  const overlayMsg = buildAnimatorDispatchMessage(overlayConfig);
  assert(overlayMsg.includes('overlay'), 'Overlay dispatch includes display mode');

  // ---- Test: All display modes produce valid prompts ----

  console.log('\n=== Display mode coverage ===\n');

  const modes: DisplayMode[] = ['default', 'fullscreen', 'overlay'];
  for (const mode of modes) {
    const dims = computeEffectiveDimensions(1080, 1920, mode, 55);
    assert(dims.width > 0 && dims.height > 0, `${mode}: dimensions are positive (${dims.width}×${dims.height})`);
    assert(typeof dims.position === 'string', `${mode}: position is a string`);
  }

  // ---- Test: buildAnimatorVariantPrompt ----

  console.log('\n=== buildAnimatorVariantPrompt ===\n');

  const basePrompt = '# Base Animator Prompt\n\nYou are an Animator agent.';
  const variantCtx = { canvasWidth: 1080, canvasHeight: 1920, theme: 'studio-dark' };

  // Stacked variant
  const stackedVariant = await buildAnimatorVariantPrompt('default', basePrompt, variantCtx);
  assert(stackedVariant.includes('# Base Animator Prompt'), 'Stacked variant includes base prompt');
  assert(stackedVariant.includes('STACKED'), 'Stacked variant includes stacked rules');
  assert(stackedVariant.includes('1080'), 'Stacked variant has canvas width');
  assert(stackedVariant.includes('1056'), 'Stacked variant has computed height (55% of 1920)');
  assert(!stackedVariant.includes('FULLSCREEN'), 'Stacked variant does NOT include fullscreen rules');
  assert(!stackedVariant.includes('OVERLAY'), 'Stacked variant does NOT include overlay rules');

  // Fullscreen variant
  const fullscreenVariant = await buildAnimatorVariantPrompt('fullscreen', basePrompt, variantCtx);
  assert(fullscreenVariant.includes('FULLSCREEN'), 'Fullscreen variant includes fullscreen rules');
  assert(fullscreenVariant.includes('1920'), 'Fullscreen variant has full canvas height');
  assert(!fullscreenVariant.includes('STACKED'), 'Fullscreen variant does NOT include stacked rules');

  // Overlay variant
  const overlayVariant = await buildAnimatorVariantPrompt('overlay', basePrompt, variantCtx);
  assert(overlayVariant.includes('OVERLAY'), 'Overlay variant includes overlay rules');
  assert(overlayVariant.includes('Face zone OFF-LIMITS'), 'Overlay variant has safe zone rules');
  assert(!overlayVariant.includes('STACKED'), 'Overlay variant does NOT include stacked rules');

  // All variants include theme section
  for (const [name, variant] of [['stacked', stackedVariant], ['fullscreen', fullscreenVariant], ['overlay', overlayVariant]] as const) {
    assert(variant.includes('THEME:'), `${name} variant has theme section`);
  }

  // ---- Summary ----

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
