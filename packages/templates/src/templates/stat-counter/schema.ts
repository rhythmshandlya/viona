import { z } from 'zod';

const trendSchema = z.object({
  direction: z.enum(['up', 'down']),
  value: z.string(),
});

export const schema = z.object({
  title: z.string().default('MONTHLY RECURRING REVENUE'),
  value: z.number().default(2400000),
  prefix: z.string().default('$'),
  suffix: z.string().default(''),
  decimals: z.number().default(0),
  label: z.string().default('SaaS Analytics — Q4 2025'),
  trend: trendSchema.default({ direction: 'up', value: '+23% MoM' }),
  cardStyle: z.enum(['glass', 'solid', 'gradient', 'outline']).default('glass'),
  background: z.enum(['dark', 'light', 'gradient']).default('dark'),
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
    .default('cleanMinimal'),
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

export type StatCounterProps = z.infer<typeof schema>;
export const defaultProps: StatCounterProps = schema.parse({});
