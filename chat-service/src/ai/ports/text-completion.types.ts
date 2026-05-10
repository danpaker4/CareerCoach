export type TextCompletionPort = {
    readonly complete: (prompt: string) => Promise<string>;
};
