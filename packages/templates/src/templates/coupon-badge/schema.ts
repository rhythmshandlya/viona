import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('USE CODE'),
  code: z.string().default('SAVE20'),
  description: z.string().default('20% Off Your First Order'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#EC4899'),
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
      primary: z.string().default('#EC4899'),
      secondary: z.string().default('#F9A8D4'),
      accent: z.string().default('#F472B6'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type CouponBadgeProps = z.infer<typeof schema>;
export const defaultProps: CouponBadgeProps = schema.parse({});
