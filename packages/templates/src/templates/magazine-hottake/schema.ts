import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('HOT TAKE'),
  statement: z.string().default('Remote work didn\'t kill company culture — bad management did.'),
  author: z.string().optional().default('Editorial Board'),
});

export type MagazineHottakeProps = z.infer<typeof schema>;
export const defaultProps: MagazineHottakeProps = schema.parse({});
