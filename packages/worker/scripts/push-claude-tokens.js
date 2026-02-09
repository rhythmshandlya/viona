#!/usr/bin/env node
/**
 * Push local Claude OAuth tokens to Railway production
 *
 * Usage: npm run push-tokens
 *
 * This script reads your local Claude credentials and updates
 * the Railway worker service environment variables.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Find Claude credentials file
function findCredentialsFile() {
  const possiblePaths = [
    join(homedir(), '.claude', '.credentials.json'),
    join(homedir(), '.claude', 'credentials.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

// Read credentials
function readCredentials(path) {
  const content = readFileSync(path, 'utf-8');
  const data = JSON.parse(content);

  const oauth = data.claudeAiOauth;
  if (!oauth || !oauth.accessToken) {
    throw new Error('No OAuth credentials found in credentials file');
  }

  return {
    accessToken: oauth.accessToken,
    refreshToken: oauth.refreshToken || '',
    expiresAt: oauth.expiresAt || 0,
    subscriptionType: oauth.subscriptionType || 'max',
  };
}

// Push to Railway
function pushToRailway(credentials) {
  console.log('Pushing tokens to Railway worker service...\n');

  const variables = [
    `CLAUDE_OAUTH_ACCESS_TOKEN=${credentials.accessToken}`,
    `CLAUDE_OAUTH_REFRESH_TOKEN=${credentials.refreshToken}`,
    `CLAUDE_OAUTH_EXPIRES_AT=${credentials.expiresAt}`,
    `CLAUDE_SUBSCRIPTION_TYPE=${credentials.subscriptionType}`,
  ];

  // Link to worker service first
  try {
    execSync('railway service worker', { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to link to worker service. Make sure you are logged into Railway.');
    process.exit(1);
  }

  // Set variables
  for (const variable of variables) {
    const [key] = variable.split('=');
    console.log(`  Setting ${key}...`);
    try {
      execSync(`railway variables set "${variable}"`, { stdio: 'pipe' });
    } catch (e) {
      console.error(`  Failed to set ${key}`);
      throw e;
    }
  }

  console.log('\nTokens pushed successfully!');

  // Calculate expiry
  if (credentials.expiresAt) {
    const expiresAt = new Date(credentials.expiresAt);
    const now = new Date();
    const minutesRemaining = Math.round((expiresAt - now) / 1000 / 60);
    console.log(`Token expires in ${minutesRemaining} minutes (${expiresAt.toLocaleString()})`);
  }
}

// Main
function main() {
  console.log('Claude Token Push to Railway\n');
  console.log('=============================\n');

  // Find credentials
  const credPath = findCredentialsFile();
  if (!credPath) {
    console.error('No Claude credentials file found.');
    console.error('Run "claude login" first to authenticate.');
    process.exit(1);
  }
  console.log(`Found credentials at: ${credPath}\n`);

  // Read credentials
  let credentials;
  try {
    credentials = readCredentials(credPath);
  } catch (e) {
    console.error(`Failed to read credentials: ${e.message}`);
    process.exit(1);
  }

  // Show token info
  console.log('Token info:');
  console.log(`  Access token: ${credentials.accessToken.substring(0, 20)}...`);
  console.log(`  Has refresh token: ${!!credentials.refreshToken}`);
  console.log(`  Subscription: ${credentials.subscriptionType}`);
  console.log('');

  // Push to Railway
  pushToRailway(credentials);

  console.log('\nTo redeploy the worker with new tokens:');
  console.log('  railway service worker && railway up');
}

main();
