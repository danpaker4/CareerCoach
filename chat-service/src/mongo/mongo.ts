import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { Conversation } from "../routes/conversation/conversation.model";
import type { UserCareerProfileDocument } from "../routes/career-profile/career-profile.model";
import type { CareerDirectionExample } from "../routes/chat/knowledge/career-knowledge.types";
import type { LlmTokenUsageDocument } from "../ai/token-usage.types";
import type { BenchmarkRunDocument } from "../routes/benchmark/benchmark.types";
import type {
    ChatActiveRequestDocument,
    ChatRateLimitConfigDocument,
    ChatRateLimitConfigHistoryDocument,
    ChatRateLimitCounterDocument,
} from "../routes/chat/rate-limit/chat-rate-limit.types";
import type { ChatRequestDocument, ChatSocketTicketDocument } from "../routes/chat/request/chat-request.types";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private conversationsCollection: Collection<Conversation> | null = null;
    private careerProfilesCollection: Collection<UserCareerProfileDocument> | null = null;
    private careerDirectionExamplesCollection: Collection<CareerDirectionExample> | null = null;
    private llmTokenUsageCollection: Collection<LlmTokenUsageDocument> | null = null;
    private benchmarkRunsCollection: Collection<BenchmarkRunDocument> | null = null;
    private chatRateLimitConfigCollection: Collection<ChatRateLimitConfigDocument> | null = null;
    private chatRateLimitConfigHistoryCollection: Collection<ChatRateLimitConfigHistoryDocument> | null = null;
    private chatRateLimitCountersCollection: Collection<ChatRateLimitCounterDocument> | null = null;
    private chatActiveRequestsCollection: Collection<ChatActiveRequestDocument> | null = null;
    private chatRequestsCollection: Collection<ChatRequestDocument> | null = null;
    private chatSocketTicketsCollection: Collection<ChatSocketTicketDocument> | null = null;

    constructor(config: DatabaseConfig) {
       const dbKeyPathOption = (config.mongoKeyPath && config.mongoKeyPath !== 'none') 
    ? { tlsCertificateKeyFile: config.mongoKeyPath } 
    : {};
        this.connectionOptions = { ...dbKeyPathOption };
        this.mongoClient = new MongoDbClient(config.mongoConnectionString, this.connectionOptions);
    }

    start = async (): Promise<void> => {
        try {
            await this.mongoClient.connect();
            this.db = this.mongoClient.db();
            
            this.conversationsCollection = this.db.collection<Conversation>("conversations");
            this.careerProfilesCollection = this.db.collection<UserCareerProfileDocument>("userCareerProfiles");
            this.careerDirectionExamplesCollection = this.db.collection<CareerDirectionExample>("careerDirectionExamples");
            this.llmTokenUsageCollection = this.db.collection<LlmTokenUsageDocument>("llmTokenUsage");
            this.benchmarkRunsCollection = this.db.collection<BenchmarkRunDocument>("llmBenchmarkRuns");
            this.chatRateLimitConfigCollection = this.db.collection<ChatRateLimitConfigDocument>("chatRateLimitConfig");
            this.chatRateLimitConfigHistoryCollection = this.db.collection<ChatRateLimitConfigHistoryDocument>("chatRateLimitConfigHistory");
            this.chatRateLimitCountersCollection = this.db.collection<ChatRateLimitCounterDocument>("chatRateLimitCounters");
            this.chatActiveRequestsCollection = this.db.collection<ChatActiveRequestDocument>("chatActiveRequests");
            this.chatRequestsCollection = this.db.collection<ChatRequestDocument>("chatRequests");
            this.chatSocketTicketsCollection = this.db.collection<ChatSocketTicketDocument>("chatSocketTickets");
            await this.ensureIndexes();
            
            console.log('MongoDb Connection Succeeded');
        } catch (err) {
            console.error('Failed To Connect MongoDb', err);
            throw err;
        }
    };

    stop = async (): Promise<void> => {
        await this.mongoClient.close();
        this.db = null;
        this.conversationsCollection = null;
        this.careerProfilesCollection = null;
        this.careerDirectionExamplesCollection = null;
        this.llmTokenUsageCollection = null;
        this.benchmarkRunsCollection = null;
        this.chatRateLimitConfigCollection = null;
        this.chatRateLimitConfigHistoryCollection = null;
        this.chatRateLimitCountersCollection = null;
        this.chatActiveRequestsCollection = null;
        this.chatRequestsCollection = null;
        this.chatSocketTicketsCollection = null;
        console.log('MongoDb Connection Closed');
    };

    private ensureIndexes = async (): Promise<void> => {
        if (
            !this.conversationsCollection ||
            !this.careerProfilesCollection ||
            !this.careerDirectionExamplesCollection ||
            !this.llmTokenUsageCollection ||
            !this.benchmarkRunsCollection ||
            !this.chatRateLimitConfigCollection ||
            !this.chatRateLimitConfigHistoryCollection ||
            !this.chatRateLimitCountersCollection ||
            !this.chatActiveRequestsCollection ||
            !this.chatRequestsCollection ||
            !this.chatSocketTicketsCollection
        ) {
            return;
        }
        await this.conversationsCollection.createIndex({ userId: 1, updatedAt: -1 });
        await this.careerProfilesCollection.createIndex({ userId: 1 }, { unique: true });
        await this.careerDirectionExamplesCollection.createIndex({ directionName: 1 });
        await this.llmTokenUsageCollection.createIndex({ createdAt: -1, provider: 1, model: 1 });
        await this.llmTokenUsageCollection.createIndex({ userId: 1, createdAt: -1 });
        await this.llmTokenUsageCollection.createIndex({ sourceService: 1, createdAt: -1 });
        await this.benchmarkRunsCollection.createIndex({ createdAt: -1, status: 1 });
        await this.chatRateLimitConfigCollection.createIndex({ updatedAt: -1 });
        await this.chatRateLimitConfigHistoryCollection.createIndex({ updatedAt: -1 });
        await this.chatRateLimitCountersCollection.createIndex({ key: 1 }, { unique: true });
        await this.chatRateLimitCountersCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await this.chatActiveRequestsCollection.createIndex({ key: 1 }, { unique: true });
        await this.chatActiveRequestsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await this.chatRequestsCollection.createIndex({ requestId: 1 }, { unique: true });
        await this.chatRequestsCollection.createIndex({ userId: 1, status: 1, updatedAt: -1 });
        await this.chatRequestsCollection.createIndex({ status: 1, updatedAt: -1 });
        await this.chatSocketTicketsCollection.createIndex({ ticketId: 1 }, { unique: true });
        await this.chatSocketTicketsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

        await Promise.all([
            this.createVectorSearchIndex(this.careerProfilesCollection.collectionName, "profileSummaryEmbedding", process.env.CAREER_PROFILE_VECTOR_INDEX_NAME || "career_profile_vector_index"),
            this.createVectorSearchIndex(this.careerDirectionExamplesCollection.collectionName, "embedding", process.env.CAREER_DIRECTION_VECTOR_INDEX_NAME || "career_direction_vector_index"),
        ]);
    };

    private createVectorSearchIndex = async (collectionName: string, path: string, indexName: string): Promise<void> => {
        if (!this.db) {
            return;
        }
        try {
            await this.db.command({
                createSearchIndexes: collectionName,
                indexes: [
                    {
                        name: indexName,
                        type: "vectorSearch",
                        definition: {
                            fields: [
                                {
                                    type: "vector",
                                    numDimensions: 768,
                                    path,
                                    similarity: "cosine",
                                },
                            ],
                        },
                    },
                ],
            });
        } catch {
            // local Mongo deployments may not support Search index creation
        }
    };

    get conversations(): Collection<Conversation> {
        if (!this.conversationsCollection) {
            throw new Error("Conversations collection is not initialized");
        }
        return this.conversationsCollection;
    }

    get careerProfiles(): Collection<UserCareerProfileDocument> {
        if (!this.careerProfilesCollection) {
            throw new Error("Career profiles collection is not initialized");
        }
        return this.careerProfilesCollection;
    }

    get careerDirectionExamples(): Collection<CareerDirectionExample> {
        if (!this.careerDirectionExamplesCollection) {
            throw new Error("Career direction examples collection is not initialized");
        }
        return this.careerDirectionExamplesCollection;
    }

    get llmTokenUsage(): Collection<LlmTokenUsageDocument> {
        if (!this.llmTokenUsageCollection) {
            throw new Error("LLM token usage collection is not initialized");
        }
        return this.llmTokenUsageCollection;
    }

    get benchmarkRuns(): Collection<BenchmarkRunDocument> {
        if (!this.benchmarkRunsCollection) {
            throw new Error("Benchmark runs collection is not initialized");
        }
        return this.benchmarkRunsCollection;
    }

    get chatRateLimitConfig(): Collection<ChatRateLimitConfigDocument> {
        if (!this.chatRateLimitConfigCollection) {
            throw new Error("Chat rate-limit config collection is not initialized");
        }
        return this.chatRateLimitConfigCollection;
    }

    get chatRateLimitConfigHistory(): Collection<ChatRateLimitConfigHistoryDocument> {
        if (!this.chatRateLimitConfigHistoryCollection) {
            throw new Error("Chat rate-limit config history collection is not initialized");
        }
        return this.chatRateLimitConfigHistoryCollection;
    }

    get chatRateLimitCounters(): Collection<ChatRateLimitCounterDocument> {
        if (!this.chatRateLimitCountersCollection) {
            throw new Error("Chat rate-limit counters collection is not initialized");
        }
        return this.chatRateLimitCountersCollection;
    }

    get chatActiveRequests(): Collection<ChatActiveRequestDocument> {
        if (!this.chatActiveRequestsCollection) {
            throw new Error("Chat active requests collection is not initialized");
        }
        return this.chatActiveRequestsCollection;
    }

    get chatRequests(): Collection<ChatRequestDocument> {
        if (!this.chatRequestsCollection) {
            throw new Error("Chat requests collection is not initialized");
        }
        return this.chatRequestsCollection;
    }

    get chatSocketTickets(): Collection<ChatSocketTicketDocument> {
        if (!this.chatSocketTicketsCollection) {
            throw new Error("Chat socket tickets collection is not initialized");
        }
        return this.chatSocketTicketsCollection;
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};
