import { z } from "zod";

export const StageToDreamJobSchema = z.object({
    jobId: z.number(),
    isDone: z.boolean(),
});

export const CareerRoadMapSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    dreamJob: z.string(),
    stagesToDreamJob: z.array(StageToDreamJobSchema),
});

export type StageToDreamJob = z.infer<typeof StageToDreamJobSchema>;
export type CareerRoadMap = z.infer<typeof CareerRoadMapSchema>;

