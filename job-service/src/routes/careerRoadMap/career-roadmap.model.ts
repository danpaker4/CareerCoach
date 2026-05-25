import { z } from "zod";

export const StageContentSchema = z.object({
    label: z.string(),
    description: z.string(),
    actions: z.array(z.string()),
    estimatedTimeframe: z.string().optional(),
});

export const StageToDreamJobSchema = z.object({
    jobId: z.number(),
    isDone: z.boolean(),
    content: StageContentSchema.optional(),
});

export const CareerRoadMapSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    dreamJob: z.string(),
    stagesToDreamJob: z.array(StageToDreamJobSchema),
    generatedAt: z.coerce.date().optional(),
});

export type StageContent = z.infer<typeof StageContentSchema>;
export type StageToDreamJob = z.infer<typeof StageToDreamJobSchema>;
export type CareerRoadMap = z.infer<typeof CareerRoadMapSchema>;

