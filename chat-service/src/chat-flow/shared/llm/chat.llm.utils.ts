import type {
    ChatTurnDecision,
    JobSearchRequest,
    LlmDecision,
} from "../../api/shared/chat.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import type { ConversationMode } from "../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import { parseConversationModeDetectionResult } from "../../stage-1-prepare-context/mode-detection/conversation-mode.utils";

const parseSearchFiltersFromUnknown = (value: unknown): JobSearchRequest => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { skills: [], interests: [], experienceLevel: "", keywords: [] };
    }
    const filters = value as Record<string, unknown>;
    const stringArray = (key: "skills" | "interests" | "keywords"): string[] =>
        Array.isArray(filters[key])
            ? (filters[key] as unknown[]).filter((item): item is string => typeof item === "string")
            : [];
    return {
        skills: stringArray("skills"),
        interests: stringArray("interests"),
        experienceLevel: typeof filters.experienceLevel === "string" ? filters.experienceLevel : "",
        keywords: stringArray("keywords"),
    };
};

const parseCompactSearchFilters = (value: Record<string, unknown>): JobSearchRequest => {
    const readStringArray = (key: "skills" | "interests" | "keywords"): string[] =>
        Array.isArray(value[key])
            ? value[key].filter((item): item is string => typeof item === "string")
            : [];
    return {
        skills: readStringArray("skills"),
        interests: readStringArray("interests"),
        experienceLevel: typeof value.level === "string" ? value.level : "",
        keywords: readStringArray("keywords"),
    };
};

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
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object decision payload");
    }

    const obj = parsed as Record<string, unknown>;
    const compactResponse = typeof obj.r === "string";
    return {
        reply: typeof obj.reply === "string"
            ? obj.reply
            : typeof obj.r === "string"
                ? obj.r
                : "I need a bit more information to guide you.",
        shouldSearchJobs: obj.shouldSearchJobs === true || obj.search === true,
        recommendedJobIds: Array.isArray(obj.recommendedJobIds)
            ? obj.recommendedJobIds.filter((jobId): jobId is string => typeof jobId === "string")
            : Array.isArray(obj.ids)
                ? obj.ids.filter((jobId): jobId is string => typeof jobId === "string")
                : [],
        searchFilters: compactResponse
            ? parseCompactSearchFilters(obj)
            : parseSearchFiltersFromUnknown(obj.searchFilters),
    };
};

export const parseChatTurnDecisionFromJson = (rawText: string): ChatTurnDecision => {
    const decision = parseLlmDecisionFromJson(rawText);
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object turn decision payload");
    }
    const obj = parsed as Record<string, unknown>;
    const compactMode = parseCompactMode(obj.m);
    if (compactMode) {
        const target = typeof obj.target === "string" && obj.target.trim().length > 0
            ? obj.target.trim()
            : undefined;
        const isReady = obj.ready === true;
        return {
            ...decision,
            modeDetection: {
                mode: compactMode,
                readinessScore: isReady ? 100 : 0,
                isReady,
                missingInformation: isReady ? [] : ["conversation goal"],
                dreamJobTitle: compactMode === CONVERSATION_MODE.DREAMJOB ? target : undefined,
                shouldSearchJobs: compactMode === CONVERSATION_MODE.NEAR_TERM
                    && decision.shouldSearchJobs
                    && target !== undefined,
                searchQuery: compactMode === CONVERSATION_MODE.NEAR_TERM ? target : undefined,
            },
            shouldAdvanceStage: obj.advance === true,
        };
    }

    const modeDetection = parseConversationModeDetectionResult(rawText);
    if (!modeDetection) {
        throw new Error("LLM returned an invalid conversation mode");
    }
    return {
        ...decision,
        modeDetection,
        shouldAdvanceStage: obj.shouldAdvanceStage === true,
    };
};
