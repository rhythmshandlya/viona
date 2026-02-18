import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Year Over Year Growth'),
  leftValue: z.number().default(2400),
  leftLabel: z.string().default('2024'),
  rightValue: z.number().default(5200),
  rightLabel: z.string().default('2025'),
  prefix: z.string().default('$'),
  suffix: z.string().default(''),
  dividerText: z.string().default('VS'),
  leftColor: z.string().default('#64748B'),
  rightColor: z.string().default('#10B981'),
  background: z.enum(['dark', 'light']).default('dark'),
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
      secondary: z.string().default('#94A3B8'),
      accent: z.string().default('#F59E0B'),
      background: z.string().default('#0F172A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type SplitStatProps = z.infer<typeof schema>;

export const defaultProps: SplitStatProps = schema.parse({});
