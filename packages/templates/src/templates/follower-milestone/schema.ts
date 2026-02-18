import { z } from 'zod';

export const schema = z.object({
  milestone: z.number().default(100000),
  label: z.string().default('SUBSCRIBERS'),
  brandName: z.string().default('Creative Studio'),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
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
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#A0A0A0'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0A0A1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type FollowerMilestoneProps = z.infer<typeof schema>;

export const defaultProps: FollowerMilestoneProps = schema.parse({});
