import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import type {
    CareerDirectionExample,
    CareerPathProfile,
    CareerRoleProfile,
    CareerSkillProfile,
} from "./career-knowledge.types";
import { CareerKnowledgeService } from "./career-knowledge.service";
import { CareerKnowledgeHandler } from "./career-knowledge.handler";
import {
    careerKnowledgeMarketRequirementsSchema,
    careerKnowledgePathsSchema,
    careerKnowledgeRefreshSchema,
    careerKnowledgeRoleSchema,
} from "./career-knowledge.schema";

type RegisterRouter = (fastify: TypedFastify) => void;

export const careerKnowledgeRouter = (
    jobsCollection: Collection<EnrichedJob>,
    roleProfilesCollection: Collection<CareerRoleProfile>,
    skillProfilesCollection: Collection<CareerSkillProfile>,
    pathProfilesCollection: Collection<CareerPathProfile>,
    directionExamplesCollection: Collection<CareerDirectionExample>
): RegisterRouter => (fastify: TypedFastify): void => {
    const service = new CareerKnowledgeService(
        jobsCollection,
        roleProfilesCollection,
        skillProfilesCollection,
        pathProfilesCollection,
        directionExamplesCollection
    );
    const handler = CareerKnowledgeHandler(service);

    fastify.post("/career-knowledge/refresh", { schema: careerKnowledgeRefreshSchema }, handler.refreshKnowledgeHandler);
    fastify.get("/career-knowledge/roles/:roleCategory", { schema: careerKnowledgeRoleSchema }, handler.getRoleProfileHandler);
    fastify.get("/career-knowledge/market-requirements", { schema: careerKnowledgeMarketRequirementsSchema }, handler.getMarketRequirementsHandler);
    fastify.get("/career-knowledge/paths", { schema: careerKnowledgePathsSchema }, handler.getPathsHandler);
};

export type { CareerKnowledgeService };
