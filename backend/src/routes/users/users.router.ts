import type { TypedFastify } from "../../types/fastify";
import { updateUserSchema } from "./users.schema";
import { UsersHandler } from "./users.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const usersRouter = (): registerRouter => (fastify: TypedFastify): void => {
    const handler = UsersHandler();

    fastify.patch("/users/:userId", { schema: updateUserSchema }, handler.updateUserHandler);
};
