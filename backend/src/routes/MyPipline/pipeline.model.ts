import { z } from "zod";

export const PipelineSchema = z.object({
    id: z.string(),
    userId: z.string(),
    stages: z.array(z.string()).default(["watchlist", "in progress", "done"]),
});

export type Pipeline = z.infer<typeof PipelineSchema>;

