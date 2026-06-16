import type { FastifySchema } from "fastify";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

const CareerPathProfileSchema = z.object({
    fromRole: z.string(),
    toRole: z.string(),
    requiredSkills: z.array(z.string()),
    overlapScore: z.number(),
    evidenceJobIds: z.array(z.string()),
    embedding: z.array(z.number()),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

const CareerRoleProfileResponseSchema = z.object({
    roleCategory: z.string(),
    roleName: z.string(),
    commonSkills: z.array(z.string()),
    relatedRoles: z.array(z.string()),
    commonDomains: z.array(z.string()),
    responsibilities: z.array(z.string()),
    leadershipSignals: z.array(z.string()),
    architectureSignals: z.array(z.string()),
    seniorityDistribution: z.record(z.string(), z.number()),
    sourceJobIds: z.array(z.string()),
    embedding: z.array(z.number()),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

const MarketRequirementsResponseSchema = z.object({
    roleCategory: z.string(),
    commonSkills: z.array(z.string()),
    responsibilities: z.array(z.string()),
    leadershipSignals: z.array(z.string()),
    architectureSignals: z.array(z.string()),
    seniorityDistribution: z.record(z.string(), z.number()),
    sampleJobCount: z.number(),
});

export const careerKnowledgeRefreshSchema = {
    response: {
        [StatusCodes.OK]: z.object({
            status: z.string(),
            roleCount: z.number(),
            pathCount: z.number(),
            skillCount: z.number(),
        }),
    },
} satisfies FastifySchema;

export const careerKnowledgeRoleSchema = {
    params: z.object({ roleCategory: z.string().min(1) }),
    response: {
        [StatusCodes.OK]: CareerRoleProfileResponseSchema,
        [StatusCodes.NOT_FOUND]: z.object({ error: z.string() }),
    },
} satisfies FastifySchema;

export const careerKnowledgeMarketRequirementsSchema = {
    querystring: z.object({ roleCategory: z.string().min(1) }),
    response: {
        [StatusCodes.OK]: MarketRequirementsResponseSchema,
        [StatusCodes.NOT_FOUND]: z.object({ error: z.string() }),
    },
} satisfies FastifySchema;

export const careerKnowledgePathsSchema = {
    querystring: z.object({
        fromRole: z.string().min(1),
        toRole: z.string().min(1),
    }),
    response: {
        [StatusCodes.OK]: z.object({
            fromRole: z.string(),
            toRole: z.string(),
            paths: z.array(CareerPathProfileSchema),
        }),
    },
} satisfies FastifySchema;
