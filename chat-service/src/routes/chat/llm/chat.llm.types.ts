export type ChatLlmObservedOperation = "chat.decision" | "chat.stage_reply" | "chat.job_aware_reply";

export type ChatLlmParseEvent = {
    readonly operation: ChatLlmObservedOperation;
    readonly rawText: string;
    readonly parseStatus: "success" | "fallback";
};

export type ChatLlmObserver = {
    readonly recordParseEvent: (event: ChatLlmParseEvent) => void;
};
