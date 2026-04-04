import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('Microservices Architecture'),
  center: z.string().default('API Gateway'),
  nodes: z
    .array(z.string())
    .min(4)
    .max(8)
    .default([
      'Auth Service',
      'User Service',
      'Payment Service',
      'Notification',
      'Analytics',
      'Storage',
    ]),
});

export type ExplainerNetworkProps = z.infer<typeof schema>;
export const defaultProps: ExplainerNetworkProps = schema.parse({});
