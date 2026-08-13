export type ChatLlmObservedOperation =
    | "chat.decision"
    | "chat.job_aware_reply"
    | "chat.dream_job"
    | "chat.onboarding"
    | "chat.onboarding.background_review"
    | "chat.onboarding.target_role"
    | "chat.onboarding.target_role.retry"
    | "chat.onboarding.target_role.discovery"
    | "chat.onboarding.target_role.review"
    | "chat.onboarding.target_role.review.retry"
    | "chat.onboarding.target_role.suggestion_review"
    | "chat.onboarding.target_role.suggestion_review.retry"
    | "chat.onboarding.target_role.verify"
    | "chat.onboarding.target_role.verify.retry"
    | "chat.conversation_end";

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
