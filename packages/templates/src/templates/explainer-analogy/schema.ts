import { z } from 'zod';

export const schema = z.object({
  subject: z.string().default('A Firewall'),
  analogy: z.string().default('A Security Guard'),
  connector: z.string().default('is like'),
  explanation: z.string().optional().default(
    'It checks everything coming in and blocks anything suspicious',
  ),
});

export type ExplainerAnalogyProps = z.infer<typeof schema>;
export const defaultProps: ExplainerAnalogyProps = schema.parse({});
