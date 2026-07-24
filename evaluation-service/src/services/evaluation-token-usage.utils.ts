import mongoose from "mongoose";

export type EvaluationTokenUsage = {
    prompt: number;
    completion: number;
    total: number;
    requestCount: number;
};

const EMPTY_TOKEN_USAGE: EvaluationTokenUsage = {
    prompt: 0,
    completion: 0,
    total: 0,
    requestCount: 0,
};

type AggregatedTokenUsage = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestCount: number;
};

/**
 * Sums chat-service llmTokenUsage for a user in a time window.
 * Accurate when evaluation concurrency is 1 for the shared evaluation user.
 */
export const sumChatTokenUsageForUser = async (params: {
    userId: string;
    from: Date;
    to: Date;
}): Promise<EvaluationTokenUsage> => {
    const { userId, from, to } = params;
    if (mongoose.connection.readyState !== 1) {
        return EMPTY_TOKEN_USAGE;
    }

    const collection = mongoose.connection.collection("llmTokenUsage");
    const result = await collection
        .aggregate<AggregatedTokenUsage>([
            {
                $match: {
                    sourceService: "chat-service",
                    userId,
                    createdAt: { $gte: from, $lte: to },
                },
            },
            {
                $group: {
                    _id: null,
                    promptTokens: { $sum: "$promptTokens" },
                    completionTokens: { $sum: "$completionTokens" },
                    totalTokens: { $sum: "$totalTokens" },
                    requestCount: { $sum: "$requestCount" },
                },
            },
        ])
        .toArray();

    const aggregated = result[0];
    if (!aggregated) {
        return EMPTY_TOKEN_USAGE;
    }

    return {
        prompt: aggregated.promptTokens,
        completion: aggregated.completionTokens,
        total: aggregated.totalTokens,
        requestCount: aggregated.requestCount,
    };
};
