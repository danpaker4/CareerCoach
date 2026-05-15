import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UserRoleSchema } from "../users/user.model";
import { ADMIN_TOKEN_USAGE_DEFAULT_DAYS, ADMIN_TOKEN_USAGE_MAX_DAYS } from "./admin.consts";
import { LlmProviderSchema } from "./admin-token-usage.model";

export const AdminUserSummarySchema = z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
    role: UserRoleSchema,
});

const errorResponseSchema = z.object({
    error: z.string(),
    errorCode: z.string().optional(),
});

export const getAdminUsersSchema = {
    querystring: z.object({
        query: z.string().optional(),
    }),
    response: {
        [StatusCodes.OK]: z.array(AdminUserSummarySchema),
        [StatusCodes.UNAUTHORIZED]: errorResponseSchema,
        [StatusCodes.FORBIDDEN]: errorResponseSchema,
    },
} satisfies FastifySchema;

export const promoteAdminSchema = {
    body: z.object({
        email: z.email(),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            user: AdminUserSummarySchema,
        }),
        [StatusCodes.NOT_FOUND]: errorResponseSchema,
        [StatusCodes.UNAUTHORIZED]: errorResponseSchema,
        [StatusCodes.FORBIDDEN]: errorResponseSchema,
    },
} satisfies FastifySchema;

export const demoteAdminSchema = {
    params: z.object({
        userId: z.uuid(),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            user: AdminUserSummarySchema,
        }),
        [StatusCodes.NOT_FOUND]: errorResponseSchema,
        [StatusCodes.UNAUTHORIZED]: errorResponseSchema,
        [StatusCodes.FORBIDDEN]: errorResponseSchema,
    },
} satisfies FastifySchema;

export const deleteAdminUserSchema = {
    params: z.object({
        userId: z.uuid(),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            deletedUserId: z.uuid(),
        }),
        [StatusCodes.NOT_FOUND]: errorResponseSchema,
        [StatusCodes.UNAUTHORIZED]: errorResponseSchema,
        [StatusCodes.FORBIDDEN]: errorResponseSchema,
    },
} satisfies FastifySchema;

const AdminLlmTokenUsageSeriesItemSchema = z.object({
    date: z.string(),
    provider: LlmProviderSchema,
    model: z.string(),
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
    requestCount: z.number(),
    unknownRequestCount: z.number(),
});

export const getAdminLlmTokenUsageSchema = {
    querystring: z.object({
        days: z.coerce.number().int().min(1).max(ADMIN_TOKEN_USAGE_MAX_DAYS).default(ADMIN_TOKEN_USAGE_DEFAULT_DAYS),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            range: z.object({
                from: z.string(),
                to: z.string(),
                days: z.number(),
            }),
            series: z.array(AdminLlmTokenUsageSeriesItemSchema),
        }),
        [StatusCodes.UNAUTHORIZED]: errorResponseSchema,
        [StatusCodes.FORBIDDEN]: errorResponseSchema,
    },
} satisfies FastifySchema;
