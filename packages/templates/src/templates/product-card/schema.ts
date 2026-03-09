import { z } from 'zod';

export const schema = z.object({
  productName: z.string().default('AirPods Pro 3'),
  price: z.string().default('$249'),
  originalPrice: z.string().optional().default('$279'),
  tagline: z
    .string()
    .default(
      'Adaptive Audio. Personalized Spatial Audio. A magical listening experience.'
    ),
  rating: z.number().min(1).max(5).default(4.8),
  showRating: z.boolean().default(true),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
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
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#A0A0B0'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0A0A0F'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type ProductCardProps = z.infer<typeof schema>;

export const defaultProps: ProductCardProps = schema.parse({});
