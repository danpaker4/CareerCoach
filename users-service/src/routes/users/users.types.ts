import type { FastifyReply, FastifyRequest } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { createUserSchema, getUserSchema, updateDreamJobSchema, updateUserSchema, uploadUserCvSchema } from "./users.schema";

type MultipartSchematicRequest = SchematicRequest<typeof uploadUserCvSchema> & Pick<FastifyRequest, "isMultipart" | "parts">;

export type UsersHandlerType = {
    getUserHandler: (request: SchematicRequest<typeof getUserSchema>, reply: FastifyReply) => Promise<void>;
    createUserHandler: (request: SchematicRequest<typeof createUserSchema>, reply: FastifyReply) => Promise<void>;
    updateUserHandler: (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => Promise<void>;
    updateDreamJobHandler: (
        request: SchematicRequest<typeof updateDreamJobSchema> & Pick<FastifyRequest, "authUser">,
        reply: FastifyReply,
    ) => Promise<void>;
    uploadUserCvHandler: (request: MultipartSchematicRequest, reply: FastifyReply) => Promise<void>;
};
