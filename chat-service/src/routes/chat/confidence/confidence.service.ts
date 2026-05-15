import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import {
    DISCOVERY_CONFIDENCE_BLEND_PERCENT,
    DOMAIN_CONFIDENCE_POINTS,
    GOALS_CONFIDENCE_POINTS,
    PREFERENCES_CONFIDENCE_POINTS,
    SEARCH_READINESS_BLEND_PERCENT,
    SENIORITY_CONFIDENCE_POINTS,
    SKILLS_CONFIDENCE_POINTS,
    WORK_STYLE_CONFIDENCE_POINTS,
} from "./confidence.consts";
import type { ConfidenceSummary } from "./confidence.types";
import { blendPercentScores, toPercent } from "./confidence.utils";

export class ConfidenceService {
    calculateConfidence = (profile: UserCareerProfile): ConfidenceSummary => {
        const skillsConfidence = toPercent(
            profile.technologies.length * SKILLS_CONFIDENCE_POINTS.technologyPerItem
                + profile.strengths.length * SKILLS_CONFIDENCE_POINTS.strengthPerItem
        );
        const goalsConfidence = toPercent(
            profile.shortTermGoals.length * GOALS_CONFIDENCE_POINTS.shortTermGoalPerItem
                + profile.longTermGoals.length * GOALS_CONFIDENCE_POINTS.longTermGoalPerItem
                + (1 - profile.uncertaintyLevel) * GOALS_CONFIDENCE_POINTS.clarityFromLowUncertaintyMax
        );
        const preferencesConfidence = toPercent(
            profile.preferredRoles.length * PREFERENCES_CONFIDENCE_POINTS.preferredRolePerItem
                + profile.interests.length * PREFERENCES_CONFIDENCE_POINTS.interestPerItem
                + profile.dislikes.length * PREFERENCES_CONFIDENCE_POINTS.dislikePerItem
        );
        const workStyleConfidence = toPercent(
            profile.workStyle.length * WORK_STYLE_CONFIDENCE_POINTS.workStylePerItem
                + profile.personalitySignals.length * WORK_STYLE_CONFIDENCE_POINTS.personalitySignalPerItem
        );
        const domainConfidence = toPercent(
            profile.preferredDomains.length * DOMAIN_CONFIDENCE_POINTS.preferredDomainPerItem
                + profile.dislikedDomains.length * DOMAIN_CONFIDENCE_POINTS.dislikedDomainPerItem
        );
        const seniorityConfidence = toPercent(
            profile.senioritySignal ? SENIORITY_CONFIDENCE_POINTS.whenKnown : SENIORITY_CONFIDENCE_POINTS.whenUnknown
        );
        const searchReadinessConfidence = blendPercentScores([
            { score: skillsConfidence, weightPercent: SEARCH_READINESS_BLEND_PERCENT.skills },
            { score: goalsConfidence, weightPercent: SEARCH_READINESS_BLEND_PERCENT.goals },
            { score: preferencesConfidence, weightPercent: SEARCH_READINESS_BLEND_PERCENT.preferences },
            { score: domainConfidence, weightPercent: SEARCH_READINESS_BLEND_PERCENT.domain },
        ]);
        const discoveryConfidence = blendPercentScores([
            { score: preferencesConfidence, weightPercent: DISCOVERY_CONFIDENCE_BLEND_PERCENT.preferences },
            { score: workStyleConfidence, weightPercent: DISCOVERY_CONFIDENCE_BLEND_PERCENT.workStyle },
            { score: 100 - goalsConfidence, weightPercent: DISCOVERY_CONFIDENCE_BLEND_PERCENT.goalsGap },
        ]);

        return {
            skillsConfidence,
            goalsConfidence,
            preferencesConfidence,
            workStyleConfidence,
            domainConfidence,
            seniorityConfidence,
            searchReadinessConfidence,
            discoveryConfidence,
        };
    };
}
