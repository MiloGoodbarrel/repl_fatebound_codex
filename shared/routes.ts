import { z } from 'zod';
import { items5e, drawOptionsSchema } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  items: {
    draw: {
      method: 'POST' as const,
      path: '/api/items/draw',
      input: drawOptionsSchema,
      responses: {
        200: z.array(z.custom<typeof items5e.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
  },
};

export type DrawOptions = z.infer<typeof api.items.draw.input>;
export type ItemResponse = z.infer<typeof api.items.draw.responses[200]>[number];
