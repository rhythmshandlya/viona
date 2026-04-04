import { z } from 'zod';

export const schema = z.object({
  label: z.string().default('Estimated Cost'),
  price: z.string().default('$4.2 Trillion'),
  breakdown: z.array(z.string()).min(1).max(5).default([
    'Infrastructure & green energy: $1.8T',
    'Adaptation funding: $1.1T',
    'Loss and damage: $900B',
    'Technology transfer: $400B',
  ]),
});

export type MagazinePricetagProps = z.infer<typeof schema>;
export const defaultProps: MagazinePricetagProps = schema.parse({});
