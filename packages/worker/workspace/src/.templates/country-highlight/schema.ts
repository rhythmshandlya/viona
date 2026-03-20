import { z } from 'zod';

export const schema = z.object({
  countryName: z.string().default('United Kingdom'),
  countryCode: z.string().optional().default('GBR'),
  cityName: z.string().optional().default('London'),
  cityLat: z.number().optional().default(51.5074),
  cityLng: z.number().optional().default(-0.1278),
  transparent: z.boolean().default(false),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm'])
    .default('satellite'),
  mapPadding: z.number().min(50).max(300).default(120),
  highlightColor: z.string().default('#CC0000'),
  highlightOpacity: z.number().min(0).max(1).default(0.45),
  showBorder: z.boolean().default(true),
  borderColor: z.string().default('#FFFFFF'),
  borderWidth: z.number().min(1).max(10).default(3),
  showCountryName: z.boolean().default(false),
  countryNameSize: z.number().min(30).max(200).default(100),
  showCityMarker: z.boolean().default(false),
  animationStyle: z.enum(['smoothZoom', 'dramaticZoom', 'kenBurns']).default('smoothZoom'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#CC0000'),
      secondary: z.string().default('#1a1a2e'),
      accent: z.string().default('#E67E22'),
      background: z.string().default('#0f0f23'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type CountryHighlightProps = z.infer<typeof schema>;

export const defaultProps: CountryHighlightProps = schema.parse({});
