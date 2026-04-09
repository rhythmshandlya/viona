import { z } from 'zod';

export const schema = z.object({
  countryName: z.string().default('Iraq'),
  countryCode: z.string().optional().default('IRQ'),
  cityName: z.string().optional().default('Baghdad'),
  cityLat: z.number().optional().default(33.3152),
  cityLng: z.number().optional().default(44.3661),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm'])
    .default('toner'),
  mapPadding: z.number().min(50).max(300).default(120),
  highlightColor: z.string().default('#FFEB00'),
  highlightOpacity: z.number().min(0).max(1).default(0.5),
  showBorder: z.boolean().default(true),
  borderColor: z.string().default('#FFEB00'),
  borderWidth: z.number().min(1).max(10).default(3),
  showCountryName: z.boolean().default(true),
  countryNameSize: z.number().min(30).max(200).default(100),
  showCityMarker: z.boolean().default(true),
  animationStyle: z.enum(['smoothZoom', 'dramaticZoom', 'kenBurns']).default('smoothZoom'),
});

export type VoxMapProps = z.infer<typeof schema>;
export const defaultProps: VoxMapProps = schema.parse({});
