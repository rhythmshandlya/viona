#!/usr/bin/env tsx
/**
 * CLI wrapper for template resolution.
 * Called by the Python visual generator after Director writes scenes.json.
 *
 * Usage: tsx resolve-templates-cli.ts <scenes-json-path> <workspace-src-path>
 * Output: JSON to stdout with resolved template markdown for Animator prompt.
 */
import { readFileSync } from 'fs';
import { resolveSelectedTemplates, formatTemplatesForAnimator } from './template-resolver.js';

const [scenesPath, workspaceSrc] = process.argv.slice(2);
if (!scenesPath || !workspaceSrc) {
  console.error('Usage: tsx resolve-templates-cli.ts <scenes.json> <workspace-src>');
  process.exit(1);
}

const scenesJson = JSON.parse(readFileSync(scenesPath, 'utf-8'));
const resolved = resolveSelectedTemplates(scenesJson, workspaceSrc);
const markdown = formatTemplatesForAnimator(resolved);

// Output JSON so Python can parse it
console.log(JSON.stringify({ markdown, copiedCount: resolved.copiedCount }));
