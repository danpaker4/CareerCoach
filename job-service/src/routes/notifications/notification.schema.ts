import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

const notificationTypeSchema = z.enum(["wanted_job_match", "pipeline_reminder", "system"]);

const notificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  read: z.boolean(),
  createdAt: z.string(),
  dueDate: z.string().optional(),
});

export const createNotificationBodySchema = z.object({
  userId: z.string().min(1),
  type: notificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  actionUrl: z.string().max(2048).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  dueDate: z.string().datetime().optional(),
});

export type CreateNotificationBody = z.infer<typeof createNotificationBodySchema>;

export const createNotificationSchema = {
  body: createNotificationBodySchema,
  response: {
    [StatusCodes.CREATED]: notificationResponseSchema,
  },
} satisfies FastifySchema;

export const getNotificationsSchema = {
  params: z.object({ userId: z.string().min(1) }),
  querystring: z.object({
    unreadOnly: z.union([z.literal("true"), z.literal("false")]).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
  response: {
    [StatusCodes.OK]: z.array(notificationResponseSchema),
  },
} satisfies FastifySchema;

export const getUnreadCountSchema = {
  params: z.object({ userId: z.string().min(1) }),
  response: {
    [StatusCodes.OK]: z.object({ unread: z.number().int().nonnegative() }),
  },
} satisfies FastifySchema;

export const markReadSchema = {
  params: z.object({ id: z.string().min(1) }),
  response: {
    [StatusCodes.OK]: notificationResponseSchema,
    [StatusCodes.NOT_FOUND]: z.object({ message: z.string() }),
  },
} satisfies FastifySchema;

export const markAllReadSchema = {
  params: z.object({ userId: z.string().min(1) }),
  response: {
    [StatusCodes.OK]: z.object({ modified: z.number().int().nonnegative() }),
  },
} satisfies FastifySchema;

export const deleteNotificationSchema = {
  params: z.object({ id: z.string().min(1) }),
  response: {
    [StatusCodes.NO_CONTENT]: z.null(),
    [StatusCodes.NOT_FOUND]: z.object({ message: z.string() }),
  },
} satisfies FastifySchema;

export const checkPipelineRemindersSchema = {
  params: z.object({ userId: z.string().min(1) }),
  response: {
    [StatusCodes.OK]: z.object({ created: z.number().int().nonnegative() }),
  },
} satisfies FastifySchema;
