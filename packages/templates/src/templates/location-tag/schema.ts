import { z } from 'zod';

export const schema = z.object({
  location: z.string().default('San Francisco, CA'),
  venue: z.string().default('Moscone Center'),
  coordinates: z.string().optional().default('37.7749\u00b0 N, 122.4194\u00b0 W'),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#EF4444'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#EF4444'),
      secondary: z.string().default('#F87171'),
      accent: z.string().default('#EF4444'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type LocationTagProps = z.infer<typeof schema>;

export const defaultProps: LocationTagProps = schema.parse({});
