import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('The Future of AI'),
  subtitle: z.string().default('Why 2026 Changes Everything'),
  tag: z.string().default('DEEP DIVE'),
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
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type TopicTitleProps = z.infer<typeof schema>;
export const defaultProps: TopicTitleProps = schema.parse({});
