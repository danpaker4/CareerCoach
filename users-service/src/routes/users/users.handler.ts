import { FastifyReply } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import type { User } from "./user.model";
import { createUserSchema, getUserSchema, updateUserSchema } from "./users.schema";
import { v4 as uuidv4 } from "uuid";

type UsersHandlerType = {
    getUserHandler: (request: SchematicRequest<typeof getUserSchema>, reply: FastifyReply) => Promise<void>;
    createUserHandler: (request: SchematicRequest<typeof createUserSchema>, reply: FastifyReply) => Promise<void>;
    updateUserHandler: (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => Promise<void>;
};

export const UsersHandler = (usersCollection: Collection<User>): UsersHandlerType => {
    return {
        getUserHandler: async (request: SchematicRequest<typeof getUserSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const user = await usersCollection.findOne({ id: userId });

                if (!user) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "User not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(user);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        createUserHandler: async (request: SchematicRequest<typeof createUserSchema>, reply: FastifyReply) => {
            try {
                const userData = request.body;

                const newUser: User = {
                    id: uuidv4(),
                    ...userData,
                };

                await usersCollection.insertOne(newUser);
                reply.code(StatusCodes.CREATED).send(newUser);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        updateUserHandler: async (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => {
            const { userId } = request.params;
            const updateData = request.body;

            try {
                await usersCollection.updateOne(
                    { id: userId },
                    {
                        $set: updateData,
                    },
                    { upsert: true }
                );
                reply.code(StatusCodes.OK).send({ message: `User ${userId} updated`, status: "OK" });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },
    };
};
