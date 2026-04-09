import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('Saturn V Launch Vehicle'),
  dimensions: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).min(1).max(5).default([
    { label: 'Total Height', value: '110.6 m' },
    { label: 'Diameter', value: '10.1 m' },
    { label: 'Mass at Launch', value: '2,970 t' },
    { label: 'Payload to LEO', value: '140 t' },
    { label: 'Thrust', value: '35,100 kN' },
  ]),
  detail: z.string().optional().default('Most powerful rocket ever flown — carried Apollo astronauts to the Moon'),
});

export type VoxBlueprintProps = z.infer<typeof schema>;
export const defaultProps: VoxBlueprintProps = schema.parse({});
