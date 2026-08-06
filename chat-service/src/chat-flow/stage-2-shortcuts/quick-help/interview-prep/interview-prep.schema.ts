import { z } from "zod";

export const interviewQuestionsLlmResultSchema = z.object({
    questions: z.array(z.string().trim().min(1)).min(1),
});

export const interviewGradeLlmResultSchema = z.object({
    correct: z.boolean(),
    feedback: z.string().trim().min(1),
});
