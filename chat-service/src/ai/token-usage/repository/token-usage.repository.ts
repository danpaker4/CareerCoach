import type { Collection } from "mongodb";
import type { LlmTokenUsageDocument, LlmTokenUsageRecorder, LlmTokenUsageRecordInput } from "../token-usage.types";

export class LlmTokenUsageRepository implements LlmTokenUsageRecorder {
    constructor(private readonly collection: Collection<LlmTokenUsageDocument>) { }

    readonly record = async (input: LlmTokenUsageRecordInput): Promise<void> => {
        const requestStatus = input.requestStatus ?? "success";
        await this.collection.insertOne({
            createdAt: new Date(),
            sourceService: input.sourceService,
            operation: input.operation,
            ...(input.userId ? { userId: input.userId } : {}),
            provider: input.provider,
            model: input.model,
            promptTokens: input.usage?.promptTokens ?? 0,
            completionTokens: input.usage?.completionTokens ?? 0,
            totalTokens: input.usage?.totalTokens ?? 0,
            tokenStatus: input.usage ? "known" : "unknown",
            requestStatus,
            errorCount: requestStatus === "error" ? 1 : 0,
            ...(input.errorMessage ? { errorMessage: input.errorMessage.slice(0, 500) } : {}),
            requestCount: 1,
        });
    };
}
