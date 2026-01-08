import { FastifyReply } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import type { Pipeline } from "./pipeline.model";
import { addStageSchema, deletePipelineSchema, deleteStageSchema, getPipelineByUserIdSchema } from "./pipeline.schema";

type PipelineHandlerType = {
    getPipelineByUserIdHandler: (request: SchematicRequest<typeof getPipelineByUserIdSchema>, reply: FastifyReply) => Promise<void>;
    addStageHandler: (request: SchematicRequest<typeof addStageSchema>, reply: FastifyReply) => Promise<void>;
    deleteStageHandler: (request: SchematicRequest<typeof deleteStageSchema>, reply: FastifyReply) => Promise<void>;
    deletePipelineHandler: (request: SchematicRequest<typeof deletePipelineSchema>, reply: FastifyReply) => Promise<void>;
};

export const PipelineHandler = (pipelinesCollection: Collection<Pipeline>): PipelineHandlerType => {
    return {
        getPipelineByUserIdHandler: async (request: SchematicRequest<typeof getPipelineByUserIdSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const pipeline = await pipelinesCollection.findOne({ userId });

                pipeline ? reply.code(StatusCodes.OK).send(pipeline) : reply.code(StatusCodes.NOT_FOUND).send({ error: "Pipeline not found" });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        addStageHandler: async (request: SchematicRequest<typeof addStageSchema>, reply: FastifyReply) => {
            const { userId } = request.params;
            const { stage } = request.body;

            try {
                const pipeline = await pipelinesCollection.findOne({ userId });

                if (!pipeline) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Pipeline not found" });
                } else {
                    const updatedStages = [...pipeline.stages, stage];
                    await pipelinesCollection.updateOne({ userId }, { $set: { stages: updatedStages } });

                    const updatedPipeline = await pipelinesCollection.findOne({ userId });
                    reply.code(StatusCodes.OK).send(updatedPipeline);
                }
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        deleteStageHandler: async (request: SchematicRequest<typeof deleteStageSchema>, reply: FastifyReply) => {
            const { userId, stage } = request.params;

            try {
                const pipeline = await pipelinesCollection.findOne({ userId });

                if (!pipeline) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Pipeline not found" });
                } else  {
                    const updatedStages = pipeline.stages.filter((s) => s !== stage);
                    await pipelinesCollection.updateOne({ userId }, { $set: { stages: updatedStages } });

                    const updatedPipeline = await pipelinesCollection.findOne({ userId });
                    reply.code(StatusCodes.OK).send(updatedPipeline);
                }
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        deletePipelineHandler: async (request: SchematicRequest<typeof deletePipelineSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const result = await pipelinesCollection.deleteOne({ userId });

               result.deletedCount === 0 ? reply.code(StatusCodes.NOT_FOUND).send({ error: "Pipeline not found" }) : reply.code(StatusCodes.OK).send({ message: `Pipeline for user ${userId} deleted`, status: "OK" });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },
    };
};

