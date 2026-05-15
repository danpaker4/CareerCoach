export type OpenAiChatResponse = {
    choices?: readonly { message?: { content?: string | null } }[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
};
