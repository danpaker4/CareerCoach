import type { ChatLlmObserver, ChatLlmParseEvent } from "./chat.llm.types";

const readParseErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : "Unknown LLM response parse error";

export const recordChatLlmParseEvent = (
    observer: ChatLlmObserver | undefined,
    event: Omit<ChatLlmParseEvent, "errorMessage">,
    error?: unknown
): void => {
    observer?.recordParseEvent({
        ...event,
        ...(error === undefined ? {} : { errorMessage: readParseErrorMessage(error) }),
    });
};
