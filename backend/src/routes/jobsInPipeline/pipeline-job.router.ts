import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { PipelineJob } from "./pipeline-job.model";
import { 
    getPipelineJobsByUserIdSchema, 
    createPipelineJobSchema, 
    updatePipelineJobStageSchema, 
    updatePipelineJobDescriptionSchema, 
    deletePipelineJobSchema 
} from "./pipeline-job.schema";
import { PipelineJobHandler } from "./pipeline-job.handler";

type registerRouter = (fastify: TypedFastify) => void;

export const pipelineJobRouter = (pipelineJobsCollection: Collection<PipelineJob>): registerRouter => (fastify: TypedFastify): void => {
    const handler = PipelineJobHandler(pipelineJobsCollection);

    fastify.get("/jobs-in-pipeline/:userId", { schema: getPipelineJobsByUserIdSchema }, handler.getPipelineJobsByUserIdHandler);
    fastify.post("/jobs-in-pipeline", { schema: createPipelineJobSchema }, handler.createPipelineJobHandler);
    fastify.patch("/jobs-in-pipeline/:id/stage", { schema: updatePipelineJobStageSchema }, handler.updatePipelineJobStageHandler);
    fastify.patch("/jobs-in-pipeline/:id/description", { schema: updatePipelineJobDescriptionSchema }, handler.updatePipelineJobDescriptionHandler);
    fastify.delete("/jobs-in-pipeline/:id", { schema: deletePipelineJobSchema }, handler.deletePipelineJobHandler);
};
