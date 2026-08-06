/**
 * Feature flags for deterministic roadmap generation.
 * Legacy LLM stage invention was removed in v2; `deterministicCoreEnabled` remains for
 * observability/compat and is expected to stay true in production.
 */
export type RoadmapFeatureFlags = {
    readonly deterministicCoreEnabled: boolean;
    readonly aiPolishEnabled: boolean;
    readonly structuredEvidenceEnabled: boolean;
    readonly measurableCompletionEnabled: boolean;
};

export type RoadmapFeatureFlagEnv = {
    readonly ROADMAP_DETERMINISTIC_CORE_ENABLED?: boolean;
    readonly ROADMAP_AI_POLISH_ENABLED?: boolean;
    readonly ROADMAP_STRUCTURED_EVIDENCE_ENABLED?: boolean;
    readonly ROADMAP_MEASURABLE_COMPLETION_ENABLED?: boolean;
};

export const resolveRoadmapFeatureFlags = (env: RoadmapFeatureFlagEnv): RoadmapFeatureFlags => ({
    deterministicCoreEnabled: env.ROADMAP_DETERMINISTIC_CORE_ENABLED ?? true,
    aiPolishEnabled: env.ROADMAP_AI_POLISH_ENABLED ?? false,
    structuredEvidenceEnabled: env.ROADMAP_STRUCTURED_EVIDENCE_ENABLED ?? true,
    measurableCompletionEnabled: env.ROADMAP_MEASURABLE_COMPLETION_ENABLED ?? true,
});
