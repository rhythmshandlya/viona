import { z } from 'zod';

export const schema = z.object({
  source: z.string().default('PBS NEWS'),
  date: z.string().default('January 21, 2025'),
  headline: z.string().default("22 STATES SUE TO STOP TRUMP'S BLOCK ON BIRTHRIGHT CITIZENSHIP"),
  highlightLine: z.string().default('22 STATES SUE TO STOP'),
  excerpt: z.string().optional().default(
    "Attorneys general from 22 states sued Tuesday to block President Donald Trump's move to end a century-old immigration practice known as birthright citizenship guaranteeing that U.S.-born children are citizens regardless of their parents' status."
  ),
});

export type VoxNewscardProps = z.infer<typeof schema>;
export const defaultProps: VoxNewscardProps = schema.parse({});
