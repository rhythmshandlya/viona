import { z } from 'zod';

export const schema = z.object({
  then: z.object({
    label: z.string(),
    year: z.string(),
    detail: z.string(),
  }).default({ label: 'Then', year: '2010', detail: 'Coal powered 45% of electricity' }),
  now: z.object({
    label: z.string(),
    year: z.string(),
    detail: z.string(),
  }).default({ label: 'Now', year: '2024', detail: 'Coal dropped to 16% of electricity' }),
});

export type VoxThennowProps = z.infer<typeof schema>;
export const defaultProps: VoxThennowProps = schema.parse({});
