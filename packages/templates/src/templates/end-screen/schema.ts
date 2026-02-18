import { z } from 'zod';

export const schema = z.object({
  channelName: z.string().default('Creative Studio'),
  leftLabel: z.string().default('Watch Next'),
  rightLabel: z.string().default('Recommended'),
  buttonText: z.string().default('SUBSCRIBE'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#FF0000'),
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
      primary: z.string().default('#FF0000'),
      secondary: z.string().default('#AAAAAA'),
      accent: z.string().default('#FF0000'),
      background: z.string().default('#0F0F0F'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type EndScreenProps = z.infer<typeof schema>;
export const defaultProps: EndScreenProps = schema.parse({});
