import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import type { CareerConfidenceSummary } from "./career-confidence.types";
import type { ConversationMode } from "./conversation-mode.types";

const FAST_SEARCH_SIGNALS = ["show me jobs", "find jobs", "jobs now", "search now", "skip to jobs"];
const DEEP_DISCOVERY_SIGNALS = ["don't know", "not sure", "no idea", "help me choose", "what fits me", "unsure"];

export class ConversationModeService {
    detectMode = (message: string, profile: UserCareerProfile, confidence: CareerConfidenceSummary): ConversationMode => {
        const normalized = message.toLowerCase();
        if (FAST_SEARCH_SIGNALS.some((signal) => normalized.includes(signal))) {
            return "FAST_SEARCH";
        }
        if (DEEP_DISCOVERY_SIGNALS.some((signal) => normalized.includes(signal))) {
            return "DEEP_DISCOVERY";
        }
        if (confidence.searchReadinessConfidence >= 70) {
            return "FAST_SEARCH";
        }
        if (confidence.discoveryConfidence >= 65 || profile.uncertaintyLevel >= 0.65) {
            return "DEEP_DISCOVERY";
        }
        return "GUIDED";
    };
}
