import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

const wantedJobResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  jobTitle: z.string(),
  keywords: z.array(z.string()),
  location: z.string().optional(),
  seniority: z.string().optional(),
  rawText: z.string(),
  status: z.enum(["pending", "matched", "dismissed"]),
  matchedJobIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createWantedJobBodySchema = z.object({
  userId: z.string().min(1),
  jobTitle: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(100)).max(30).default([]),
  location: z.string().max(120).optional(),
  seniority: z.string().max(50).optional(),
  rawText: z.string().max(2000).optional(),
});

export type CreateWantedJobBody = z.infer<typeof createWantedJobBodySchema>;

export const createWantedJobSchema = {
  body: createWantedJobBodySchema,
  response: {
    [StatusCodes.CREATED]: wantedJobResponseSchema,
  },
} satisfies FastifySchema;

export const getWantedJobsParamsSchema = z.object({
  userId: z.string().min(1),
});

export const getWantedJobsSchema = {
  params: getWantedJobsParamsSchema,
  response: {
    [StatusCodes.OK]: z.array(wantedJobResponseSchema),
  },
} satisfies FastifySchema;

export const deleteWantedJobParamsSchema = z.object({
  id: z.string().min(1),
});

export const deleteWantedJobSchema = {
  params: deleteWantedJobParamsSchema,
  response: {
    [StatusCodes.NO_CONTENT]: z.null(),
  },
} satisfies FastifySchema;
