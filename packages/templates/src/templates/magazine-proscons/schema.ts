import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('The Agreement'),
  pros: z.array(z.string()).min(1).max(4).default([
    'Immediate ceasefire',
    'Humanitarian access',
    'Prisoner exchange',
  ]),
  cons: z.array(z.string()).min(1).max(4).default([
    'No territorial resolution',
    'Enforcement unclear',
    'Timeline disputed',
  ]),
});

export type MagazineProsconsProps = z.infer<typeof schema>;
export const defaultProps: MagazineProsconsProps = schema.parse({});
