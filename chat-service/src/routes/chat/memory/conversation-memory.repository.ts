import type { Collection } from "mongodb";
import type { ConversationMemoryDocument } from "./conversation-memory.model";

export class ConversationMemoryRepository {
    constructor(private readonly collection: Collection<ConversationMemoryDocument>) { }

    insertMemory = async (memory: ConversationMemoryDocument): Promise<void> => {
        await this.collection.insertOne(memory);
    };

    findRecentByUserId = async (userId: string, limit: number): Promise<ConversationMemoryDocument[]> =>
        this.collection
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();

    searchByVector = async (userId: string, queryVector: number[], limit: number, indexName: string): Promise<ConversationMemoryDocument[]> => {
        if (queryVector.length === 0) {
            return [];
        }
        try {
            const docs = await this.collection.aggregate([
                {
                    $vectorSearch: {
                        index: indexName,
                        path: "embedding",
                        queryVector,
                        numCandidates: Math.max(limit * 8, 32),
                        limit,
                        filter: { userId },
                    },
                },
            ]).toArray();
            return docs as ConversationMemoryDocument[];
        } catch {
            return [];
        }
    };
}
