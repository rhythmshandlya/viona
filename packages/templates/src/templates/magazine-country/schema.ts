import { z } from 'zod';

export const schema = z.object({
  countryName: z.string().default('United Kingdom'),
  countryCode: z.string().optional().default('GBR'),
  cityName: z.string().optional().default('London'),
  cityLat: z.number().optional().default(51.5074),
  cityLng: z.number().optional().default(-0.1278),
  showCityMarker: z.boolean().default(true),
  showCountryName: z.boolean().default(true),
  countryNameSize: z.number().min(30).max(200).default(100),
  capital: z.string().optional().default('London'),
  population: z.string().optional().default('67.7 million'),
  region: z.string().optional().default('Western Europe'),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm'])
    .default('tonerLite'),
  mapPadding: z.number().min(50).max(300).default(150),
  highlightColor: z.string().default('#e11d48'),
  highlightOpacity: z.number().min(0).max(1).default(0.35),
  showBorder: z.boolean().default(true),
  borderColor: z.string().default('#e11d48'),
  borderWidth: z.number().min(1).max(10).default(2),
  animationStyle: z.enum(['smoothZoom', 'dramaticZoom', 'kenBurns']).default('smoothZoom'),
});

export type MagazineCountryProps = z.infer<typeof schema>;
export const defaultProps: MagazineCountryProps = schema.parse({});
