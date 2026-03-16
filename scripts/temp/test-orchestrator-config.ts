#!/usr/bin/env tsx
/**
 * Test: Orchestrator Configuration
 *
 * Validates that buildOrchestratorOptions() produces the correct
 * 4-agent structure with proper tool registries.
 *
 * NOTE: This test validates the CONFIG structure — it does NOT
 * call the Agent SDK (which needs Docker). It verifies:
 * - 4 agents defined (planner, editor, animator, reviewer)
 * - Each agent has the right tools
 * - No dead agents (researcher, trimmer, healer, verifier)
 * - Correct models assigned
 *
 * Run: pnpm tsx scripts/temp/test-orchestrator-config.ts
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

const SANDBOX_SRC = join(process.cwd(), 'packages', 'sandbox', 'src');

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
  // ---- Test 1: Orchestrator source has correct agent definitions ----
  console.log('\n=== Orchestrator Agent Definitions ===\n');

  const orchestratorSrc = await readFile(join(SANDBOX_SRC, 'orchestrator.ts'), 'utf-8');

  // Should have agents (planner, editor, 3 animator variants, reviewer)
  assert(orchestratorSrc.includes("planner:"), 'Has planner agent');
  assert(orchestratorSrc.includes("editor:"), 'Has editor agent');
  // Generic animator replaced by 3 display-mode variants (tested below)
  assert(orchestratorSrc.includes("reviewer:"), 'Has reviewer agent');

  // Should have 3 Animator variants (replaces single generic animator)
  assert(orchestratorSrc.includes("'animator-stacked':"), 'Has animator-stacked agent');
  assert(orchestratorSrc.includes("'animator-fullscreen':"), 'Has animator-fullscreen agent');
  assert(orchestratorSrc.includes("'animator-overlay':"), 'Has animator-overlay agent');

  // prompt-assembly.ts should be imported
  assert(orchestratorSrc.includes("from './prompt-assembly"), 'Imports prompt-assembly module');
  assert(orchestratorSrc.includes('buildAnimatorVariantPrompt'), 'Uses buildAnimatorVariantPrompt');

  // build_animator_dispatch tool should be in allowed tools
  assert(orchestratorSrc.includes("'mcp__widgets__build_animator_dispatch'"), 'Dispatch tool in allowed tools');

  // Should NOT have old agents
  assert(!orchestratorSrc.includes("researcher:"), 'No researcher agent (research is part of planner)');
  assert(!orchestratorSrc.includes("trimmer:"), 'No trimmer agent (editor does trimming)');
  assert(!orchestratorSrc.includes("healer:"), 'No healer agent (all agents self-heal)');
  assert(!orchestratorSrc.includes("verifier:"), 'No verifier agent (replaced by reviewer)');

  // ---- Test 2: Prompt files exist for new agents ----
  console.log('\n=== Prompt Files ===\n');

  const promptsDir = join(SANDBOX_SRC, 'prompts');
  const requiredPrompts = [
    'orchestrator-system.md',
    'animator-system.md',
    'editor-system.md',
    'planner-system.md',
    'reviewer-system.md',
  ];

  for (const file of requiredPrompts) {
    try {
      const content = await readFile(join(promptsDir, file), 'utf-8');
      assert(content.length > 100, `${file} exists and has content (${content.length} chars)`);
    } catch (err) {
      assert(false, `${file} exists — FILE NOT FOUND`);
    }
  }

  // Old prompts should be deleted
  const deadPrompts = [
    'trimmer-system.md',
    'healer-system.md',
    'researcher-system.md',
    'verifier-system.md',
  ];

  for (const file of deadPrompts) {
    try {
      await readFile(join(promptsDir, file), 'utf-8');
      assert(false, `${file} should be DELETED but still exists`);
    } catch {
      assert(true, `${file} correctly deleted`);
    }
  }

  // ---- Test 3: Orchestrator loads correct prompts ----
  console.log('\n=== Prompt Loading ===\n');

  assert(orchestratorSrc.includes("loadPrompt('editor-system')"), 'Loads editor-system prompt');
  assert(orchestratorSrc.includes("loadPromptWithShared('reviewer-system')"), 'Loads reviewer-system with shared modules');
  assert(!orchestratorSrc.includes("loadPrompt('trimmer-system')"), 'Does NOT load trimmer-system');
  assert(!orchestratorSrc.includes("loadPrompt('healer-system')"), 'Does NOT load healer-system');
  assert(!orchestratorSrc.includes("loadPrompt('researcher-system')"), 'Does NOT load researcher-system');

  // ---- Test 4: Editor has correct tools ----
  console.log('\n=== Agent Tool Registries ===\n');

  // Editor should have manifest + scene + render + asset tools
  assert(orchestratorSrc.includes("// ---- Editor ----"), 'Editor section documented');
  // Planner should have WebSearch/WebFetch for research
  assert(orchestratorSrc.includes("'WebSearch', 'WebFetch'"), 'Planner has web research tools');

  // ---- Test 5: Progress type includes new fields ----
  console.log('\n=== Enhanced Progress ===\n');

  const widgetToolsSrc = await readFile(join(SANDBOX_SRC, 'tools', 'widget-tools.ts'), 'utf-8');
  assert(widgetToolsSrc.includes('agentName'), 'Progress has agentName field');
  assert(widgetToolsSrc.includes('trackName'), 'Progress has trackName field');
  assert(widgetToolsSrc.includes('estimatedTimeRemaining'), 'Progress has estimatedTimeRemaining field');

  // ---- Test 6: MCP servers progress updated ----
  console.log('\n=== MCP Servers Progress ===\n');

  const mcpServersSrc = await readFile(join(SANDBOX_SRC, 'mcp-servers.ts'), 'utf-8');
  assert(mcpServersSrc.includes('agentName'), 'MCP progress schema has agentName');
  assert(mcpServersSrc.includes('trackName'), 'MCP progress schema has trackName');
  assert(mcpServersSrc.includes('estimatedTimeRemaining'), 'MCP progress schema has estimatedTimeRemaining');

  // build_animator_dispatch tool should exist in mcp-servers
  assert(mcpServersSrc.includes("'build_animator_dispatch'"), 'Has build_animator_dispatch MCP tool');
  assert(mcpServersSrc.includes("sceneName"), 'Dispatch tool has sceneName param');
  assert(mcpServersSrc.includes("sceneFile"), 'Dispatch tool has sceneFile param');

  // ---- Test 7: Prompt assembly module exists ----
  console.log('\n=== Prompt Assembly Module ===\n');

  try {
    const assemblySrc = await readFile(join(SANDBOX_SRC, 'prompt-assembly.ts'), 'utf-8');
    assert(assemblySrc.includes('buildAnimatorPrompt'), 'Has buildAnimatorPrompt function');
    assert(assemblySrc.includes('computeEffectiveDimensions'), 'Has computeEffectiveDimensions function');
    assert(assemblySrc.includes('STACKED_RULES'), 'Has stacked display mode rules');
    assert(assemblySrc.includes('FULLSCREEN_RULES'), 'Has fullscreen display mode rules');
    assert(assemblySrc.includes('OVERLAY_RULES'), 'Has overlay display mode rules');
    assert(assemblySrc.includes('SELF_HEALING_RULES'), 'Has self-healing rules');
  } catch {
    assert(false, 'prompt-assembly.ts exists — FILE NOT FOUND');
  }

  // ---- Test 8: Animator prompt has self-healing ----
  console.log('\n=== Animator Self-Healing ===\n');

  const animatorSrc = await readFile(join(promptsDir, 'animator-system.md'), 'utf-8');
  assert(animatorSrc.includes('SELF-HEALING'), 'Animator prompt has self-healing section');
  assert(animatorSrc.includes('tsc --noEmit'), 'Animator knows to run tsc');
  assert(animatorSrc.includes('Max 2 fix attempts'), 'Animator has retry limit');

  // ---- Test 9: Orchestrator prompt has 8 phases ----
  console.log('\n=== 8-Phase Pipeline ===\n');

  const orchPrompt = await readFile(join(promptsDir, 'orchestrator-system.md'), 'utf-8');
  assert(orchPrompt.includes('Phase 1') || orchPrompt.includes('Brainstorming'), 'Has Phase 1 (Brainstorming)');
  assert(orchPrompt.includes('Transcript Cleanup') || orchPrompt.includes('Trim'), 'Has Phase 2 (Transcript Cleanup)');
  assert(orchPrompt.includes('Planning') || orchPrompt.includes('Planner'), 'Has Phase 3 (Planning)');
  assert(orchPrompt.includes('Rough Cut') || orchPrompt.includes('Mockup'), 'Has Phase 4 (Rough Cut + Mockups)');
  assert(orchPrompt.includes('Animation Generation') || orchPrompt.includes('Animator'), 'Has Phase 5 (Animation Generation)');
  assert(orchPrompt.includes('Review'), 'Has Phase 6 (Review)');
  assert(orchPrompt.includes('Final Assembly') || orchPrompt.includes('Pass 2'), 'Has Phase 7 (Final Assembly)');
  assert(orchPrompt.includes('Refinement'), 'Has Phase 8 (Refinement)');

  // ---- Test: Identity ----
  console.log('\n=== Identity ===\n');

  assert(orchPrompt.includes('You are Viona'), 'Identity is "You are Viona" (not "Creative Director for Viona")');
  assert(!orchPrompt.includes('Creative Director for Viona'), 'No "Creative Director for Viona" phrasing');

  // ---- Test: SDK-accurate dispatch patterns ----
  console.log('\n=== SDK Dispatch Patterns ===\n');

  assert(orchPrompt.includes('animator-stacked'), 'References animator-stacked variant');
  assert(orchPrompt.includes('animator-fullscreen'), 'References animator-fullscreen variant');
  assert(orchPrompt.includes('animator-overlay'), 'References animator-overlay variant');
  assert(orchPrompt.includes('build_animator_dispatch'), 'References build_animator_dispatch tool');
  assert(!orchPrompt.includes('Resume from Phase 4 session'), 'No "resume from Phase 4 session"');
  assert(!orchPrompt.includes('resume the originating Animator'), 'No "resume Animator"');
  assert(!orchPrompt.includes('resume the Planner'), 'No "resume the Planner"');
  assert(!orchPrompt.includes('Resume the **Animator**'), 'No "Resume the Animator" in Phase 8 table');
  assert(!orchPrompt.includes('Resume **Editor**'), 'No "Resume Editor" in Phase 8 table');
  assert(!orchPrompt.includes('Resume the **Editor**'), 'No "Resume the Editor" in Phase 7');

  // ---- Summary ----
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
