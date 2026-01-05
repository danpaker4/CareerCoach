import type { FastifySchema } from "fastify";
import { z } from "zod";

export const updateUserSchema = {
  response: {
    200: z.object({
      message: z.string(),
      status: z.string(),
    }),
    404: z.object({
      error: z.string(),
    }),
  },
  params: z.object({
    userId: z.string().min(1, "userId cannot be empty"),
  }),
} satisfies FastifySchema;

