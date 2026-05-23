import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { UserDocument } from "./user.model";
import { createUserSchema, getUserSchema, updateDreamJobSchema, updateUserSchema, uploadUserCvSchema } from "./users.schema";
import { UsersHandler } from "./users.handler";
import { authenticateRequest } from "../auth/auth.middleware";

type registerRouter = (fastify: TypedFastify) => void;

export const usersRouter = (usersCollection: Collection<UserDocument>): registerRouter => (fastify: TypedFastify): void => {
    const handler = UsersHandler(usersCollection);

    fastify.get("/users/:userId", { schema: getUserSchema, preHandler: authenticateRequest }, handler.getUserHandler);
    fastify.post("/users", { schema: createUserSchema, preHandler: authenticateRequest }, handler.createUserHandler);
    fastify.patch("/users/:userId", { schema: updateUserSchema, preHandler: authenticateRequest }, handler.updateUserHandler);
    fastify.patch("/users/:userId/dream-job", { schema: updateDreamJobSchema, preHandler: authenticateRequest }, handler.updateDreamJobHandler);
    fastify.post("/users/:userId/cv", { schema: uploadUserCvSchema, preHandler: authenticateRequest }, handler.uploadUserCvHandler);
};
