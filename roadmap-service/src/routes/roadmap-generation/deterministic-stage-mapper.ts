import type { DeterministicStage } from "./builder/deterministic-stage-builder.types";
import type { GeneratedStageContent } from "./roadmap-generation.types";

export const mapDeterministicStageToGeneratedContent = (
    stage: DeterministicStage
): GeneratedStageContent => ({
    label: stage.label,
    description: stage.description,
    actions: [...stage.actions],
    resources: stage.resources.map((resource) => ({ ...resource })),
    estimatedTimeframe: stage.estimatedTimeframe,
    whyItMatters: stage.whyItMatters,
    howToGetThere: stage.howToGetThere,
    whatYouGain: stage.whatYouGain,
    progressionType: stage.progressionType,
    requiredCapabilities: [...stage.requiredCapabilities],
    skillsToBuild: [...stage.skillsToBuild],
    responsibilitiesToGain: [...stage.responsibilitiesToGain],
    experienceAccumulation: stage.experienceAccumulation,
    roleCategories: [...stage.roleCategories],
    futureOpportunities: [...stage.futureOpportunities],
    templateId: stage.templateId,
    capabilityIds: [...stage.capabilityIds],
    gapIds: [...stage.gapIds],
    completionCriteria: stage.completionCriteria.map((criterion) => ({ ...criterion })),
    timelineMeta: {
        effortHours: stage.timelineMeta.effortHours,
        hoursPerWeek: stage.timelineMeta.hoursPerWeek,
        estimatedWeeks: stage.timelineMeta.estimatedWeeks,
        minMonths: stage.timelineMeta.minMonths,
        maxMonths: stage.timelineMeta.maxMonths,
        assumedAvailability: stage.timelineMeta.assumedAvailability,
        assumptions: [...stage.timelineMeta.assumptions],
    },
    evidence: {
        gapIds: [...stage.evidence.gapIds],
        capabilityIds: [...stage.evidence.capabilityIds],
        actionIds: [...stage.evidence.actionIds],
        resourceIds: [...stage.evidence.resourceIds],
        gapsAddressed: [...stage.evidence.gapsAddressed],
        transitionReasons: [...stage.evidence.transitionReasons],
        marketSignals: [...stage.evidence.marketSignals],
    },
    reasonCodes: [...stage.reasonCodes],
    actionIds: [...stage.actionIds],
    resourceIds: [...stage.resourceIds],
});
