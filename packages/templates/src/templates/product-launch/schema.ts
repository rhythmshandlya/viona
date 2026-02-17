import { z } from 'zod';

export const schema = z.object({
  productName: z.string().default('Your Product'),
  tagline: z.string().default('The Future is Here'),
  features: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .default([
      {
        title: 'Lightning Fast',
        description: 'Blazing performance that keeps up with your workflow',
      },
      {
        title: 'Smart Automation',
        description: 'AI-powered tools that work while you sleep',
      },
      {
        title: 'Seamless Integration',
        description: 'Connects with all the tools you already love',
      },
    ]),
  price: z.string().default('$99'),
  ctaText: z.string().default('Get Started'),
  colors: z
    .object({
      primary: z.string().default('#6C2BD9'),
      secondary: z.string().default('#2B1055'),
      accent: z.string().default('#FF6B35'),
      background: z.string().default('#0F0A1A'),
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
    .default('modernTech'),
  sceneDurations: z
    .object({
      intro: z.number().default(112),
      features: z.number().default(113),
      pricing: z.number().default(113),
      cta: z.number().default(112),
    })
    .default({}),
});

export type ProductLaunchProps = z.infer<typeof schema>;

export const defaultProps: ProductLaunchProps = schema.parse({});
