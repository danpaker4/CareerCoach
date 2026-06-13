import type { CustomLlmResponse } from "./http-custom-text-completion.types";

export const readTextFromCustomLlmPayload = (payload: unknown): string | null => {
    if (typeof payload !== "object" || payload === null) {
        return null;
    }
    const record = payload as CustomLlmResponse;
    if (typeof record.text === "string" && record.text.trim().length > 0) {
        return record.text;
    }
    if (typeof record.reply === "string" && record.reply.trim().length > 0) {
        return record.reply;
    }
    if (typeof record.content === "string" && record.content.trim().length > 0) {
        return record.content;
    }
    return null;
};
