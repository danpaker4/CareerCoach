import { FastifyReply } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import type { CareerRoadMap } from "./career-roadmap.model";
import type { EnrichedJob } from "../../poller/job-poller-api-stack/stages/enrich/types";
import { v4 as uuidv4 } from "uuid";
import { createCareerRoadMapSchema, deleteDreamJobSchema, discoverOpportunitiesSchema, editStagesSchema, getCareerRoadMapByUserIdSchema } from "./career-roadmap.schema";
import { discoverStageOpportunities } from "./career-roadmap-opportunities.utils";

type CareerRoadMapHandlerType = {
    getCareerRoadMapByUserIdHandler: (request: SchematicRequest<typeof getCareerRoadMapByUserIdSchema>, reply: FastifyReply) => Promise<void>;
    createCareerRoadMapHandler: (request: SchematicRequest<typeof createCareerRoadMapSchema>, reply: FastifyReply) => Promise<void>;
    deleteDreamJobHandler: (request: SchematicRequest<typeof deleteDreamJobSchema>, reply: FastifyReply) => Promise<void>;
    editStagesHandler: (request: SchematicRequest<typeof editStagesSchema>, reply: FastifyReply) => Promise<void>;
    discoverOpportunitiesHandler: (request: SchematicRequest<typeof discoverOpportunitiesSchema>, reply: FastifyReply) => Promise<void>;
};

export const CareerRoadMapHandler = (
    careerRoadMapsCollection: Collection<CareerRoadMap>,
    jobsCollection: Collection<EnrichedJob>
): CareerRoadMapHandlerType => {
    return {
        // Added: create a new career roadmap for a user
        createCareerRoadMapHandler: async (request: SchematicRequest<typeof createCareerRoadMapSchema>, reply: FastifyReply) => {
            const { userId, dreamJob, stagesToDreamJob, generatedAt, progressionMeta } = request.body;
            try {
                const newRoadMap: CareerRoadMap = {
                    id: uuidv4(),
                    userId,
                    dreamJob,
                    stagesToDreamJob,
                    ...(generatedAt ? { generatedAt } : {}),
                    ...(progressionMeta ? { progressionMeta } : {}),
                };
                await careerRoadMapsCollection.insertOne(newRoadMap);
                reply.code(StatusCodes.CREATED).send(newRoadMap);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        getCareerRoadMapByUserIdHandler: async (request: SchematicRequest<typeof getCareerRoadMapByUserIdSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const roadMaps = await careerRoadMapsCollection.find({ userId }).toArray();
                reply.code(StatusCodes.OK).send(roadMaps);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        deleteDreamJobHandler: async (request: SchematicRequest<typeof deleteDreamJobSchema>, reply: FastifyReply) => {
            const { id } = request.params;

            try {
                const result = await careerRoadMapsCollection.deleteOne({ id });

                if (result.deletedCount === 0) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Career road map not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send({ message: `Career road map ${id} deleted`, status: "OK" });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        editStagesHandler: async (request: SchematicRequest<typeof editStagesSchema>, reply: FastifyReply) => {
            const { id } = request.params;
            const { stagesToDreamJob } = request.body;

            try {
                const result = await careerRoadMapsCollection.findOneAndUpdate(
                    { id },
                    { $set: { stagesToDreamJob } },
                    { returnDocument: "after" }
                );

                if (!result) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Career road map not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(result);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        discoverOpportunitiesHandler: async (request, reply) => {
            const { roleCategories, userSkills, limit } = request.body;
            try {
                const opportunities = await discoverStageOpportunities(jobsCollection, {
                    roleCategories,
                    ...(userSkills ? { userSkills } : {}),
                    ...(limit ? { limit } : {}),
                });
                reply.code(StatusCodes.OK).send({ opportunities });
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({
                    error: "Failed to discover opportunities",
                    details: error instanceof Error ? error.message : String(error),
                });
            }
        },
    };
};

