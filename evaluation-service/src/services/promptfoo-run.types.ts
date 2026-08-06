export type PromptfooRunStatus = "idle" | "running" | "completed" | "failed";

export type PromptfooRunOptions = {
    filterFirstN?: number;
    filterPattern?: string;
    noCache?: boolean;
};

export type PromptfooRunSnapshot = {
    runId: string | null;
    status: PromptfooRunStatus;
    startedAt: string | null;
    finishedAt: string | null;
    exitCode: number | null;
    options: PromptfooRunOptions;
    logTail: string[];
    error: string | null;
};

export type PromptfooRunConfig = {
    packageDir: string;
};
