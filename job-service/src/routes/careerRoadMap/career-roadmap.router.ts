import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { CareerRoadMap } from "./career-roadmap.model";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import { createCareerRoadMapSchema, deleteDreamJobSchema, editStagesSchema, getCareerRoadMapByUserIdSchema, discoverOpportunitiesSchema } from "./career-roadmap.schema";
import { CareerRoadMapHandler } from "./career-roadmap.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const careerRoadMapRouter = (
    careerRoadMapsCollection: Collection<CareerRoadMap>,
    jobsCollection: Collection<EnrichedJob>
): registerRouter => (fastify: TypedFastify): void => {
    const handler = CareerRoadMapHandler(careerRoadMapsCollection, jobsCollection);

    fastify.get("/career-roadmap/:userId", { schema: getCareerRoadMapByUserIdSchema }, handler.getCareerRoadMapByUserIdHandler);
    fastify.post("/career-roadmap", { schema: createCareerRoadMapSchema }, handler.createCareerRoadMapHandler);
    fastify.delete("/career-roadmap/:id", { schema: deleteDreamJobSchema }, handler.deleteDreamJobHandler);
    fastify.patch("/career-roadmap/:id/stages", { schema: editStagesSchema }, handler.editStagesHandler);
    fastify.post("/career-roadmap/opportunities", { schema: discoverOpportunitiesSchema }, handler.discoverOpportunitiesHandler);
};

