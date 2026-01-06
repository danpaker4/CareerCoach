import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { User } from "./user.model";
import { createUserSchema, getUserSchema, updateUserSchema } from "./users.schema";
import { UsersHandler } from "./users.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const usersRouter = (usersCollection: Collection<User>): registerRouter => (fastify: TypedFastify): void => {
    const handler = UsersHandler(usersCollection);

    fastify.get("/users/:userId", { schema: getUserSchema }, handler.getUserHandler);
    fastify.post("/users", { schema: createUserSchema }, handler.createUserHandler);
    fastify.patch("/users/:userId", { schema: updateUserSchema }, handler.updateUserHandler);
};
