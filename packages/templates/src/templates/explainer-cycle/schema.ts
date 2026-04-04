import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Software Development Lifecycle'),
  stages: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
      }),
    )
    .min(3)
    .max(8)
    .default([
      { label: 'Plan', description: 'Requirements & design' },
      { label: 'Develop', description: 'Write & review code' },
      { label: 'Test', description: 'QA & validation' },
      { label: 'Deploy', description: 'Release to production' },
      { label: 'Monitor', description: 'Observe & measure' },
      { label: 'Improve', description: 'Iterate & optimize' },
    ]),
});

export type ExplainerCycleProps = z.infer<typeof schema>;
export const defaultProps: ExplainerCycleProps = schema.parse({});
