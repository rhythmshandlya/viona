import { z } from 'zod';

export const schema = z.object({
  question: z.string().default('How excited are you for this?'),
  emoji: z.string().default('\uD83D\uDD25'),
  result: z.number().min(0).max(100).default(82),
  resultLabel: z.string().default('82% excited'),
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
    .default('friendlyTech'),
  colors: z
    .object({
      primary: z.string().default('#EC4899'),
      secondary: z.string().default('#F472B6'),
      accent: z.string().default('#8B5CF6'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type EmojiSliderPollProps = z.infer<typeof schema>;
export const defaultProps: EmojiSliderPollProps = schema.parse({});
