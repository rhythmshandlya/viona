import { z } from 'zod';

const coordSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const schema = z.object({
  startCoord: coordSchema.default({ lat: 48.8566, lng: 2.3522, label: 'Paris' }),
  endCoord: coordSchema.default({ lat: 41.9028, lng: 12.4964, label: 'Rome' }),
  destinationName: z.string().default('Rome'),
  greeting: z.string().default('Greetings from'),
  stampColor: z.string().default('#C0392B'),
  borderStyle: z.enum(['classic', 'modern', 'ornate']).default('classic'),
  showPostmark: z.boolean().default(true),
  mapStyle: z
    .enum(['satellite', 'watercolor', 'toner', 'tonerLite', 'terrain', 'osm'])
    .default('satellite'),
  mapPadding: z.number().min(50).max(300).default(150),
  curveIntensity: z.number().min(0).max(1).default(0.3),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('elegantEditorial'),
  colors: z
    .object({
      primary: z.string().default('#C0392B'),
      secondary: z.string().default('#2C3E50'),
      accent: z.string().default('#D4A962'),
      background: z.string().default('#FFF8E7'),
      text: z.string().default('#2C3E50'),
    })
    .default({}),
});

export type PostcardRevealProps = z.infer<typeof schema>;

export type Coord = z.infer<typeof coordSchema>;

export const defaultProps: PostcardRevealProps = schema.parse({});
