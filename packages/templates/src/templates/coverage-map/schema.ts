import { z } from 'zod';

const waveSchema = z.object({
  radius: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  centerCoord: z
    .object({
      lat: z.number(),
      lng: z.number(),
      label: z.string(),
    })
    .default({ lat: 40.7128, lng: -74.006, label: 'HQ - New York' }),
  waves: z
    .array(waveSchema)
    .default([
      { radius: 50000, label: 'Phase 1' },
      { radius: 150000, label: 'Phase 2' },
      { radius: 300000, label: 'Phase 3' },
    ]),
  title: z.string().default('Service Coverage'),
  coverageColor: z.string().default('#7C3AED'),
  showStats: z.boolean().default(true),
  mapStyle: z
    .enum([
      'satellite',
      'watercolor',
      'toner',
      'tonerLite',
      'terrain',
      'osm',
      'darkMatter',
      'voyager',
      'positron',
    ])
    .default('satellite'),
  mapPadding: z.number().min(50).max(400).default(100),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#7C3AED'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#00D4FF'),
      background: z.string().default('#F2F2F2'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type CoverageMapProps = z.infer<typeof schema>;

export const defaultProps: CoverageMapProps = schema.parse({});
