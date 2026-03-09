import { z } from 'zod';

const progressItemSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
});

export const schema = z.object({
  title: z.string().default('Q4 OBJECTIVES'),
  items: z.array(progressItemSchema).default([
    { label: 'Revenue Target', value: 87 },
    { label: 'User Acquisition', value: 94 },
    { label: 'NPS Score', value: 72 },
    { label: 'Churn Rate', value: 45 },
  ]),
  cardStyle: z.enum(['glass', 'solid', 'gradient', 'outline']).default('glass'),
  background: z.enum(['dark', 'light', 'gradient']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  chartColors: z
    .array(z.string())
    .default(['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6']),
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

export type StatProgressProps = z.infer<typeof schema>;
export const defaultProps: StatProgressProps = schema.parse({});
