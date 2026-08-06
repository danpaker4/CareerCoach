import type { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import { CareerProfileDal } from "../career-profile/dal/career-profile.dal";
import { createValidateInternalServiceKey } from "./internal-auth.middleware";

export const internalRouter = (dbClient: MongoClient, chatConfig: ServerConfig["chatConfig"]) =>
    async (app: FastifyInstance) => {
        const dal = new CareerProfileDal(dbClient.careerProfiles);
        const validateInternal = createValidateInternalServiceKey(chatConfig.internalServiceApiKey ?? "");

        app.get(
            "/internal/users/:userId/career-profile",
            { preHandler: [validateInternal] },
            async (request, reply) => {
                const userId = (request.params as { userId?: string }).userId;
                if (!userId || userId.trim().length === 0) {
                    reply.status(StatusCodes.BAD_REQUEST).send({ error: "userId is required" });
                    return;
                }

                const profile = await dal.findByUserId(userId);
                if (!profile) {
                    reply.status(StatusCodes.NOT_FOUND).send({ error: "Career profile not found" });
                    return;
                }

                reply.status(StatusCodes.OK).send(profile);
            }
        );
    };
