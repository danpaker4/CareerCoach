import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import type { CareerConfidenceSummary } from "./career-confidence.types";

const toPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export class CareerConfidenceService {
    calculateConfidence = (profile: UserCareerProfile): CareerConfidenceSummary => {
        const skillsConfidence = toPercent((profile.technologies.length * 28) + (profile.strengths.length * 14));
        const goalsConfidence = toPercent((profile.shortTermGoals.length * 28) + (profile.longTermGoals.length * 20) + ((1 - profile.uncertaintyLevel) * 35));
        const preferencesConfidence = toPercent((profile.preferredRoles.length * 30) + (profile.interests.length * 16) + (profile.dislikes.length * 9));
        const workStyleConfidence = toPercent((profile.workStyle.length * 24) + (profile.personalitySignals.length * 14));
        const domainConfidence = toPercent((profile.preferredDomains.length * 30) + (profile.dislikedDomains.length * 10));
        const seniorityConfidence = toPercent(profile.senioritySignal ? 80 : 35);
        const searchReadinessConfidence = toPercent((skillsConfidence * 0.3) + (goalsConfidence * 0.25) + (preferencesConfidence * 0.25) + (domainConfidence * 0.2));
        const discoveryConfidence = toPercent((preferencesConfidence * 0.45) + (workStyleConfidence * 0.25) + ((100 - goalsConfidence) * 0.3));

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
