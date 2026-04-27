import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { CareerRoadMap } from "./career-roadmap.model";
import { createCareerRoadMapSchema, deleteDreamJobSchema, editStagesSchema, getCareerRoadMapByUserIdSchema } from "./career-roadmap.schema";
import { CareerRoadMapHandler } from "./career-roadmap.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const careerRoadMapRouter = (careerRoadMapsCollection: Collection<CareerRoadMap>): registerRouter => (fastify: TypedFastify): void => {
    const handler = CareerRoadMapHandler(careerRoadMapsCollection);

    fastify.get("/career-roadmap/:userId", { schema: getCareerRoadMapByUserIdSchema }, handler.getCareerRoadMapByUserIdHandler);
    // Added: create a new roadmap (was missing — no way to create one from UI without this)
    fastify.post("/career-roadmap", { schema: createCareerRoadMapSchema }, handler.createCareerRoadMapHandler);
    fastify.delete("/career-roadmap/:id", { schema: deleteDreamJobSchema }, handler.deleteDreamJobHandler);
    fastify.patch("/career-roadmap/:id/stages", { schema: editStagesSchema }, handler.editStagesHandler);
};

