import { z } from "zod";

export const ProgressionTypeSchema = z.enum(["learning", "experience", "hybrid"]);

export const StageResourceSchema = z.object({
    title: z.string(),
    platform: z.string(),
    url: z.string(),
    type: z.enum(["course", "video", "practice", "article", "docs", "repository", "certification"]).optional(),
    costType: z.enum(["free", "paid", "free-audit"]).optional(),
    priceLabel: z.string().optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    estimatedHours: z.number().positive().optional(),
    skills: z.array(z.string()).optional(),
    lastVerifiedAt: z.string().optional(),
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

export const CompletionCriterionSchema = z.object({
    id: z.string(),
    description: z.string(),
    metric: z.enum(["actions_complete", "hours_logged", "artifact_ready", "self_attest"]),
    targetValue: z.number(),
});

export const TimelineMetaSchema = z.object({
    effortHours: z.number(),
    hoursPerWeek: z.number(),
    estimatedWeeks: z.number(),
    assumedAvailability: z.boolean(),
});

export const StageEvidenceSchema = z.object({
    gapIds: z.array(z.string()),
    capabilityIds: z.array(z.string()),
    actionIds: z.array(z.string()),
    resourceIds: z.array(z.string()),
});

export const SelectedPathMetaSchema = z.object({
    fromRole: z.string(),
    toRole: z.string(),
    requiredSkills: z.array(z.string()),
    overlapScore: z.number(),
    source: z.string(),
    rankScore: z.number(),
    reasonCodes: z.array(z.string()),
});

export const StructuredCapabilityGapSchema = z.object({
    gapId: z.string(),
    capabilityId: z.string(),
    label: z.string(),
    category: z.string(),
    requiredLevel: z.number(),
    currentLevel: z.number(),
    gapScore: z.number(),
    marketImportance: z.number(),
    priorityScore: z.number(),
    reasonCodes: z.array(z.string()),
});

export const CareerProgressionMetaSchema = z.object({
    currentRoleSummary: z.string().optional(),
    dreamRoleCategory: z.string(),
    estimatedYearsToGoal: z.string().optional(),
    targetYears: z.number().int().positive().optional(),
    progressionReasoning: z.string().optional(),
    gapAnalysis: GapAnalysisSnapshotSchema.optional(),
    generationVersion: z.string().optional(),
    generationMode: z.string().optional(),
    selectedPath: SelectedPathMetaSchema.optional(),
    structuredGapAnalysis: z
        .object({
            gaps: z.array(StructuredCapabilityGapSchema),
        })
        .optional(),
    alternativePaths: z.array(z.object({
        id: z.string(),
        label: z.string(),
        summary: z.string(),
        roles: z.array(z.string()),
        isRecommended: z.boolean(),
    })).max(3).optional(),
    preferences: z.object({
        courseBudget: z.enum(["free", "mixed", "paid"]).optional(),
        locationPreference: z.string().optional(),
        workPreference: z.enum(["onsite", "hybrid", "remote", "flexible"]).optional(),
        willingToManagePeople: z.boolean().optional(),
        willingToChangeCompanies: z.boolean().optional(),
    }).optional(),
    feasibility: z.object({
        status: z.enum(["on-track", "ambitious", "conflict"]),
        message: z.string(),
        reasons: z.array(z.string()),
    }).optional(),
});

export const StageContentSchema = z.object({
    stageId: z.string().optional(),
    label: z.string(),
    description: z.string(),
    actions: z.array(z.string()),
    resources: z.array(StageResourceSchema).optional(),
    estimatedTimeframe: z.string().optional(),
    whyItMatters: z.string().optional(),
    howToGetThere: z.string().optional(),
    whatYouGain: z.string().optional(),
    progressionType: ProgressionTypeSchema.optional(),
    requiredCapabilities: z.array(z.string()).optional(),
    skillsToBuild: z.array(z.string()).optional(),
    responsibilitiesToGain: z.array(z.string()).optional(),
    experienceAccumulation: z.string().optional(),
    roleCategories: z.array(z.string()).optional(),
    futureOpportunities: z.array(z.string()).optional(),
    templateId: z.string().optional(),
    capabilityIds: z.array(z.string()).optional(),
    gapIds: z.array(z.string()).optional(),
    completionCriteria: z.array(CompletionCriterionSchema).optional(),
    timelineMeta: TimelineMetaSchema.optional(),
    evidence: StageEvidenceSchema.optional(),
    reasonCodes: z.array(z.string()).optional(),
    actionIds: z.array(z.string()).optional(),
    resourceIds: z.array(z.string()).optional(),
    prerequisiteStageIds: z.array(z.string()).optional(),
    parallelStageIds: z.array(z.string()).optional(),
    orderingReason: z.string().optional(),
});

export const ProgressEvidenceSchema = z.object({
    id: z.string(),
    type: z.enum(["project", "promotion", "responsibility", "note"]),
    title: z.string(),
    url: z.string().url().optional(),
    details: z.string().optional(),
    createdAt: z.string(),
});

export const StageToDreamJobSchema = z.object({
    jobId: z.number(),
    isDone: z.boolean(),
    content: StageContentSchema.optional(),
    completedActions: z.array(z.string()).optional(),
    completedCriterionIds: z.array(z.string()).optional(),
    completedResourceUrls: z.array(z.string()).optional(),
    progressEvidence: z.array(ProgressEvidenceSchema).optional(),
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
