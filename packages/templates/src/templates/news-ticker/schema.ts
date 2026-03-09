import { z } from 'zod';

export const schema = z.object({
  badge: z.string().default('BREAKING'),
  tickerText: z
    .string()
    .default(
      'Major tech companies report record AI adoption rates in 2026 \u2022 Global renewable energy capacity surpasses fossil fuels for the first time \u2022 New space telescope discovers potentially habitable exoplanet'
    ),
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
    .default('modernTech'),
  colors: z
    .object({
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#A0A0A0'),
      accent: z.string().default('#EF4444'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type NewsTickerProps = z.infer<typeof schema>;
export const defaultProps: NewsTickerProps = schema.parse({});
