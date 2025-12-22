import { z } from 'zod';
import { items, insertItemSchema, drawOptionsSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  items: {
    draw: {
      method: 'POST' as const,
      path: '/api/items/draw',
      input: drawOptionsSchema,
      responses: {
        200: z.array(z.custom<typeof items.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
    list: {
        method: 'GET' as const,
        path: '/api/items',
        responses: {
            200: z.array(z.custom<typeof items.$inferSelect>()),
        }
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type DrawOptions = z.infer<typeof api.items.draw.input>;
export type ItemResponse = z.infer<typeof api.items.draw.responses[200]>[number];
