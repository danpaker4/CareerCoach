import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UserSchema } from "./user.model";

export const getUserSchema = {
    response: {
        [StatusCodes.OK]: UserSchema,
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().min(1, "userId cannot be empty"),
    }),
} satisfies FastifySchema;

export const createUserSchema = {
    response: {
        [StatusCodes.CREATED]: UserSchema,
        [StatusCodes.BAD_REQUEST]: z.object({
            error: z.string(),
        }),
    },
    body: z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email(),
        password: z.string(),
        birthDate: z.coerce.date(),
        currentJob: z.string().optional(),
    }),
} satisfies FastifySchema;

export const updateUserSchema = {
    response: {
        [StatusCodes.OK]: z.object({
            message: z.string(),
            status: z.string(),
        }),
        [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
        }),
    },
    params: z.object({
        userId: z.string().min(1, "userId cannot be empty"),
    }),
    body: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().optional(),
        birthDate: z.coerce.date().optional(),
        currentJob: z.string().optional(),
    }),
} satisfies FastifySchema;

