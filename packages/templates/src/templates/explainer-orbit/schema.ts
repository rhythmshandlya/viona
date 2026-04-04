import { z } from 'zod';

export const schema = z.object({
  showBackground: z.boolean().default(false),
  title: z.string().default('JavaScript Ecosystem'),
  center: z.string().default('JavaScript'),
  rings: z
    .array(
      z.object({
        items: z.array(z.string()).min(1).max(6),
      }),
    )
    .min(2)
    .max(3)
    .default([
      { items: ['TypeScript', 'Node.js'] },
      { items: ['React', 'Vue', 'Angular'] },
      { items: ['Next.js', 'Nuxt', 'Remix', 'Astro'] },
    ]),
});

export type ExplainerOrbitProps = z.infer<typeof schema>;
export const defaultProps: ExplainerOrbitProps = schema.parse({});
