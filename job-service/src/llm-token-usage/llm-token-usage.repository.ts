import type { Collection } from "mongodb";
import type {
    LlmTokenUsageDocument,
    LlmTokenUsageRecorder,
    LlmTokenUsageRecordInput,
} from "./llm-token-usage.types";

export class LlmTokenUsageRepository implements LlmTokenUsageRecorder {
    constructor(private readonly collection: Collection<LlmTokenUsageDocument>) { }

    readonly record = async (input: LlmTokenUsageRecordInput): Promise<void> => {
        await this.collection.insertOne({
            createdAt: new Date(),
            sourceService: input.sourceService,
            operation: input.operation,
            provider: input.provider,
            model: input.model,
            promptTokens: input.usage?.promptTokens ?? 0,
            completionTokens: input.usage?.completionTokens ?? 0,
            totalTokens: input.usage?.totalTokens ?? 0,
            tokenStatus: input.usage ? "known" : "unknown",
            requestCount: 1,
        });
    };
}
