import { z } from 'zod';

export const schema = z.object({
  value: z.number().default(1000000),
  prefix: z.string().default('$'),
  suffix: z.string().default(''),
  label: z.string().default('Revenue This Quarter'),
  decimals: z.number().default(0),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#10B981'),
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
      primary: z.string().default('#10B981'),
      secondary: z.string().default('#6EE7B7'),
      accent: z.string().default('#10B981'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type NumberTickerProps = z.infer<typeof schema>;
export const defaultProps: NumberTickerProps = schema.parse({});
