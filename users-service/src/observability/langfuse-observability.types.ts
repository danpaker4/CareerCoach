export type LangfuseAiObservationType = "generation" | "embedding";

export type LangfuseAiObservationOptions = {
    readonly operation: string;
    readonly type: LangfuseAiObservationType;
    readonly provider: string;
    readonly model: string;
    readonly userId?: string;
    readonly input: string;
};
