import { z } from 'zod';

export const schema = z.object({
  score: z.number().min(0).max(100).default(78),
  label: z.string().default('Performance Score'),
  maxScore: z.number().default(100),
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
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type ScoreMeterProps = z.infer<typeof schema>;
export const defaultProps: ScoreMeterProps = schema.parse({});
