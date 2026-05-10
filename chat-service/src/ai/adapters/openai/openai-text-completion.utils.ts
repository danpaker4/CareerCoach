import type { OpenAiChatResponse } from "./openai-text-completion.types";

export const isOpenAiChatResponse = (value: unknown): value is OpenAiChatResponse =>
    typeof value === "object" && value !== null && "choices" in value;

export const formatOpenAiErrorMessage = (payload: unknown, statusText: string): string => {
    if (typeof payload === "object" && payload !== null && "error" in payload) {
        return JSON.stringify((payload as { error: unknown }).error);
    }
    return statusText;
};
