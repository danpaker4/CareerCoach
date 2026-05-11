import type { EmbeddingPort } from "../../../ai/ports/embedding.types";
import type { Conversation } from "../conversation/conversation.model";
import type { CareerProfileSignalUpdate, CareerSignal } from "../career-profile/career-profile.types";
import { ConversationMemoryRepository } from "./conversation-memory.repository";
import type { ConversationMemory, ConversationMemoryType } from "./conversation-memory.types";

const toMemoryType = (bucket: keyof CareerProfileSignalUpdate): ConversationMemoryType => {
    if (bucket === "technologies" || bucket === "strengths" || bucket === "weakSignals") {
        return "skill";
    }
    if (bucket === "dislikes" || bucket === "dislikedDomains" || bucket === "dislikedRoles") {
        return "dislike";
    }
    if (bucket === "longTermGoals" || bucket === "shortTermGoals") {
        return "goal";
    }
    if (bucket === "workStyle" || bucket === "personalitySignals") {
        return "work_style";
    }
    if (bucket === "motivations" || bucket === "interests" || bucket === "preferredDomains" || bucket === "preferredRoles") {
        return "preference";
    }
    return "achievement";
};

export class ConversationMemoryService {
    constructor(
        private readonly repository: ConversationMemoryRepository,
        private readonly embedding: EmbeddingPort,
        private readonly memoryVectorIndexName: string
    ) { }

    saveSignalsAsMemories = async (
        userId: string,
        conversation: Conversation,
        signalUpdates: CareerProfileSignalUpdate
    ): Promise<void> => {
        const latestMessage = conversation.messages.at(-1);
        if (!latestMessage) {
            return;
        }

        const entries = Object.entries(signalUpdates) as Array<[keyof CareerProfileSignalUpdate, CareerSignal[] | string | number | null | undefined]>;
        const memorySignalEntries = entries.filter(([, value]) => Array.isArray(value)) as Array<[keyof CareerProfileSignalUpdate, CareerSignal[]]>;
        for (const [bucket, signals] of memorySignalEntries) {
            const memoryType = toMemoryType(bucket);
            for (const signal of signals) {
                const embedding = await this.embedding.embedUserMemory(signal.value).catch(() => []);
                const memory: ConversationMemory = {
                    userId,
                    conversationId: conversation.userId,
                    type: memoryType,
                    text: signal.value,
                    confidence: signal.confidence,
                    evidenceMessageId: latestMessage.timestamp.toISOString(),
                    embedding,
                    createdAt: new Date(),
                };
                await this.repository.insertMemory(memory);
            }
        }
    };

    getRelevantMemories = async (userId: string, message: string, limit = 6): Promise<ConversationMemory[]> => {
        const vector = await this.embedding.embedUserMemory(message).catch(() => []);
        const semanticMatches = await this.repository.searchByVector(userId, vector, limit, this.memoryVectorIndexName);
        if (semanticMatches.length > 0) {
            return semanticMatches;
        }
        return this.repository.findRecentByUserId(userId, limit);
    };
}
