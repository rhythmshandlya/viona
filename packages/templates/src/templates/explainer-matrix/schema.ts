import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Priority Matrix'),
  xAxisLabel: z.string().default('Effort'),
  yAxisLabel: z.string().default('Impact'),
  xAxisLow: z.string().default('Low'),
  xAxisHigh: z.string().default('High'),
  yAxisLow: z.string().default('Low'),
  yAxisHigh: z.string().default('High'),
  quadrants: z
    .array(
      z.object({
        label: z.string(),
        items: z.array(z.string()).min(1).max(5),
      }),
    )
    .length(4)
    .default([
      { label: 'Quick Wins', items: ['Fix typos', 'Update docs', 'Add tests'] },
      { label: 'Major Projects', items: ['Rewrite auth', 'New dashboard'] },
      { label: 'Fill-Ins', items: ['Rename vars', 'Update deps'] },
      { label: 'Thankless Tasks', items: ['Legacy migration', 'Compliance'] },
    ]),
  cursorX: z.number().min(0).max(1).default(0.3),
  cursorY: z.number().min(0).max(1).default(0.75),
});

export type ExplainerMatrixProps = z.infer<typeof schema>;
export const defaultProps: ExplainerMatrixProps = schema.parse({});
