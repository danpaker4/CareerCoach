import { CONVERSATION_MODE, CONVERSATION_MODE_VALUES } from "./conversation-mode.consts";
import type { ConversationMode, ConversationModeDetectionResult } from "./conversation-mode.types";

export const isConversationMode = (value: unknown): value is ConversationMode =>
    typeof value === "string" && (CONVERSATION_MODE_VALUES as readonly string[]).includes(value);

const toOptionalTrimmedString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const toReadinessScore = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;

const toMissingInformation = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];

export const parseConversationModeDetectionResult = (rawText: string): ConversationModeDetectionResult | null => {
    try {
        const parsed: unknown = JSON.parse(rawText);
        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }
        const candidate = parsed as Record<string, unknown>;
        if (!isConversationMode(candidate.mode)) {
            return null;
        }

        const mode = candidate.mode;
        const isReady = candidate.isReady === true;
        const dreamJobTitle =
            mode === CONVERSATION_MODE.DREAMJOB ? toOptionalTrimmedString(candidate.dreamJobTitle) : undefined;
        const searchQuery =
            mode === CONVERSATION_MODE.NEAR_TERM ? toOptionalTrimmedString(candidate.searchQuery) : undefined;

        return {
            mode,
            readinessScore: toReadinessScore(candidate.readinessScore),
            isReady,
            missingInformation: toMissingInformation(candidate.missingInformation),
            dreamJobTitle,
            shouldSearchJobs: mode === CONVERSATION_MODE.NEAR_TERM && isReady && searchQuery !== undefined,
            searchQuery,
        };
    } catch {
        return null;
    }
};
