import { z } from "zod";

export const skillsGapLlmResultSchema = z.object({
    reply: z.string().trim().min(1),
    skillsToLearn: z.array(z.string().trim().min(1)),
});
