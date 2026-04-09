import { z } from 'zod';

export const schema = z.object({
  title: z.string().optional().default('The Conflict Zone'),
  /** Country name — must match an entry in the country database */
  countryName: z.string().default('Iraq'),
  countryCode: z.string().optional().default('IRQ'),
  /** Map tile style */
  mapStyle: z.enum(['satellite', 'toner', 'tonerLite', 'terrain', 'osm']).default('satellite'),
  /** Highlight color for the country overlay */
  highlightColor: z.string().default('#FFEB00'),
  highlightOpacity: z.number().min(0).max(1).default(0.35),
  /** City pin */
  cityName: z.string().optional().default('Baghdad'),
  cityLat: z.number().optional().default(33.3152),
  cityLng: z.number().optional().default(44.3661),
  /** Show country name label */
  showCountryName: z.boolean().default(true),
  /** Map padding */
  mapPadding: z.number().min(50).max(300).default(140),
  /** Animation style */
  animationStyle: z.enum(['smoothZoom', 'dramaticZoom', 'kenBurns']).default('smoothZoom'),
});

export type VoxMapProps = z.infer<typeof schema>;
export const defaultProps: VoxMapProps = schema.parse({});
