import { z } from 'zod';

const compareValueSchema = z.object({
  value: z.number(),
  label: z.string(),
});

export const schema = z.object({
  title: z.string().default('YEAR OVER YEAR'),
  compareFrom: compareValueSchema.default({ value: 1200000, label: '2024' }),
  compareTo: compareValueSchema.default({ value: 2400000, label: '2025' }),
  changeLabel: z.string().default('+100% Growth'),
  prefix: z.string().default('$'),
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

export type StatComparisonProps = z.infer<typeof schema>;
export const defaultProps: StatComparisonProps = schema.parse({});
