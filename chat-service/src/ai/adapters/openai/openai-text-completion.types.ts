export type OpenAiChatResponse = {
    choices?: readonly { message?: { content?: string | null } }[];
};
