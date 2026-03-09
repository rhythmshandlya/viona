import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, projects, tracks, timelineItems, jobs, transcripts } from '../db/index.js';
import { logger } from '../logger.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';

export interface GenerateBrollJobData {
  projectId: string;
  jobId: string;
}

interface CaptionItem {
  id: string;
  startMs: number;
  endMs: number;
  data: {
    text: string;
    words?: Array<{ text: string; startMs: number; endMs: number }>;
  };
}

interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  video_files: PexelsVideoFile[];
  video_pictures: Array<{ id: number; picture: string }>;
  user: { id: number; name: string; url: string };
}

interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  videos: PexelsVideo[];
}

export async function processGenerateBrollJob(job: Job<GenerateBrollJobData>) {
  const { projectId, jobId } = job.data;

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading transcript...');

    // Load project and transcript
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    if (!transcript || !transcript.words) {
      throw new Error('No transcript found. Run transcription first.');
    }

    // Load caption items for segment timing
    const projectTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, projectId),
    });

    const allItems: CaptionItem[] = [];
    for (const track of projectTracks) {
      const items = await db.select().from(timelineItems)
        .where(eq(timelineItems.trackId, track.id));
      for (const item of items) {
        if (item.type === 'caption' || item.type === 'subtitle') {
          allItems.push({
            id: item.id,
            startMs: item.startMs,
            endMs: item.endMs,
            data: item.data as CaptionItem['data'],
          });
        }
      }
    }

    await publishJobProgress(jobId, 10, 'Grouping into segments...');

    // Group captions into ~5-10 second segments
    const segments = groupIntoSegments(allItems, 7000); // ~7 seconds target

    logger.info({ projectId, segmentCount: segments.length }, 'Segments created for B-roll');

    await publishJobProgress(jobId, 15, 'Analyzing transcript with AI...');

    // Generate search queries using LLM
    const segmentQueries = await generateSearchQueries(segments);

    await publishJobProgress(jobId, 35, 'Searching for B-roll clips...');

    // Search Pexels for each segment
    const pexelsApiKey = process.env.PEXELS_API_KEY;
    if (!pexelsApiKey) {
      throw new Error('PEXELS_API_KEY environment variable is required for B-roll generation');
    }

    const brollResults: Array<{
      segment: TranscriptSegment;
      video: PexelsVideo;
      videoFile: PexelsVideoFile;
    }> = [];

    for (let i = 0; i < segmentQueries.length; i++) {
      const { segment, queries } = segmentQueries[i];
      const progress = 35 + Math.round((i / segmentQueries.length) * 40);
      await publishJobProgress(jobId, progress, `Searching B-roll for segment ${i + 1}/${segmentQueries.length}...`);

      // Try each query until we find a good result
      let bestResult: { video: PexelsVideo; videoFile: PexelsVideoFile } | null = null;

      for (const query of queries) {
        try {
          const searchResult = await searchPexelsVideos(pexelsApiKey, query);
          if (searchResult.videos.length > 0) {
            const video = searchResult.videos[0];
            const videoFile = selectBestVideoFile(video.video_files);
            if (videoFile) {
              bestResult = { video, videoFile };
              break;
            }
          }
        } catch (err) {
          logger.warn({ err, query }, 'Pexels search failed for query');
        }
      }

      if (bestResult) {
        brollResults.push({
          segment,
          video: bestResult.video,
          videoFile: bestResult.videoFile,
        });
      }
    }

    await publishJobProgress(jobId, 80, 'Creating B-roll track...');

    // Create broll track
    const [brollTrack] = await db.insert(tracks).values({
      projectId,
      type: 'broll',
      name: 'B-Roll',
      position: 10, // High position to appear above other tracks
    }).returning();

    // Create broll timeline items
    const brollItems = brollResults.map((result) => ({
      trackId: brollTrack.id,
      type: 'broll' as const,
      startMs: result.segment.startMs,
      endMs: result.segment.endMs,
      data: {
        src: result.videoFile.link,
        sourceType: 'pexels' as const,
        pexelsId: result.video.id,
        photographer: result.video.user.name,
        photographerUrl: result.video.user.url,
        width: result.videoFile.width,
        height: result.videoFile.height,
        duration: result.video.duration,
        previewUrl: result.video.image,
        volume: 0, // Muted by default
      },
    }));

    if (brollItems.length > 0) {
      await db.insert(timelineItems).values(brollItems);
    }

    await publishJobProgress(jobId, 95, 'Finalizing...');

    // Complete
    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({
      projectId,
      brollItemCount: brollItems.length,
      segmentCount: segments.length,
    }, 'B-roll generation complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'B-roll generation failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await publishJobError(jobId, errorMessage);

    throw error;
  }
}

