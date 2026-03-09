import { z } from 'zod';

export const schema = z.object({
  channelName: z.string().default('CREATIVE STUDIO'),
  tagline: z.string().default('Design \u2022 Create \u2022 Inspire'),
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
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type ChannelIntroProps = z.infer<typeof schema>;
export const defaultProps: ChannelIntroProps = schema.parse({});
