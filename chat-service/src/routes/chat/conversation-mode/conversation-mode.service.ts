import type { UserCareerProfile } from "../../career-profile/career-profile.types";
import type { ConfidenceSummary } from "../confidence/confidence.types";
import { DEEP_DISCOVERY_SIGNALS, FAST_SEARCH_SIGNALS } from "./conversation-mode.consts";
import type { ConversationMode } from "./conversation-mode.types";

export class ConversationModeService {
    detectMode = (message: string, confidence: ConfidenceSummary): ConversationMode => {
        const normalized = message.toLowerCase();
        if (FAST_SEARCH_SIGNALS.some((signal) => normalized.includes(signal)) || confidence.searchReadinessConfidence >= 70) {
            return "FAST_SEARCH";
        }
        if (DEEP_DISCOVERY_SIGNALS.some((signal) => normalized.includes(signal)) || confidence.discoveryConfidence >= 65) {
            return "DEEP_DISCOVERY";
        }
        return "GUIDED";
    };
}
