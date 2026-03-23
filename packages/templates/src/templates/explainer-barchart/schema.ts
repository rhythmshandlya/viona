import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Programming Languages 2026'),
  bars: z
    .array(
      z.object({
        label: z.string(),
        value: z.number(),
        maxValue: z.number().optional(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Python', value: 28 },
      { label: 'JavaScript', value: 22 },
      { label: 'TypeScript', value: 18 },
      { label: 'Rust', value: 12 },
      { label: 'Go', value: 10 },
    ]),
});

export type ExplainerBarchartProps = z.infer<typeof schema>;
export const defaultProps: ExplainerBarchartProps = schema.parse({});
