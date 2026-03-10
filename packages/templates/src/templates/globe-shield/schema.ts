import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const schema = z.object({
  ringStyle: z.enum(['polar', 'equatorial', 'multi-point']).default('polar'),
  customSources: z.array(coordSchema).default([]),
  ringColor: z.string().default('#00BFFF'),
  ringMaxRadius: z.number().min(30).max(180).default(120),
  ringPropagationSpeed: z.number().min(1).max(50).default(18),
  ringRepeatPeriod: z.number().min(50).max(2000).default(200),
  ringLayers: z.number().min(1).max(3).default(1),
  globeTexture: z.enum(['blue-marble', 'dark', 'night']).default('dark'),
  showAtmosphere: z.boolean().default(true),
  showStars: z.boolean().default(true),
  title: z.string().default('EARTH SHIELD'),
  showTitle: z.boolean().default(true),
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
      primary: z.string().default('#00BFFF'),
      secondary: z.string().default('#0a0a1a'),
      accent: z.string().default('#00FFCC'),
      background: z.string().default('#050510'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type GlobeShieldProps = z.infer<typeof schema>;

export const defaultProps: GlobeShieldProps = schema.parse({});
