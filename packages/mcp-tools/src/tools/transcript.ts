const API_URL = process.env.CLIPIFY_API_URL || 'http://localhost:4000';

export const transcriptTool = {
  name: 'getTranscript',
  description: 'Fetch the transcript for a Clipify project with word-level timestamps.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      projectId: {
        type: 'string',
        description: 'The Clipify project ID to fetch transcript for',
      },
    },
    required: ['projectId'],
  },
};

interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
}

interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptWord[];
}

interface TranscriptResponse {
  segments: TranscriptSegment[];
}

export async function handleTranscript(args: unknown): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  const { projectId } = args as { projectId: string };

  try {
    // Fetch project with transcript from Clipify API
    const response = await fetch(`${API_URL}/api/projects/${projectId}`);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const project = await response.json();

    if (!project.transcript) {
      return {
        content: [
          {
            type: 'text',
            text: `No transcript found for project ${projectId}`,
          },
        ],
      };
    }

    // Transform transcript data to expected format
    const transcript: TranscriptResponse = {
      segments: project.transcript.words
        ? groupWordsIntoSegments(project.transcript.words)
        : [],
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(transcript, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Failed to fetch transcript: ${errorMessage}`,
        },
      ],
    };
  }
}

// Group words into segments (sentences/phrases) for easier processing
function groupWordsIntoSegments(words: TranscriptWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentSegment: TranscriptWord[] = [];
  let segmentStartMs = 0;

  for (const word of words) {
    if (currentSegment.length === 0) {
      segmentStartMs = word.startMs;
    }

    currentSegment.push(word);

    // Split on sentence-ending punctuation or after ~5 seconds
    const text = word.text.trim();
    const isEndOfSentence = /[.!?]$/.test(text);
    const segmentDuration = word.endMs - segmentStartMs;

    if (isEndOfSentence || segmentDuration > 5000) {
      segments.push({
        startMs: segmentStartMs,
        endMs: word.endMs,
        text: currentSegment.map(w => w.text).join(' '),
        words: currentSegment,
      });
      currentSegment = [];
    }
  }

  // Add remaining words as final segment
  if (currentSegment.length > 0) {
    segments.push({
      startMs: segmentStartMs,
      endMs: currentSegment[currentSegment.length - 1].endMs,
      text: currentSegment.map(w => w.text).join(' '),
      words: currentSegment,
    });
  }

  return segments;
}
