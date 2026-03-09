import { z } from 'zod';

export const schema = z.object({
  text: z.string().default('Link in Description'),
  url: z.string().default('example.com/resources'),
  showArrow: z.boolean().default(true),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#3B82F6'),
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
      primary: z.string().default('#3B82F6'),
      secondary: z.string().default('#1E3A5F'),
      accent: z.string().default('#60A5FA'),
      background: z.string().default('#0A0A1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type LinkCalloutProps = z.infer<typeof schema>;

export const defaultProps: LinkCalloutProps = schema.parse({});
