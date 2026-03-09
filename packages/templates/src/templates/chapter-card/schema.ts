import { z } from 'zod';

export const schema = z.object({
  chapterNumber: z.number().min(1).max(99).default(1),
  chapterTitle: z.string().default('Getting Started'),
  subtitle: z.string().optional().default('The fundamentals you need to know'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#A0A0A0'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0A0A0A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type ChapterCardProps = z.infer<typeof schema>;

export const defaultProps: ChapterCardProps = schema.parse({});
