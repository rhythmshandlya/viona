import { z } from 'zod';

export const schema = z.object({
  emojis: z
    .array(z.string())
    .default(['\uD83D\uDD25', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDC4F', '\uD83D\uDCAF', '\uD83C\uDF89', '\u2728', '\uD83D\uDE80']),
  particleCount: z.number().default(35),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#EC4899'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'newspaperClassic',
      'cleanMinimal',
    ])
    .default('friendlyTech'),
  colors: z
    .object({
      primary: z.string().default('#EC4899'),
      secondary: z.string().default('#F472B6'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type EmojiBurstProps = z.infer<typeof schema>;

export const defaultProps: EmojiBurstProps = schema.parse({});
