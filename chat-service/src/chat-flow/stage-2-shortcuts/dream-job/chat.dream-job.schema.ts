import { z } from "zod";

export const dreamJobLlmDecisionSchema = z.object({
    reply: z.string().trim().min(1),
    proposedDreamJobTitle: z.string().optional(),
    awaitingConfirmation: z.boolean(),
    userConfirmed: z.boolean(),
});
