import { z } from 'zod';

export const schema = z.object({
  quote: z
    .string()
    .default(
      'This product completely transformed our workflow. The team productivity increased by 40% in just two weeks.'
    ),
  authorName: z.string().default('Sarah Chen'),
  authorTitle: z.string().default('VP of Engineering, TechCorp'),
  rating: z.number().min(1).max(5).default(5),
  showStars: z.boolean().default(true),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#F59E0B'),
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
      primary: z.string().default('#F59E0B'),
      secondary: z.string().default('#FCD34D'),
      accent: z.string().default('#F59E0B'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type TestimonialCardProps = z.infer<typeof schema>;
export const defaultProps: TestimonialCardProps = schema.parse({});
