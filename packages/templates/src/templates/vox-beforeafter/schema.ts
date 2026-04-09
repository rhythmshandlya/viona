import { z } from 'zod';

const halfSchema = z.object({
  label: z.string(),
  description: z.string(),
  year: z.string().optional(),
});

export const schema = z.object({
  before: halfSchema.default({ label: 'Before', description: '12% renewable energy', year: '2010' }),
  after: halfSchema.default({ label: 'After', description: '47% renewable energy', year: '2024' }),
  title: z.string().optional(),
});

export type VoxBeforeAfterProps = z.infer<typeof schema>;
export const defaultProps: VoxBeforeAfterProps = schema.parse({});
