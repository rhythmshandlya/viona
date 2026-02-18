import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('Scan to Visit'),
  url: z.string().default('example.com/demo'),
  seed: z.number().default(42),
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
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#EC4899'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type QrCodeRevealProps = z.infer<typeof schema>;

export const defaultProps: QrCodeRevealProps = schema.parse({});
