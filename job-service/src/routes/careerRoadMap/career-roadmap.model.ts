import { z } from "zod";

export const ProgressionTypeSchema = z.enum(["learning", "experience", "hybrid"]);

export const StageResourceSchema = z.object({
    title: z.string(),
    platform: z.string(),
    url: z.string(),
    type: z.enum(["course", "video", "practice", "article", "docs", "repository", "certification"]).optional(),
});

export const GapAnalysisSnapshotSchema = z.object({
    skillsPresent: z.array(z.string()),
    skillsMissing: z.array(z.string()),
    responsibilitiesMissing: z.array(z.string()),
    leadershipGaps: z.array(z.string()),
    architectureGaps: z.array(z.string()),
    domainGaps: z.array(z.string()),
    experienceGapSummary: z.string(),
});

export const CareerProgressionMetaSchema = z.object({
    currentRoleSummary: z.string().optional(),
    dreamRoleCategory: z.string(),
    estimatedYearsToGoal: z.string().optional(),
    progressionReasoning: z.string().optional(),
    gapAnalysis: GapAnalysisSnapshotSchema.optional(),
});

export const StageContentSchema = z.object({
    label: z.string(),
    description: z.string(),
    actions: z.array(z.string()),
    resources: z.array(StageResourceSchema).optional(),
    estimatedTimeframe: z.string().optional(),
    whyItMatters: z.string().optional(),
    progressionType: ProgressionTypeSchema.optional(),
    requiredCapabilities: z.array(z.string()).optional(),
    skillsToBuild: z.array(z.string()).optional(),
    responsibilitiesToGain: z.array(z.string()).optional(),
    experienceAccumulation: z.string().optional(),
    roleCategories: z.array(z.string()).optional(),
    futureOpportunities: z.array(z.string()).optional(),
});

export const StageToDreamJobSchema = z.object({
    jobId: z.number(),
    isDone: z.boolean(),
    content: StageContentSchema.optional(),
    completedActions: z.array(z.string()).optional(),
});

export const CareerRoadMapSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    dreamJob: z.string(),
    stagesToDreamJob: z.array(StageToDreamJobSchema),
    generatedAt: z.coerce.date().optional(),
    progressionMeta: CareerProgressionMetaSchema.optional(),
});

export type ProgressionType = z.infer<typeof ProgressionTypeSchema>;
export type GapAnalysisSnapshot = z.infer<typeof GapAnalysisSnapshotSchema>;
export type CareerProgressionMeta = z.infer<typeof CareerProgressionMetaSchema>;
export type StageContent = z.infer<typeof StageContentSchema>;
export type StageToDreamJob = z.infer<typeof StageToDreamJobSchema>;
export type CareerRoadMap = z.infer<typeof CareerRoadMapSchema>;
