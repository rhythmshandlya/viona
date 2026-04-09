import { z } from 'zod';

export const schema = z.object({
  steps: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })).min(2).max(6).default([
    { label: 'Research', description: 'Gather data' },
    { label: 'Analyze', description: 'Find patterns' },
    { label: 'Publish', description: 'Share results' },
    { label: 'Review', description: 'Peer feedback' },
  ]),
  title: z.string().optional().default('The Scientific Method'),
  direction: z.enum(['vertical', 'horizontal']).default('vertical'),
});

export type VoxProcessProps = z.infer<typeof schema>;
export const defaultProps: VoxProcessProps = schema.parse({});
