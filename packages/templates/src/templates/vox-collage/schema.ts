import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })).min(2).max(4).default([
    { label: 'Solar Panels', description: 'Photovoltaic' },
    { label: 'Wind Turbines', description: 'Onshore' },
    { label: 'Hydroelectric', description: 'Dam-based' },
  ]),
  title: z.string().optional(),
});

export type VoxCollageProps = z.infer<typeof schema>;
export const defaultProps: VoxCollageProps = schema.parse({});
