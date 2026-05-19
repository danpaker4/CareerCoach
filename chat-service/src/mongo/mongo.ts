import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { Conversation } from "../routes/conversation/conversation.model";
import type { UserCareerProfileDocument } from "../routes/career-profile/career-profile.model";
import type { CareerDirectionExample } from "../routes/chat/knowledge/career-knowledge.types";
import type { LlmTokenUsageDocument } from "../ai/token-usage.types";
import type { BenchmarkRunDocument } from "../routes/benchmark/benchmark.types";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private conversationsCollection: Collection<Conversation> | null = null;
    private careerProfilesCollection: Collection<UserCareerProfileDocument> | null = null;
    private careerDirectionExamplesCollection: Collection<CareerDirectionExample> | null = null;
    private llmTokenUsageCollection: Collection<LlmTokenUsageDocument> | null = null;
    private benchmarkRunsCollection: Collection<BenchmarkRunDocument> | null = null;

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
        console.log('MongoDb Connection Closed');
    };

    private ensureIndexes = async (): Promise<void> => {
        if (!this.conversationsCollection || !this.careerProfilesCollection || !this.careerDirectionExamplesCollection || !this.llmTokenUsageCollection || !this.benchmarkRunsCollection) {
            return;
        }
        await this.conversationsCollection.createIndex({ userId: 1, updatedAt: -1 });
        await this.careerProfilesCollection.createIndex({ userId: 1 }, { unique: true });
        await this.careerDirectionExamplesCollection.createIndex({ directionName: 1 });
        await this.llmTokenUsageCollection.createIndex({ createdAt: -1, provider: 1, model: 1 });
        await this.benchmarkRunsCollection.createIndex({ createdAt: -1, status: 1 });

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
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};
