import { randomUUID } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import { readMultipartData } from "../auth/auth.utils";
import type { User, UserDocument } from "./user.model";
import { updateUserCv } from "./users-cv.service";
import { toUser, toUserDocument } from "./user.utils";
import { createUserSchema, getUserSchema, updateUserSchema, uploadUserCvSchema } from "./users.schema";
import type { UsersHandlerType } from "./users.types";
import { serializeRouteError } from "./users.utils";

export const UsersHandler = (usersCollection: Collection<UserDocument>): UsersHandlerType => {
    return {
        getUserHandler: async (request: SchematicRequest<typeof getUserSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const user = await usersCollection.findOne({ _id: userId });

                if (!user) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "User not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(toUser(user));
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(serializeRouteError(error));
            }
        },

        createUserHandler: async (request: SchematicRequest<typeof createUserSchema>, reply: FastifyReply) => {
            try {
                const userData = request.body;

                const newUser: User = {
                    id: randomUUID(),
                    ...userData,
                    githubSkills: userData.githubSkills ?? [],
                    achievements: userData.achievements ?? [],
                };

                await usersCollection.insertOne(toUserDocument(newUser));
                reply.code(StatusCodes.CREATED).send(newUser);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(serializeRouteError(error));
            }
        },

        updateUserHandler: async (request: SchematicRequest<typeof updateUserSchema>, reply: FastifyReply) => {
            const { userId } = request.params;
            const updateData = request.body;

            try {
                await usersCollection.updateOne(
                    { _id: userId },
                    {
                        $set: updateData,
                    },
                    { upsert: true }
                );
                reply.code(StatusCodes.OK).send({ message: `User ${userId} updated`, status: "OK" });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(serializeRouteError(error));
            }
        },

        uploadUserCvHandler: async (
            request: SchematicRequest<typeof uploadUserCvSchema> & Pick<FastifyRequest, "isMultipart" | "parts">,
            reply: FastifyReply,
        ) => {
            const { userId } = request.params;

            try {
                if (!request.isMultipart()) {
                    reply.code(StatusCodes.BAD_REQUEST).send({ error: "CV upload must use multipart/form-data" });
                    return;
                }

                const parts = request.parts();
                const { fields, cvFile } = await readMultipartData(parts[Symbol.asyncIterator]());
                if (!cvFile) {
                    reply.code(StatusCodes.BAD_REQUEST).send({ error: "CV file is required" });
                    return;
                }

                const updatedUser = await updateUserCv(usersCollection, {
                    userId,
                    cvFile,
                    currentJob: fields.currentJob,
                    linkedInUrl: fields.linkedInUrl,
                    githubUrl: fields.githubUrl,
                });

                if (!updatedUser) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "User not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(updatedUser);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(serializeRouteError(error));
            }
        },
    };
};
