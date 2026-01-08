import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { Pipeline } from "./pipeline.model";
import { addStageSchema, deletePipelineSchema, deleteStageSchema, getPipelineByUserIdSchema } from "./pipeline.schema";
import { PipelineHandler } from "./pipeline.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const pipelineRouter = (pipelinesCollection: Collection<Pipeline>): registerRouter => (fastify: TypedFastify): void => {
    const handler = PipelineHandler(pipelinesCollection);

    fastify.get("/pipelines/:userId", { schema: getPipelineByUserIdSchema }, handler.getPipelineByUserIdHandler);
    fastify.post("/pipelines/:userId/stages", { schema: addStageSchema }, handler.addStageHandler);
    fastify.delete("/pipelines/:userId/stages/:stage", { schema: deleteStageSchema }, handler.deleteStageHandler);
    fastify.delete("/pipelines/:userId", { schema: deletePipelineSchema }, handler.deletePipelineHandler);
};

