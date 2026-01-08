import { z } from "zod";

export const PipelineJobSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    jobId: z.number(),
    jobStage: z.string(),
    description: z.string(),
});

export type PipelineJob = z.infer<typeof PipelineJobSchema>;

