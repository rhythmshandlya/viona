import { z } from 'zod';

export const schema = z.object({
  title: z.string().default('How WiFi Works'),
  items: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(5)
    .default([
      { label: 'Signal', description: 'Router broadcasts radio waves' },
      { label: 'Connect', description: 'Device authenticates with network' },
      { label: 'Transfer', description: 'Data packets travel wirelessly' },
    ]),
});

export type ExplainerHowitworksProps = z.infer<typeof schema>;
export const defaultProps: ExplainerHowitworksProps = schema.parse({});
