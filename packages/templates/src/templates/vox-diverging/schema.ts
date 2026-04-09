import { z } from 'zod';

export const schema = z.object({
  lineA: z.object({
    label: z.string(),
  }).default({ label: 'Developed Nations' }),
  lineB: z.object({
    label: z.string(),
  }).default({ label: 'Developing Nations' }),
  divergePoint: z.string().optional().default('2005'),
  title: z.string().optional().default('The Great Divergence'),
});

export type VoxDivergingProps = z.infer<typeof schema>;
export const defaultProps: VoxDivergingProps = schema.parse({});
