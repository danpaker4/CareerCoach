import type { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import type { CareerKnowledgeService } from "./career-knowledge.service";
import {
    careerKnowledgePathsSchema,
    careerKnowledgeRefreshSchema,
    careerKnowledgeRoleSchema,
    careerKnowledgeMarketRequirementsSchema,
} from "./career-knowledge.schema";

type CareerKnowledgeHandlerType = {
    refreshKnowledgeHandler: (request: SchematicRequest<typeof careerKnowledgeRefreshSchema>, reply: FastifyReply) => Promise<void>;
    getRoleProfileHandler: (request: SchematicRequest<typeof careerKnowledgeRoleSchema>, reply: FastifyReply) => Promise<void>;
    getMarketRequirementsHandler: (request: SchematicRequest<typeof careerKnowledgeMarketRequirementsSchema>, reply: FastifyReply) => Promise<void>;
    getPathsHandler: (request: SchematicRequest<typeof careerKnowledgePathsSchema>, reply: FastifyReply) => Promise<void>;
};

export const CareerKnowledgeHandler = (service: CareerKnowledgeService): CareerKnowledgeHandlerType => ({
    refreshKnowledgeHandler: async (_request, reply) => {
        try {
            const result = await service.refreshKnowledge();
            reply.code(StatusCodes.OK).send({ status: "OK", ...result });
        } catch (error) {
            reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                error: "Failed to refresh career knowledge",
                details: error instanceof Error ? error.message : String(error),
            });
        }
    },

    getRoleProfileHandler: async (request, reply) => {
        const { roleCategory } = request.params;
        const profile = await service.getRoleProfile(roleCategory);
        if (!profile) {
            reply.code(StatusCodes.NOT_FOUND).send({ error: "Role profile not found" });
            return;
        }
        reply.code(StatusCodes.OK).send(profile);
    },

    getMarketRequirementsHandler: async (request, reply) => {
        const { roleCategory } = request.query;
        const requirements = await service.getMarketRequirements(roleCategory);
        if (!requirements) {
            reply.code(StatusCodes.NOT_FOUND).send({ error: "Market requirements not found" });
            return;
        }
        reply.code(StatusCodes.OK).send(requirements);
    },

    getPathsHandler: async (request, reply) => {
        const { fromRole, toRole } = request.query;
        const paths = await service.getPathsBetweenRoles(fromRole, toRole);
        reply.code(StatusCodes.OK).send(paths);
    },
});
