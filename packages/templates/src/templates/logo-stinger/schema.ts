import { z } from 'zod';

export const schema = z.object({
  brandName: z.string().default('VIONA'),
  tagline: z.string().default('Create. Animate. Inspire.'),
  style: z.enum(['geometric', 'minimal', 'bold']).default('geometric'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  secondaryColor: z.string().default('#EC4899'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('modernTech'),
  colors: z.object({
    primary: z.string().default('#6366F1'),
    secondary: z.string().default('#A5B4FC'),
    accent: z.string().default('#EC4899'),
    background: z.string().default('#0B0F1A'),
    text: z.string().default('#FFFFFF'),
  }).default({}),
});

export type LogoStingerProps = z.infer<typeof schema>;
export const defaultProps: LogoStingerProps = schema.parse({});
