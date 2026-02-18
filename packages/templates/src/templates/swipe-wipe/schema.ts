import { z } from 'zod';

export const schema = z.object({
  text: z.string().optional().default('Part Two'),
  style: z
    .enum(['circleExpand', 'diagonalWipe', 'horizontalWipe'])
    .default('circleExpand'),
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
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#A0A0A0'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0A0A0A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type SwipeWipeProps = z.infer<typeof schema>;

export const defaultProps: SwipeWipeProps = schema.parse({});
