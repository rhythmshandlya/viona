import { z } from 'zod';

const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const schema = z.object({
  title: z.string().default('THE TRANSFORMATION'),
  beforeLabel: z.string().default('BEFORE'),
  afterLabel: z.string().default('AFTER'),
  beforeMetrics: z.array(metricSchema).default([
    { label: 'Followers', value: '1,200' },
    { label: 'Engagement', value: '2.1%' },
    { label: 'Revenue', value: '$3K' },
  ]),
  afterMetrics: z.array(metricSchema).default([
    { label: 'Followers', value: '45,000' },
    { label: 'Engagement', value: '8.7%' },
    { label: 'Revenue', value: '$52K' },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  beforeColor: z.string().default('#EF4444'),
  afterColor: z.string().default('#10B981'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('boldImpact'),
  colors: z.object({
    primary: z.string().default('#6366F1'),
    secondary: z.string().default('#A5B4FC'),
    accent: z.string().default('#EC4899'),
    background: z.string().default('#0B0F1A'),
    text: z.string().default('#FFFFFF'),
  }).default({}),
});

export type BeforeAfterRevealProps = z.infer<typeof schema>;
export const defaultProps: BeforeAfterRevealProps = schema.parse({});
