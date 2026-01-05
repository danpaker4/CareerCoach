import { FastifyReply } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import { updateUserSchema } from "./users.schema";

type UsersHandlerType = {
  updateUserHandler: (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => Promise<void>;
};

export const UsersHandler = (): UsersHandlerType => {
  return {
    updateUserHandler: async (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => {
      const { userId } = request.params;
      reply.code(200).send({ message: `User ${userId} updated`, status: "OK" });
    },
  };
};
