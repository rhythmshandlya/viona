import { z } from 'zod';

const keywordSchema = z.object({
  word: z.string(),
  subtitle: z.string().optional(),
});

export const schema = z.object({
  keywords: z
    .array(keywordSchema)
    .default([
      { word: 'INNOVATION', subtitle: 'The key to growth' },
      { word: 'DISRUPTION', subtitle: 'Breaking old patterns' },
      { word: 'SCALE', subtitle: 'Growing without limits' },
    ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#EC4899'),
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
      primary: z.string().default('#EC4899'),
      secondary: z.string().default('#A855F7'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type KeywordPopProps = z.infer<typeof schema>;

export type Keyword = z.infer<typeof keywordSchema>;

export const defaultProps: KeywordPopProps = schema.parse({});
