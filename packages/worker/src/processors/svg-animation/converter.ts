/**
 * Image-to-SVG conversion utilities
 */

import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import OpenAI from 'openai';
import { db, transcripts } from '../../db/index.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

/**
 * Extract keywords from description to search in transcript.
 * Looks for patterns like "when I say X", "at X", "during X", etc.
 */
export function extractSearchKeywords(description: string): string | null {
  if (!description) return null;

  const lowerDesc = description.toLowerCase();

  // Patterns to extract the target phrase
  const patterns = [
    /when\s+(?:i\s+)?(?:say|mention|talk\s+about)\s+["']?([^"']+?)["']?$/i,
    /at\s+["']?([^"']+?)["']?$/i,
    /during\s+["']?([^"']+?)["']?$/i,
    /for\s+["']?([^"']+?)["']?$/i,
    /show\s+(?:this\s+)?(?:when|at|during)\s+["']?([^"']+?)["']?$/i,
    /add\s+(?:this\s+)?(?:when|at|during)\s+["']?([^"']+?)["']?$/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no pattern matched, use the whole description as keyword
  return description.trim();
}

/**
 * Search transcript for a phrase and return the timestamp when it starts.
 */
export async function findTimestampInTranscript(
  projectId: string,
  searchPhrase: string
): Promise<number | null> {
  try {
    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    if (!transcript?.words || !Array.isArray(transcript.words)) {
      logger.warn({ projectId }, 'No transcript words found');
      return null;
    }

    const words = transcript.words as Array<{ text: string; startMs: number; endMs: number }>;
    const searchWords = searchPhrase.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    if (searchWords.length === 0) return null;

    // Search for the phrase in the transcript
    for (let i = 0; i <= words.length - searchWords.length; i++) {
      let match = true;
      for (let j = 0; j < searchWords.length; j++) {
        const wordText = words[i + j]?.text?.toLowerCase().replace(/[^\w]/g, '') || '';
        const searchWord = searchWords[j].replace(/[^\w]/g, '');
        if (!wordText.includes(searchWord) && !searchWord.includes(wordText)) {
          match = false;
          break;
        }
      }
      if (match) {
        const startMs = words[i].startMs;
        logger.info({ projectId, searchPhrase, startMs, matchedAt: i }, 'Found phrase in transcript');
        return startMs;
      }
    }

    // If exact phrase not found, try to find individual words
    for (const searchWord of searchWords) {
      const cleanSearchWord = searchWord.replace(/[^\w]/g, '');
      for (const word of words) {
        const wordText = word.text?.toLowerCase().replace(/[^\w]/g, '') || '';
        if (wordText === cleanSearchWord || wordText.includes(cleanSearchWord)) {
          logger.info({ projectId, searchWord, startMs: word.startMs }, 'Found word in transcript');
          return word.startMs;
        }
      }
    }

    logger.warn({ projectId, searchPhrase }, 'Phrase not found in transcript');
    return null;
  } catch (err) {
    logger.error({ projectId, searchPhrase, err }, 'Error searching transcript');
    return null;
  }
}

/**
 * Convert image to SVG using OpenAI Vision API
 */
export async function convertImageToSvg(
  imagePath: string,
  width: number,
  height: number,
  animationType: 'draw' | 'motion'
): Promise<string> {
  const openai = new OpenAI({
    apiKey: config.transcription.openaiApiKey,
  });

  // Read image as base64
  const imageBuffer = await readFile(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  // Determine media type from file extension
  const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
  const mediaTypeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const mediaType = mediaTypeMap[ext] || 'image/png';

  const animationHint = animationType === 'draw'
    ? 'The SVG will be used for a stroke-drawing animation, so use path elements with well-defined strokes.'
    : 'The SVG will be used for motion animations (scale, translate, rotate, fade), so group related elements logically.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mediaType};base64,${imageBase64}`,
          },
        },
        {
          type: 'text',
          text: `Convert this image to clean, optimized SVG code for animation.

Requirements:
- Use path elements with clear strokes (for draw animations)
- Group related elements with <g> tags and meaningful IDs
- Add meaningful IDs to all animatable elements (e.g., id="main-shape", id="accent-line-1")
- Use viewBox proportional to ${width}x${height}
- Keep the SVG clean and optimized - remove unnecessary attributes
- Use currentColor or explicit colors that can be easily modified
- ${animationHint}

Return ONLY the SVG code, nothing else. No explanations, no markdown code blocks - just the raw SVG starting with <svg and ending with </svg>.`,
        },
      ],
    }],
  });

  // Extract SVG from response
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No SVG content in OpenAI Vision response');
  }

  let svg = content.trim();

  // Clean up response - remove markdown code blocks if present
  if (svg.startsWith('```')) {
    svg = svg.replace(/^```(?:svg|xml)?\n?/, '').replace(/\n?```$/, '');
  }

  // Validate it's actually SVG
  if (!svg.startsWith('<svg') || !svg.includes('</svg>')) {
    throw new Error('Invalid SVG response from OpenAI Vision');
  }

  return svg;
}
