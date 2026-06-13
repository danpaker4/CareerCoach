import { DEFAULT_CONVERSATION_MODE } from "./conversation-mode.consts";
import type { ConversationMode } from "./conversation-mode.types";

export type DetectModeParams = {
    hasActiveDreamJobFlow: boolean;
};

export class ConversationModeService {
    detectMode = (params: DetectModeParams): ConversationMode => {
        if (params.hasActiveDreamJobFlow) {
            return "DREAMJOB";
        }

        return DEFAULT_CONVERSATION_MODE;
    };
}
