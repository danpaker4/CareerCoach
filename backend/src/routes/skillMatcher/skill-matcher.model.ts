import { z } from "zod";

export const SkillToImproveSchema = z.object({
    skill: z.string(),
    isDone: z.boolean(),
});

export const SkillMatcherSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    jobId: z.number(),
    skillToImprove: z.array(SkillToImproveSchema),
});

export type SkillToImprove = z.infer<typeof SkillToImproveSchema>;
export type SkillMatcher = z.infer<typeof SkillMatcherSchema>;
