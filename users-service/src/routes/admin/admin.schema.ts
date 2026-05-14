import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UserRoleSchema } from "../users/user.model";

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
