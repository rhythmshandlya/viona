import { z } from 'zod';

export const schema = z.object({
  root: z.string().default('Energy'),
  branches: z.array(z.object({
    label: z.string(),
    children: z.array(z.string()).optional(),
  })).min(2).max(4).default([
    { label: 'Renewable', children: ['Solar', 'Wind'] },
    { label: 'Fossil', children: ['Coal', 'Gas'] },
  ]),
  title: z.string().optional(),
});

export type VoxTreeProps = z.infer<typeof schema>;
export const defaultProps: VoxTreeProps = schema.parse({});
