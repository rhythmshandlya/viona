import { z } from 'zod';

const segmentSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
});

export const schema = z.object({
  title: z.string().default('REVENUE BREAKDOWN'),
  centerLabel: z.string().default('$4.8M'),
  segments: z.array(segmentSchema).default([
    { label: 'Subscriptions', value: 58, color: '#6366F1' },
    { label: 'Enterprise', value: 24, color: '#EC4899' },
    { label: 'Services', value: 12, color: '#F59E0B' },
    { label: 'Other', value: 6, color: '#10B981' },
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

export type StatDonutProps = z.infer<typeof schema>;
export const defaultProps: StatDonutProps = schema.parse({});
