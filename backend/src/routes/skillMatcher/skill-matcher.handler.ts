import { FastifyReply } from "fastify";
import type { Collection } from "mongodb";
import { StatusCodes } from "http-status-codes";
import type { SchematicRequest } from "../../types/fastify";
import type { SkillMatcher } from "./skill-matcher.model";
import { addSkillSchema, editSkillSchema, getSkillMatcherByUserIdSchema } from "./skill-matcher.schema";

type SkillMatcherHandlerType = {
    getSkillMatcherByUserIdHandler: (request: SchematicRequest<typeof getSkillMatcherByUserIdSchema>, reply: FastifyReply) => Promise<void>;
    addSkillHandler: (request: SchematicRequest<typeof addSkillSchema>, reply: FastifyReply) => Promise<void>;
    editSkillHandler: (request: SchematicRequest<typeof editSkillSchema>, reply: FastifyReply) => Promise<void>;
};

export const SkillMatcherHandler = (skillMatchersCollection: Collection<SkillMatcher>): SkillMatcherHandlerType => {
    return {
        getSkillMatcherByUserIdHandler: async (request: SchematicRequest<typeof getSkillMatcherByUserIdSchema>, reply: FastifyReply) => {
            const { userId } = request.params;

            try {
                const skillMatchers = await skillMatchersCollection.find({ userId }).toArray();

                if (!skillMatchers || skillMatchers.length === 0) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "No skill matchers found for this user" });
                    return;
                }

                reply.code(StatusCodes.OK).send(skillMatchers);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        addSkillHandler: async (request: SchematicRequest<typeof addSkillSchema>, reply: FastifyReply) => {
            const { id } = request.params;
            const newSkill = request.body;

            try {
                const result = await skillMatchersCollection.findOneAndUpdate(
                    { id },
                    { $push: { skillToImprove: newSkill } },
                    { returnDocument: "after" }
                );

                if (!result) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Skill matcher not found" });
                    return;
                }

                reply.code(StatusCodes.OK).send(result);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

        editSkillHandler: async (request: SchematicRequest<typeof editSkillSchema>, reply: FastifyReply) => {
            const { userId, jobId, skill } = request.params;
            const { isDone } = request.body;

            try {
                const skillMatcher = await skillMatchersCollection.findOne({ userId, jobId });

                if (!skillMatcher) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Skill matcher not found" });
                    return;
                }

                const skillIndex = skillMatcher.skillToImprove.findIndex((s) => s.skill === skill);

                if (skillIndex === -1) {
                    reply.code(StatusCodes.NOT_FOUND).send({ error: "Skill not found" });
                    return;
                }

                const result = await skillMatchersCollection.findOneAndUpdate(
                    { userId, jobId },
                    { $set: { [`skillToImprove.${skillIndex}.isDone`]: isDone } },
                    { returnDocument: "after" }
                );

                reply.code(StatusCodes.OK).send(result);
            } catch (error) {
                reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: "Internal server error", status: "ERROR" });
            }
        },

    };
}