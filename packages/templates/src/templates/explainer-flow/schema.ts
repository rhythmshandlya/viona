import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Data Pipeline'),
  steps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Ingest', description: 'Raw data collected from sources' },
      { label: 'Transform', description: 'Clean, normalize, and enrich' },
      { label: 'Validate', description: 'Check schema and constraints' },
      { label: 'Store', description: 'Write to data warehouse' },
      { label: 'Serve', description: 'API layer for consumers' },
    ]),
});

export type ExplainerFlowProps = z.infer<typeof schema>;
export const defaultProps: ExplainerFlowProps = schema.parse({});
