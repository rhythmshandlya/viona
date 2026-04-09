import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('5 Things That Changed'),
  items: z.array(z.string()).min(3).max(5).default([
    'The ceasefire agreement',
    'Economic sanctions lifted',
    'Refugee corridor opened',
    'Joint peacekeeping force',
    'Historic UN resolution',
  ]),
});

export type MagazineCountdownProps = z.infer<typeof schema>;
export const defaultProps: MagazineCountdownProps = schema.parse({});