/**
 * Group caption items into logical segments of approximately targetMs duration.
 */
function groupIntoSegments(items: CaptionItem[], targetMs: number): TranscriptSegment[] {
  if (items.length === 0) return [];

  // Sort by start time
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);

  const segments: TranscriptSegment[] = [];
  let currentTexts: string[] = [];
  let currentStart = sorted[0].startMs;
  let currentEnd = sorted[0].endMs;

  for (const item of sorted) {
    const currentDuration = currentEnd - currentStart;

    if (currentDuration >= targetMs && currentTexts.length > 0) {
      // Flush current segment
      segments.push({
        text: currentTexts.join(' '),
        startMs: currentStart,
        endMs: currentEnd,
      });
      currentTexts = [];
      currentStart = item.startMs;
    }

    currentTexts.push(item.data.text);
    currentEnd = item.endMs;
  }

  // Flush remaining
  if (currentTexts.length > 0) {
    segments.push({
      text: currentTexts.join(' '),
      startMs: currentStart,
      endMs: currentEnd,
    });
  }

  return segments;
}

/**
 * Call LLM to generate text. Supports Anthropic API directly, Claude Max proxy, or OpenRouter.
 */
async function callLLM(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_MAX_PROXY_URL) {
    // Use Anthropic SDK (direct or via proxy)
    // @ts-expect-error — optional dependency, only used when ANTHROPIC_API_KEY is set
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const config: Record<string, string> = {};
    if (process.env.CLAUDE_MAX_PROXY_URL) {
      config.baseURL = process.env.CLAUDE_MAX_PROXY_URL;
      config.apiKey = process.env.ANTHROPIC_API_KEY || 'proxy';
    }
    const anthropic = new Anthropic(config);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  if (process.env.OPENROUTER_API_KEY) {
    // Use OpenRouter (OpenAI-compatible chat completions)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`);
    }
    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || '';
  }

  throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.');
}

/**
 * Use LLM to analyze transcript segments and generate Pexels search queries.
 */
async function generateSearchQueries(
  segments: TranscriptSegment[],
): Promise<Array<{ segment: TranscriptSegment; queries: string[] }>> {
  const segmentTexts = segments.map((s, i) => `[Segment ${i + 1}]: "${s.text}"`).join('\n');

  const text = await callLLM(`You are helping select stock B-roll footage for a video. For each transcript segment below, suggest 2-3 short Pexels search queries that would find relevant, visually appealing background footage.

Rules:
- Queries should be 1-3 words, generic enough to find results on Pexels
- Focus on visual concepts, not literal words (e.g., "money talk" → "currency close-up", "business meeting")
- Prefer cinematic, professional footage terms
- Avoid overly specific queries that won't return results

Transcript segments:
${segmentTexts}

Respond in JSON format only:
[
  {"segment": 1, "queries": ["query1", "query2", "query3"]},
  ...
]`);

  // Parse JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    // Fallback: generate simple queries from segment text
    return segments.map((segment) => ({
      segment,
      queries: extractFallbackQueries(segment.text),
    }));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ segment: number; queries: string[] }>;
    return parsed.map((p, i) => ({
      segment: segments[Math.min(p.segment - 1, segments.length - 1)] || segments[i],
      queries: p.queries,
    }));
  } catch {
    return segments.map((segment) => ({
      segment,
      queries: extractFallbackQueries(segment.text),
    }));
  }
}

/**
 * Extract simple search queries from text as a fallback.
 */
function extractFallbackQueries(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  // Take up to 3 unique, longer words
  const unique = [...new Set(words)].slice(0, 3);
  return unique.length > 0 ? unique : ['abstract background'];
}

/**
 * Search Pexels Videos API.
 */
async function searchPexelsVideos(
  apiKey: string,
  query: string,
): Promise<PexelsSearchResponse> {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`;

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status}`);
  }

  return response.json() as Promise<PexelsSearchResponse>;
}

/**
 * Select the best video file from Pexels options.
 * Prefers HD quality with reasonable resolution.
 */
function selectBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  if (files.length === 0) return null;

  // Prefer HD quality, then SD
  const hd = files.find(f => f.quality === 'hd' && f.width >= 720);
  if (hd) return hd;

  const sd = files.find(f => f.quality === 'sd' && f.width >= 480);
  if (sd) return sd;

  // Fallback to first available
  return files[0];
}
