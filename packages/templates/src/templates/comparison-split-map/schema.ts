import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

const mapStyleEnum = z.enum([
  'satellite',
  'watercolor',
  'toner',
  'tonerLite',
  'terrain',
  'osm',
  'darkMatter',
  'voyager',
  'positron',
]);

export const schema = z.object({
  centerCoord: coordSchema.default({ lat: 40.7128, lng: -74.006, label: 'New York' }),
  leftMapStyle: mapStyleEnum.default('satellite'),
  rightMapStyle: mapStyleEnum.default('satellite'),
  leftLabel: z.string().default('Before'),
  rightLabel: z.string().default('After'),
  showLabels: z.boolean().default(true),
  dividerColor: z.string().default('#FFFFFF'),
  mapPadding: z.number().min(50).max(400).default(150),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#7C3AED'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#FFFFFF'),
      background: z.string().default('#1a1a1a'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type ComparisonSplitMapProps = z.infer<typeof schema>;
export const defaultProps: ComparisonSplitMapProps = schema.parse({});
