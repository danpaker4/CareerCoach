export type ChatLlmObservedOperation = "chat.decision" | "chat.job_aware_reply" | "chat.dream_job";

export type ChatLlmParseEvent = {
    readonly operation: ChatLlmObservedOperation;
    readonly rawText: string;
    readonly parseStatus: "success" | "fallback";
    readonly userId?: string;
    readonly sessionId?: string;
    readonly errorMessage?: string;
};

export type ChatLlmObserver = {
    readonly recordParseEvent: (event: ChatLlmParseEvent) => void;
};
