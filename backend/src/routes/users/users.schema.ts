import type { FastifySchema } from "fastify";
import { z } from "zod";

export const updateUserSchema = {
  response: {
    404: "NOT FOUND",
    200: "OK",
  },
  params: z.object({
    userId: z.string(),
  })
} satisfies FastifySchema;

