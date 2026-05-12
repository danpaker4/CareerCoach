import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

export const getJobsSchema = {
  response: {
    [StatusCodes.OK]: z.array(z.object({
      id: z.string(),
      jobTitle: z.string(),
      company: z.string(),
      seniority: z.string(),
      description: z.string(),
      url: z.string(),
      salary: z.number().optional(),
      requirements: z.array(z.string()).optional(),
      benefits: z.array(z.string()).optional(),
      matchPct: z.number().optional(),
    })),
  },
  querystring: z.object({
    search: z.string().optional(),
    userId: z.string().uuid().optional(),
    skills: z.string().optional(),
  }),
} satisfies FastifySchema;
