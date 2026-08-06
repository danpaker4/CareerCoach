import type {
    ChatTurnDecision,
    JobSearchRequest,
    LlmDecision,
} from "../../api/shared/chat.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import type { ConversationMode } from "../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ConversationStage } from "../../../routes/conversation/conversation.types";
import { LLM_DECISION_PARSE_FALLBACK_REPLIES } from "./chat.llm.consts";
import { compactJobRecommendationSchema, compactTurnDecisionSchema } from "./chat.llm.schemas";

const parseCompactMode = (value: unknown): ConversationMode | null => {
    if (value === "G") {
        return CONVERSATION_MODE.GUIDED;
    }
    if (value === "N") {
        return CONVERSATION_MODE.NEAR_TERM;
    }
    if (value === "D") {
        return CONVERSATION_MODE.DREAMJOB;
    }
    return null;
};

export const parseLlmDecisionFromJson = (rawText: string): LlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    const obj = compactJobRecommendationSchema.parse(parsed);
    return {
        reply: obj.r,
        shouldSearchJobs: false,
        recommendedJobIds: obj.ids,
        searchFilters: { skills: [], interests: [], experienceLevel: "", keywords: [] },
    };
};

export const parseChatTurnDecisionFromJson = (rawText: string): ChatTurnDecision => {
    const parsed: unknown = JSON.parse(rawText);
    const obj = compactTurnDecisionSchema.parse(parsed);
    const compactMode = parseCompactMode(obj.m);
    if (!compactMode) {
        throw new Error("LLM returned an invalid compact conversation mode");
    }
    const target = obj.target?.trim() || undefined;
    const searchFilters: JobSearchRequest = {
        skills: obj.skills,
        interests: obj.interests,
        experienceLevel: obj.level,
        keywords: obj.keywords,
    };
    return {
        reply: obj.r,
        shouldSearchJobs: obj.search,
        recommendedJobIds: [],
        searchFilters,
        modeDetection: {
            mode: compactMode,
            readinessScore: obj.ready ? 100 : 0,
            isReady: obj.ready,
            missingInformation: obj.ready ? [] : ["conversation goal"],
            dreamJobTitle: compactMode === CONVERSATION_MODE.DREAMJOB ? target : undefined,
            shouldSearchJobs: compactMode === CONVERSATION_MODE.NEAR_TERM && obj.search && target !== undefined,
            searchQuery: compactMode === CONVERSATION_MODE.NEAR_TERM ? target : undefined,
        },
        shouldAdvanceStage: obj.advance,
    };
};

export const resolveDecisionParseFallbackReply = (currentStage: ConversationStage | null): string => {
    if (currentStage?.id === "achievements") {
        return LLM_DECISION_PARSE_FALLBACK_REPLIES.achievements;
    }
    if (currentStage?.id === "timeline") {
        return LLM_DECISION_PARSE_FALLBACK_REPLIES.timeline;
    }
    if (currentStage?.id === "preferences") {
        return LLM_DECISION_PARSE_FALLBACK_REPLIES.preferences;
    }
    return LLM_DECISION_PARSE_FALLBACK_REPLIES.default;
};
