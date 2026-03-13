import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('ARCHITECTURE'),
  nodes: z
    .array(
      z.object({
        label: z.string(),
        x: z.number(),
        y: z.number(),
      }),
    )
    .default([
      { label: 'Input', x: 0.2, y: 0.3 },
      { label: 'Process', x: 0.5, y: 0.3 },
      { label: 'Output', x: 0.8, y: 0.3 },
    ]),
  edges: z
    .array(
      z.object({
        from: z.number(),
        to: z.number(),
      }),
    )
    .default([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]),
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
    .default('cleanMinimal'),
  colors: z
    .object({
      primary: z.string().default('#6366F1'),
      secondary: z.string().default('#A5B4FC'),
      accent: z.string().default('#6366F1'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type AnimatedDiagramProps = z.infer<typeof schema>;
export const defaultProps: AnimatedDiagramProps = schema.parse({});
