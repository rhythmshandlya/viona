import { z } from 'zod';

export const schema = z.object({
  actors: z.array(z.object({
    name: z.string(),
    role: z.string(),
  })).min(2).max(5).default([
    { name: 'Government', role: 'Regulates' },
    { name: 'Industry', role: 'Produces' },
    { name: 'Citizens', role: 'Consume' },
  ]),
  connections: z.array(z.object({
    from: z.number(),
    to: z.number(),
    label: z.string().optional(),
  })).min(1).max(6).default([
    { from: 0, to: 1, label: 'Policy' },
    { from: 1, to: 2, label: 'Products' },
    { from: 2, to: 0, label: 'Votes' },
  ]),
});

export type VoxSystemdiagramProps = z.infer<typeof schema>;
export const defaultProps: VoxSystemdiagramProps = schema.parse({});
