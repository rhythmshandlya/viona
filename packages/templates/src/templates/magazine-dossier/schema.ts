import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('OPERATION: TRADE CORRIDOR'),
  items: z.array(z.string()).default([
    'Bilateral agreement signed 2024',
    'Annual trade volume: $47 billion',
    'Three disputed territories remain',
  ]),
  classification: z.enum(['CONFIDENTIAL', 'TOP SECRET', 'DECLASSIFIED']).default('CONFIDENTIAL'),
});

export type MagazineDossierProps = z.infer<typeof schema>;
export const defaultProps: MagazineDossierProps = schema.parse({});
