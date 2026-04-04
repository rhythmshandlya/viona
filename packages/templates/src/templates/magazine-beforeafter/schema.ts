import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Diplomatic Relations'),
  before: z.string().default('Frozen negotiations, escalating hostilities, no humanitarian access'),
  after: z.string().default('Active dialogue, 30-day ceasefire, humanitarian corridors established'),
  beforeLabel: z.string().default('Before'),
  afterLabel: z.string().default('After'),
});

export type MagazineBeforeafterProps = z.infer<typeof schema>;
export const defaultProps: MagazineBeforeafterProps = schema.parse({});
