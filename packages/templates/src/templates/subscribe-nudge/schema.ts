import { z } from 'zod';

export const schema = z.object({
  channelName: z.string().default('Creative Studio'),
  buttonText: z.string().default('Subscribe'),
  showLike: z.boolean().default(true),
  showBell: z.boolean().default(true),
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
    .default('friendlyTech'),
  colors: z
    .object({
      primary: z.string().default('#FF0000'),
      secondary: z.string().default('#FFFFFF'),
      accent: z.string().default('#FF0000'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type SubscribeNudgeProps = z.infer<typeof schema>;
export const defaultProps: SubscribeNudgeProps = schema.parse({});
