import { z } from 'zod';

export const schema = z.object({
  // Video source
  clipUrl: z.string().describe('URL to the downloaded clip in storage'),
  clipId: z.string().optional().describe('ID of the clip in storage'),
  sourceUrl: z.string().optional().describe('Original YouTube URL'),
  sourceTitle: z.string().optional().describe('Original video title'),

  // Trimming within the clip (relative to downloaded clip, not original video)
  trimStartSeconds: z.number().min(0).default(0).describe('Start trim within clip'),
  trimEndSeconds: z.number().optional().describe('End trim within clip (defaults to clip duration)'),

  // Volume
  volume: z.number().min(0).max(1).default(1).describe('Audio volume (0-1)'),

  // Visual styling
  border: z
    .enum(['none', 'thin', 'medium', 'thick'])
    .default('none')
    .describe('Border thickness'),
  borderColor: z.string().default('#FFFFFF').describe('Border color'),
  borderRadius: z.number().min(0).max(100).default(0).describe('Corner radius in pixels'),

  // Frame/device mockup
  frame: z
    .enum(['none', 'phone', 'laptop', 'browser', 'polaroid', 'film'])
    .default('none')
    .describe('Decorative frame around video'),

  // Shadow and depth
  shadowIntensity: z
    .enum(['none', 'subtle', 'medium', 'strong'])
    .default('none')
    .describe('Drop shadow intensity'),

  // Transform
  scale: z.number().min(0.1).max(2).default(1).describe('Scale factor'),
  offsetX: z.number().default(0).describe('Horizontal offset in pixels'),
  offsetY: z.number().default(0).describe('Vertical offset in pixels'),

  // Background (visible when video doesn't fill frame)
  backgroundColor: z.string().default('#000000').describe('Background color behind video'),

  // Playback
  playbackRate: z.number().min(0.25).max(4).default(1).describe('Playback speed'),
  loop: z.boolean().default(false).describe('Loop video'),
  muted: z.boolean().default(true).describe('Mute audio'),
});

export type YouTubeClipProps = z.infer<typeof schema>;

export const defaultProps: YouTubeClipProps = schema.parse({
  clipUrl: '',
});
