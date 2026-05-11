import { FastifyReply } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import type { PipelineJob } from "./pipeline-job.model";
import { 
    getPipelineJobsByUserIdSchema, 
    createPipelineJobSchema, 
    updatePipelineJobStageSchema, 
    updatePipelineJobDescriptionSchema, 
    deletePipelineJobSchema 
} from "./pipeline-job.schema";
import { v4 as uuidv4 } from "uuid";

type PipelineJobHandlerType = {
    getPipelineJobsByUserIdHandler: (request: SchematicRequest<typeof getPipelineJobsByUserIdSchema>, reply: FastifyReply) => Promise<void>;
    createPipelineJobHandler: (request: SchematicRequest<typeof createPipelineJobSchema>, reply: FastifyReply) => Promise<void>;
    updatePipelineJobStageHandler: (request: SchematicRequest<typeof updatePipelineJobStageSchema>, reply: FastifyReply) => Promise<void>;
    updatePipelineJobDescriptionHandler: (request: SchematicRequest<typeof updatePipelineJobDescriptionSchema>, reply: FastifyReply) => Promise<void>;
    deletePipelineJobHandler: (request: SchematicRequest<typeof deletePipelineJobSchema>, reply: FastifyReply) => Promise<void>;
};

export const PipelineJobHandler = (pipelineJobsCollection: Collection<PipelineJob>): PipelineJobHandlerType => {
    return {
        getPipelineJobsByUserIdHandler: async (request: SchematicRequest<typeof getPipelineJobsByUserIdSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const jobs = await pipelineJobsCollection.find({ userId }).toArray();

                if (!jobs || jobs.length === 0) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "No jobs found for this user" });
                    return;
                }

                reply.code(StatusCodes.OK).send(jobs);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        createPipelineJobHandler: async (request: SchematicRequest<typeof createPipelineJobSchema>, reply: FastifyReply) => {
            try {
                const jobData = request.body;
                const existing = await pipelineJobsCollection.findOne({
                    userId: jobData.userId,
                    jobId: jobData.jobId,
                });
                if (existing) {
                    reply.code(StatusCodes.CONFLICT).send({ error: "This job is already in your pipeline." });
                    return;
                }
                const newJob: PipelineJob = {
                    id: uuidv4(),
                    ...jobData,
                    createdAt: jobData.createdAt ?? new Date(),
                };

                await pipelineJobsCollection.insertOne(newJob);
                reply.code(StatusCodes.CREATED).send(newJob);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        updatePipelineJobStageHandler: async (request: SchematicRequest<typeof updatePipelineJobStageSchema>, reply: FastifyReply) => {
            const { id } = request.params;
            const { jobStage } = request.body;

            try {
                const result = await pipelineJobsCollection.findOneAndUpdate(
                    { id },
                    { $set: { jobStage } },
                    { returnDocument: "after" }
                );

                if (!result) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Job not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(result);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        updatePipelineJobDescriptionHandler: async (request: SchematicRequest<typeof updatePipelineJobDescriptionSchema>, reply: FastifyReply) => {
            const { id } = request.params;
            const { description } = request.body;

            try {
                const result = await pipelineJobsCollection.findOneAndUpdate(
                    { id },
                    { $set: { description } },
                    { returnDocument: "after" }
                );

                if (!result) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Job not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(result);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        deletePipelineJobHandler: async (request: SchematicRequest<typeof deletePipelineJobSchema>, reply: FastifyReply) => {
            const { id } = request.params;

            try {
                const result = await pipelineJobsCollection.deleteOne({ id });

                if (result.deletedCount === 0) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Job not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send({ message: `Job ${id} deleted`, status: "OK" });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },
    };
};
