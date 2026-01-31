/**
 * Test script to send the visual generation prompt directly to OpenRouter/Gemini
 *
 * Run with:
 *   npx tsx src/prompts/test-llm-generation.ts          # Uses Pro (default for code gen)
 *   npx tsx src/prompts/test-llm-generation.ts flash    # Uses Flash (faster, cheaper)
 *   npx tsx src/prompts/test-llm-generation.ts pro      # Uses Pro (higher quality)
 *
 * Requires: OPENROUTER_API_KEY environment variable
 */

import { buildGenerateVisualsPrompt, STYLE_GUIDELINES } from './generate-visuals.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set. Please set it in your environment.');
  console.error('   export OPENROUTER_API_KEY=your_key_here');
  process.exit(1);
}

// Model configurations
const MODELS = {
  flash: {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
  },
  pro: {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    inputCostPer1M: 2.00,
    outputCostPer1M: 12.00,
  },
} as const;

// Parse command line argument
const modelArg = process.argv[2]?.toLowerCase() as 'flash' | 'pro' | undefined;
const selectedModel = MODELS[modelArg || 'pro']; // Default to Pro for code generation

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
  { text: "is", startMs: 5900, endMs: 6000 },
  { text: "too", startMs: 6000, endMs: 6200 },
  { text: "large", startMs: 6200, endMs: 6500 },
  { text: "to", startMs: 6500, endMs: 6600 },
  { text: "fit", startMs: 6600, endMs: 6800 },
  { text: "in", startMs: 6800, endMs: 6900 },
  { text: "RAM.", startMs: 6900, endMs: 7400 },
  { text: "This", startMs: 8000, endMs: 8200 },
  { text: "is", startMs: 8200, endMs: 8300 },
  { text: "where", startMs: 8300, endMs: 8500 },
  { text: "Bloom", startMs: 8500, endMs: 8900 },
  { text: "Filters", startMs: 8900, endMs: 9400 },
  { text: "come", startMs: 9400, endMs: 9600 },
  { text: "in.", startMs: 9600, endMs: 10000 },
  { text: "A", startMs: 10500, endMs: 10600 },
  { text: "Bloom", startMs: 10600, endMs: 11000 },
  { text: "Filter", startMs: 11000, endMs: 11400 },
  { text: "is", startMs: 11400, endMs: 11500 },
  { text: "a", startMs: 11500, endMs: 11600 },
  { text: "probabilistic", startMs: 11600, endMs: 12300 },
  { text: "data", startMs: 12300, endMs: 12600 },
  { text: "structure.", startMs: 12600, endMs: 13200 },
];

const projectId = 'proj_bloom_filter_test';

const prompt = buildGenerateVisualsPrompt({
  transcript: testTranscript,
  projectId,
  stylePreset: 'modern',
  styleGuidelines: STYLE_GUIDELINES.modern,
  durationMs: 15000,
  fps: 30,
  width: 1080,
  height: 1920,
  layoutMode: 'pip',
});

async function testGeneration() {
  console.log(`🚀 Sending prompt to OpenRouter (${selectedModel.name})...`);
  console.log(`📝 Prompt length: ${prompt.length} characters`);
  console.log(`💰 Estimated cost: $${(prompt.length / 4 / 1_000_000 * selectedModel.inputCostPer1M).toFixed(4)} input\n`);

  const startTime = Date.now();

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://clipify.dev',
        'X-Title': 'Clipify Visual Generation Test',
      },
      body: JSON.stringify({
        model: selectedModel.id,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 1.0, // Gemini 3.x requires this
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const estimatedCost =
      (inputTokens / 1_000_000) * selectedModel.inputCostPer1M +
      (outputTokens / 1_000_000) * selectedModel.outputCostPer1M;

    console.log(`✅ Response received in ${elapsed}s`);
    console.log(`📊 Usage: ${inputTokens} input tokens, ${outputTokens} output tokens`);
    console.log(`💰 Estimated cost: $${estimatedCost.toFixed(4)}\n`);

    const content = data.choices?.[0]?.message?.content || '';

    // Save output to file
    const outputDir = join(process.cwd(), 'test-output');
    await mkdir(outputDir, { recursive: true });

    const modelSuffix = modelArg || 'pro';
    const outputPath = join(outputDir, `${projectId}-${modelSuffix}-output.md`);
    await writeFile(outputPath, `# LLM Output for ${projectId}\n\nModel: ${selectedModel.name}\nGenerated at: ${new Date().toISOString()}\nElapsed: ${elapsed}s\nTokens: ${inputTokens} in / ${outputTokens} out\nCost: $${estimatedCost.toFixed(4)}\n\n---\n\n${content}`);

    console.log(`💾 Full output saved to: ${outputPath}`);
    console.log('\n' + '='.repeat(80));
    console.log('GENERATED OUTPUT (first 3000 chars):');
    console.log('='.repeat(80) + '\n');
    console.log(content.slice(0, 3000));
    if (content.length > 3000) {
      console.log(`\n... (${content.length - 3000} more characters, see full output in file)`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testGeneration();
