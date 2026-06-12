import type { ConfidenceSummary } from "../confidence/confidence.types";
import { DEEP_DISCOVERY_SIGNALS, FAST_SEARCH_SIGNALS } from "./conversation-mode.consts";
import type { ConversationMode } from "./conversation-mode.types";
import { shouldEnterDreamJobMode } from "./conversation-mode.utils";

export type DetectModeParams = {
    message: string;
    confidence: ConfidenceSummary;
    existingDreamJob?: string | null;
};

export class ConversationModeService {
    detectMode = (params: DetectModeParams): ConversationMode => {
        const { message, confidence, existingDreamJob = null } = params;
        const normalized = message.toLowerCase();

        if (shouldEnterDreamJobMode(message, existingDreamJob)) {
            return "DREAMJOB";
        }
        if (FAST_SEARCH_SIGNALS.some((signal) => normalized.includes(signal)) || confidence.searchReadinessConfidence >= 70) {
            return "FAST_SEARCH";
        }
        if (DEEP_DISCOVERY_SIGNALS.some((signal) => normalized.includes(signal)) || confidence.discoveryConfidence >= 65) {
            return "DEEP_DISCOVERY";
        }
        return "GUIDED";
    };
}
