import { z } from 'zod';

export const schema = z.object({
  leftName: z.string().default('React'),
  rightName: z.string().default('Vue'),
  leftAttributes: z
    .array(z.string())
    .default(['Component-based', 'Huge ecosystem', 'Meta-backed', 'JSX syntax']),
  rightAttributes: z
    .array(z.string())
    .default(['Easy learning curve', 'Built-in state', 'Template syntax', 'Lightweight']),
  leftColor: z.string().default('#61DAFB'),
  rightColor: z.string().default('#42B883'),
  background: z.enum(['dark', 'light']).default('dark'),
  fontPair: z
    .enum([
      'modernTech',
      'boldImpact',
      'friendlyTech',
      'strongReadable',
      'elegantEditorial',
      'cleanMinimal',
    ])
    .default('boldImpact'),
  colors: z
    .object({
      primary: z.string().default('#FFFFFF'),
      secondary: z.string().default('#AAAAAA'),
      accent: z.string().default('#FFD700'),
      background: z.string().default('#0B0F1A'),
      text: z.string().default('#FFFFFF'),
    })
    .default({}),
});

export type VersusScreenProps = z.infer<typeof schema>;

export const defaultProps: VersusScreenProps = schema.parse({});
