import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('USER GROWTH'),
  points: z.array(z.number()).default([12, 19, 28, 35, 42, 58, 71, 89, 105, 128, 156, 192]),
  xLabels: z.array(z.string()).default(['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']),
  label: z.string().default('Monthly active users (thousands)'),
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

export type StatLineChartProps = z.infer<typeof schema>;
export const defaultProps: StatLineChartProps = schema.parse({});
