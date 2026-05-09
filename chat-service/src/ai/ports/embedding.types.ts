export type EmbeddingPort = {
    readonly embedText: (text: string) => Promise<number[]>;
    readonly embedJob: (jobText: string) => Promise<number[]>;
    readonly embedUserMemory: (memoryText: string) => Promise<number[]>;
    readonly embedCareerProfile: (profileText: string) => Promise<number[]>;
    readonly embedCareerDirection: (directionText: string) => Promise<number[]>;
};
