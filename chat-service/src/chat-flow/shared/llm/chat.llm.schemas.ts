import { z } from "zod";

const stringArraySchema = z.array(z.string());

export const compactTurnDecisionSchema = z.object({
    r: z.string().trim().min(1),
    m: z.enum(["G", "N", "D"]),
    ready: z.boolean(),
    target: z.string().nullable(),
    advance: z.boolean(),
    search: z.boolean(),
    skills: stringArraySchema,
    interests: stringArraySchema,
    level: z.string(),
    keywords: stringArraySchema,
});

export const compactJobRecommendationSchema = z.object({
    r: z.string().trim().min(1),
    ids: stringArraySchema,
});
