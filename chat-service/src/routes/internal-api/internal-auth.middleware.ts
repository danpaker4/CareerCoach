import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";

export const createValidateInternalServiceKey = (internalServiceApiKey: string) =>
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const header = request.headers["x-internal-service-key"];
        const providedKey = typeof header === "string" ? header : "";
        if (providedKey.length === 0 || providedKey !== internalServiceApiKey) {
            reply.status(StatusCodes.UNAUTHORIZED).send({ error: "Invalid internal service key" });
            return;
        }
    };
