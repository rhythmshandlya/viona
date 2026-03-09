import { z } from 'zod';

const stepSchema = z.object({
  title: z.string(),
  description: z.string().default(''),
});

export const schema = z.object({
  title: z.string().default('HOW IT WORKS'),
  steps: z.array(stepSchema).default([
    { title: 'Sign Up', description: 'Create your free account in seconds' },
    { title: 'Upload', description: 'Add your content and assets' },
    { title: 'Customize', description: 'Choose templates and styles' },
    { title: 'Export', description: 'Download or share instantly' },
  ]),
  background: z.enum(['dark', 'light']).default('dark'),
  accentColor: z.string().default('#6366F1'),
  fontPair: z
    .enum(['modernTech', 'boldImpact', 'friendlyTech', 'strongReadable', 'elegantEditorial', 'cleanMinimal'])
    .default('cleanMinimal'),
  colors: z.object({
    primary: z.string().default('#6366F1'),
    secondary: z.string().default('#A5B4FC'),
    accent: z.string().default('#EC4899'),
    background: z.string().default('#0B0F1A'),
    text: z.string().default('#FFFFFF'),
  }).default({}),
});

export type ProcessFlowProps = z.infer<typeof schema>;
export const defaultProps: ProcessFlowProps = schema.parse({});
