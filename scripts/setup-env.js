#!/usr/bin/env node

/**
 * Cross-platform environment setup script
 * Copies .env.example files to .env for local development
 */

const { copyFileSync, existsSync } = require('fs');
const { join } = require('path');

const rootDir = join(__dirname, '..');

const envFiles = [
  {
    source: 'packages/api/.env.example',
    target: 'packages/api/.env',
  },
  {
    source: 'packages/worker/.env.example',
    target: 'packages/worker/.env',
  },
  {
    source: 'apps/web/.env.example',
    target: 'apps/web/.env.local',
  },
];

console.log('Setting up environment files...\n');

for (const { source, target } of envFiles) {
  const sourcePath = join(rootDir, source);
  const targetPath = join(rootDir, target);

  if (!existsSync(sourcePath)) {
    console.log(`  [SKIP] ${source} (not found)`);
    continue;
  }

  if (existsSync(targetPath)) {
    console.log(`  [SKIP] ${target} (already exists)`);
    continue;
  }

  try {
    copyFileSync(sourcePath, targetPath);
    console.log(`  [OK]   ${source} -> ${target}`);
  } catch (error) {
    console.error(`  [ERR]  Failed to copy ${source}: ${error.message}`);
  }
}

console.log('\nDone! Review the .env files and update values as needed.');
console.log('\nNext steps:');
console.log('  1. pnpm docker:up     # Start PostgreSQL, Redis, MinIO');
console.log('  2. pnpm db:migrate    # Run database migrations');
console.log('  3. pnpm dev           # Start development servers');
