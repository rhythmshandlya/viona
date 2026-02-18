import { z } from 'zod';

export const schema = z.object({
  quote: z
    .string()
    .default(
      'Companies that invest in employee experience are 4x more profitable than those that don\u2019t.'
    ),
  author: z.string().default('Jacob Morgan'),
  publication: z.string().default('Harvard Business Review'),
  date: z.string().default('2024'),
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
    .default('elegantEditorial'),
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

export type SourceCiteProps = z.infer<typeof schema>;
export const defaultProps: SourceCiteProps = schema.parse({});
