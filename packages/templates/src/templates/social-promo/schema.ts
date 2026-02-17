import { z } from 'zod';

export const schema = z.object({
  hookText: z.string().default('Stop Scrolling!'),
  benefits: z
    .array(z.string())
    .default(['Save 10+ hours/week', 'Boost engagement 3x', 'Grow faster']),
  testimonial: z
    .object({
      quote: z.string().default('This changed everything for me!'),
      author: z.string().default('Sarah K.'),
    })
    .default({}),
  socialHandles: z
    .object({
      instagram: z.string().default('@yourbrand'),
      tiktok: z.string().default('@yourbrand'),
    })
    .default({}),
  ctaText: z.string().default('Link in Bio'),
  colors: z
    .object({
      primary: z.string().default('#FF2D55'),
      secondary: z.string().default('#7B2FF7'),
      accent: z.string().default('#FFD60A'),
      background: z.string().default('#1A1A2E'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
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
});

export type SocialPromoProps = z.infer<typeof schema>;

export const defaultProps: SocialPromoProps = schema.parse({});
