/**
 * Quick script to output the generated prompt for review
 * Run with: npx tsx src/prompts/test-prompt-output.ts
 */

import { buildGenerateVisualsPrompt, STYLE_GUIDELINES } from './generate-visuals.js';

const testTranscript = [
  { text: "Here's", startMs: 0, endMs: 300 },
  { text: "a", startMs: 300, endMs: 400 },
  { text: "challenge.", startMs: 400, endMs: 900 },
  { text: "You", startMs: 1000, endMs: 1200 },
  { text: "have", startMs: 1200, endMs: 1400 },
  { text: "to", startMs: 1400, endMs: 1500 },
  { text: "process", startMs: 1500, endMs: 1900 },
  { text: "billions", startMs: 1900, endMs: 2400 },
  { text: "of", startMs: 2400, endMs: 2500 },
  { text: "events", startMs: 2500, endMs: 2900 },
  { text: "a", startMs: 2900, endMs: 3000 },
  { text: "day.", startMs: 3000, endMs: 3500 },
  { text: "The", startMs: 4000, endMs: 4200 },
  { text: "problem", startMs: 4200, endMs: 4600 },
  { text: "is", startMs: 4600, endMs: 4800 },
  { text: "your", startMs: 4800, endMs: 5000 },
  { text: "threat", startMs: 5000, endMs: 5400 },
  { text: "database", startMs: 5400, endMs: 5900 },
  { text: "cannot", startMs: 5900, endMs: 6300 },
  { text: "fit", startMs: 6300, endMs: 6500 },
  { text: "in", startMs: 6500, endMs: 6600 },
  { text: "RAM.", startMs: 6600, endMs: 7200 },
];

const prompt = buildGenerateVisualsPrompt({
  transcript: testTranscript,
  projectId: 'proj_bloom_filter_demo',
  stylePreset: 'modern',
  styleGuidelines: STYLE_GUIDELINES.modern,
  durationMs: 15000,
  fps: 30,
  width: 1080,
  height: 1920,
  layoutMode: 'pip',
});

console.log('='.repeat(80));
console.log('GENERATED PROMPT (modern style, 1080x1920 vertical)');
console.log('='.repeat(80));
console.log(prompt);
console.log('='.repeat(80));
console.log(`\nPrompt length: ${prompt.length} characters`);
