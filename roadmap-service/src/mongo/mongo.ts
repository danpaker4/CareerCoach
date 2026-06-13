import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import type { Service } from "../types/service";
import type { CareerDirectionExample } from "../routes/knowledge/career-direction.types";
import type { LlmTokenUsageDocument } from "../ai/token-usage.types";

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private careerDirectionExamplesCollection: Collection<CareerDirectionExample> | null = null;
    private llmTokenUsageCollection: Collection<LlmTokenUsageDocument> | null = null;

    constructor(config: DatabaseConfig) {
        const dbKeyPathOption = config.mongoKeyPath && config.mongoKeyPath !== "none"
            ? { tlsCertificateKeyFile: config.mongoKeyPath }
            : {};
        this.connectionOptions = { ...dbKeyPathOption };
        this.mongoClient = new MongoDbClient(config.mongoConnectionString, this.connectionOptions);
    }

    start = async (): Promise<void> => {
        await this.mongoClient.connect();
        this.db = this.mongoClient.db();
        this.careerDirectionExamplesCollection = this.db.collection<CareerDirectionExample>("careerDirectionExamples");
        this.llmTokenUsageCollection = this.db.collection<LlmTokenUsageDocument>("llmTokenUsage");
        await this.ensureIndexes();
        console.log("MongoDb Connection Succeeded");
    };

    stop = async (): Promise<void> => {
        await this.mongoClient.close();
        this.db = null;
        this.careerDirectionExamplesCollection = null;
        this.llmTokenUsageCollection = null;
        console.log("MongoDb Connection Closed");
    };

    private ensureIndexes = async (): Promise<void> => {
        if (!this.careerDirectionExamplesCollection || !this.llmTokenUsageCollection) {
            return;
        }

        await this.careerDirectionExamplesCollection.createIndex({ directionName: 1 });
        await this.llmTokenUsageCollection.createIndex({ createdAt: -1, provider: 1, model: 1 });
        await this.llmTokenUsageCollection.createIndex({ userId: 1, createdAt: -1 });
        await this.llmTokenUsageCollection.createIndex({ sourceService: 1, createdAt: -1 });

        await this.createVectorSearchIndex(
            this.careerDirectionExamplesCollection.collectionName,
            "embedding",
            process.env.CAREER_DIRECTION_VECTOR_INDEX_NAME || "career_direction_vector_index"
        );
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
}
