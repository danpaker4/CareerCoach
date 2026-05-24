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
    })),
  },
  querystring: z.object({
    search: z.string().optional(),
  }),
} satisfies FastifySchema;

export const createJobBodySchema = z.object({
  jobTitle: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  url: z.union([z.string().url().max(2048), z.literal("")]).optional(),
  description: z.string().min(1).max(20000),
  seniority: z.string().min(1).max(50),
  salary: z.number().int().nonnegative().optional(),
});

export type CreateJobBody = z.infer<typeof createJobBodySchema>;

export const createJobSchema = {
  body: createJobBodySchema,
  response: {
    [StatusCodes.CREATED]: z.object({
      id: z.string(),
      jobTitle: z.string(),
      company: z.string(),
      seniority: z.string(),
      description: z.string(),
      url: z.string(),
      salary: z.number().optional(),
      requirements: z.array(z.string()).optional(),
      benefits: z.array(z.string()).optional(),
    }),
  },
} satisfies FastifySchema;
