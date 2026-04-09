import { z } from 'zod';

export const schema = z.object({
  items: z.array(z.string()).min(2).max(5).default([
    'Birthright citizenship',
    'Trump v. Barbara',
    'What happens next',
  ]),
  activeIndex: z.number().default(0),
});

export type VoxAgendaProps = z.infer<typeof schema>;
export const defaultProps: VoxAgendaProps = schema.parse({});
