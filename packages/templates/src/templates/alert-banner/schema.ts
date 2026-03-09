import { z } from 'zod';

export const schema = z.object({
  text: z.string().default('Important: Limited Time Offer Ends Tonight'),
  severity: z.enum(['info', 'warning', 'urgent']).default('urgent'),
  showIcon: z.boolean().default(true),
  background: z.enum(['dark', 'light']).default('dark'),
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
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#CCCCCC'),
      accent: z.string().default('#EF4444'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type AlertBannerProps = z.infer<typeof schema>;
export const defaultProps: AlertBannerProps = schema.parse({});
