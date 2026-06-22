import type { JobSearchRequest, LlmDecision, StageLlmDecision } from "../chat.types";
import { DEFAULT_CONVERSATION_MODE } from "../conversation-mode/conversation-mode.consts";
import { isConversationMode } from "../conversation-mode/conversation-mode.utils";

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

export const parseLlmDecisionFromJson = (rawText: string): LlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object decision payload");
    }

    const obj = parsed as Record<string, unknown>;
    return {
        reply: typeof obj.reply === "string" ? obj.reply : "I need a bit more information to guide you.",
        shouldSearchJobs: obj.shouldSearchJobs === true,
        recommendedJobIds: Array.isArray(obj.recommendedJobIds)
            ? obj.recommendedJobIds.filter((jobId): jobId is string => typeof jobId === "string")
            : [],
        searchFilters: parseSearchFiltersFromUnknown(obj.searchFilters),
    };
};

export const parseStageLlmDecisionFromJson = (rawText: string): StageLlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object stage payload");
    }

    const obj = parsed as Record<string, unknown>;
    return {
        reply: typeof obj.reply === "string" ? obj.reply : "Thanks. Tell me a bit more so I can guide you accurately.",
        shouldAdvanceStage: obj.shouldAdvanceStage === true,
    };
};
