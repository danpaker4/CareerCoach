export type ConversationMode = "FAST_SEARCH" | "GUIDED" | "DEEP_DISCOVERY" | "DREAMJOB";

export type ConversationModeDetectionResult = {
    mode: ConversationMode;
    fastSearchQuery?: string;
};

export type DreamJobContextMessage = {
    role: string;
    content: string;
};
