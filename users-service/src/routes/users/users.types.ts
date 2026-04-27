import type { FastifyReply } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { createUserSchema, getUserSchema, updateUserSchema } from "./users.schema";

export type UsersHandlerType = {
    getUserHandler: (request: SchematicRequest<typeof getUserSchema>, reply: FastifyReply) => Promise<void>;
    createUserHandler: (request: SchematicRequest<typeof createUserSchema>, reply: FastifyReply) => Promise<void>;
    updateUserHandler: (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => Promise<void>;
};
