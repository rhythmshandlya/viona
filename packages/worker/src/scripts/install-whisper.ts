import { installWhisperCpp, downloadWhisperModel } from '@remotion/install-whisper-cpp';
import { config } from '../config.js';

async function main() {
  console.log('Installing Whisper.cpp...');
  console.log(`Path: ${config.whisper.path}`);
  console.log(`Model: ${config.whisper.model}`);

  try {
    // Install Whisper.cpp
    console.log('\n1. Installing Whisper.cpp binary...');
    await installWhisperCpp({
      to: config.whisper.path,
      version: '1.5.5',
    });
    console.log('Whisper.cpp installed successfully!');

    // Download model
    console.log(`\n2. Downloading ${config.whisper.model} model...`);
    console.log('This may take a while depending on your connection...');

    await downloadWhisperModel({
      model: config.whisper.model as any,
      folder: config.whisper.path,
    });
    console.log('Model downloaded successfully!');

    console.log('\nWhisper installation complete!');
  } catch (error) {
    console.error('Failed to install Whisper:', error);
    process.exit(1);
  }
}

main();
