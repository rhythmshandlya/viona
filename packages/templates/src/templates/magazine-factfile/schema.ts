import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Ukraine'),
  subtitle: z.string().default('Country Profile'),
  fields: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).min(3).max(8).default([
    { key: 'Capital', value: 'Kyiv' },
    { key: 'Population', value: '44.1 million' },
    { key: 'Language', value: 'Ukrainian' },
    { key: 'Currency', value: 'Hryvnia (UAH)' },
    { key: 'Government', value: 'Unitary semi-presidential republic' },
    { key: 'Leader', value: 'Volodymyr Zelenskyy' },
  ]),
});

export type MagazineFactfileProps = z.infer<typeof schema>;
export const defaultProps: MagazineFactfileProps = schema.parse({});
