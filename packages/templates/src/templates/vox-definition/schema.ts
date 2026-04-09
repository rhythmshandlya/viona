import { z } from 'zod';

export const schema = z.object({
  term: z.string().default('Gerrymandering'),
  definition: z.string().default('The practice of drawing electoral district boundaries to favor a particular party'),
  pronunciation: z.string().optional(),
});

export type VoxDefinitionProps = z.infer<typeof schema>;
export const defaultProps: VoxDefinitionProps = schema.parse({});
