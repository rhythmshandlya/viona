import { z } from 'zod';

export const schema = z.object({
  score: z.number().default(4.8),
  maxScore: z.number().default(5),
  reviewCount: z.string().default('2,847 reviews'),
  source: z.string().default('App Store'),
  showStars: z.boolean().default(true),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#F59E0B'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#F59E0B'),
      secondary: z.string().default('#FBBF24'),
      accent: z.string().default('#F59E0B'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type RatingDisplayProps = z.infer<typeof schema>;
export const defaultProps: RatingDisplayProps = schema.parse({});
