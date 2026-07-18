import type { LiteLlmChatResponse } from "./text-completion.types";

export const isLiteLlmChatResponse = (value: unknown): value is LiteLlmChatResponse =>
    typeof value === "object" && value !== null && "choices" in value;

export const formatLiteLlmErrorMessage = (payload: unknown, statusText: string): string => {
    if (typeof payload === "object" && payload !== null && "error" in payload) {
        return JSON.stringify((payload as { error: unknown }).error);
    }
    return statusText;
};
