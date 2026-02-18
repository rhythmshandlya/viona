import { z } from 'zod';

const raceItemSchema = z.object({
  name: z.string(),
  values: z.array(z.number()),
  color: z.string().optional(),
});

export const schema = z.object({
  title: z.string().default('TOP COUNTRIES BY GDP'),
  items: z.array(raceItemSchema).default([
    { name: 'United States', values: [10300, 13000, 15000, 18200, 21400, 25500], color: '#3B82F6' },
    { name: 'China', values: [1200, 2300, 6100, 11100, 14700, 17900], color: '#EF4444' },
    { name: 'Japan', values: [4200, 4600, 5700, 4400, 5100, 4200], color: '#F59E0B' },
    { name: 'Germany', values: [1900, 2800, 3400, 3400, 3800, 4100], color: '#10B981' },
    { name: 'United Kingdom', values: [1600, 2400, 2500, 2900, 2800, 3100], color: '#8B5CF6' },
    { name: 'India', values: [460, 820, 1700, 2100, 2700, 3500], color: '#EC4899' },
    { name: 'France', values: [1400, 2200, 2600, 2400, 2700, 2800], color: '#6366F1' },
    { name: 'Brazil', values: [650, 890, 2200, 1800, 1400, 1900], color: '#14B8A6' },
  ]),
  timeLabels: z.array(z.string()).default(['2000', '2005', '2010', '2015', '2020', '2025']),
  maxVisible: z.number().min(3).max(12).default(8),
  valuePrefix: z.string().default('$'),
  valueSuffix: z.string().default('B'),
  barColors: z
    .array(z.string())
    .default(['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6']),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('boldImpact'),
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

export type BarChartRaceProps = z.infer<typeof schema>;
export const defaultProps: BarChartRaceProps = schema.parse({});
