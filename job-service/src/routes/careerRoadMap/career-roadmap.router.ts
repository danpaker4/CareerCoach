import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { CareerRoadMap } from "./career-roadmap.model";
import { deleteDreamJobSchema, editStagesSchema, getCareerRoadMapByUserIdSchema } from "./career-roadmap.schema";
import { CareerRoadMapHandler } from "./career-roadmap.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const careerRoadMapRouter = (careerRoadMapsCollection: Collection<CareerRoadMap>): registerRouter => (fastify: TypedFastify): void => {
    const handler = CareerRoadMapHandler(careerRoadMapsCollection);

    fastify.get("/career-roadmap/:userId", { schema: getCareerRoadMapByUserIdSchema }, handler.getCareerRoadMapByUserIdHandler);
    fastify.delete("/career-roadmap/:id", { schema: deleteDreamJobSchema }, handler.deleteDreamJobHandler);
    fastify.patch("/career-roadmap/:id/stages", { schema: editStagesSchema }, handler.editStagesHandler);
};

