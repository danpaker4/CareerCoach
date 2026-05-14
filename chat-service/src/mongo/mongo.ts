import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { Conversation } from "../routes/chat/conversation/conversation.model";
import type { UserCareerProfileDocument } from "../routes/career-profile/career-profile.model";
import type { ConversationMemoryDocument } from "../routes/chat/memory/conversation-memory.model";
import type { CareerDirectionExample } from "../routes/chat/knowledge/career-knowledge.types";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private conversationsCollection: Collection<Conversation> | null = null;
    private careerProfilesCollection: Collection<UserCareerProfileDocument> | null = null;
    private conversationMemoriesCollection: Collection<ConversationMemoryDocument> | null = null;
    private careerDirectionExamplesCollection: Collection<CareerDirectionExample> | null = null;

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
            this.conversationMemoriesCollection = this.db.collection<ConversationMemoryDocument>("conversationMemories");
            this.careerDirectionExamplesCollection = this.db.collection<CareerDirectionExample>("careerDirectionExamples");
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
        this.conversationMemoriesCollection = null;
        this.careerDirectionExamplesCollection = null;
        console.log('MongoDb Connection Closed');
    };

    private ensureIndexes = async (): Promise<void> => {
        if (!this.conversationsCollection || !this.careerProfilesCollection || !this.conversationMemoriesCollection || !this.careerDirectionExamplesCollection) {
            return;
        }
        await this.conversationsCollection.createIndex({ userId: 1, updatedAt: -1 });
        await this.careerProfilesCollection.createIndex({ userId: 1 }, { unique: true });
        await this.conversationMemoriesCollection.createIndex({ userId: 1, createdAt: -1 });
        await this.careerDirectionExamplesCollection.createIndex({ directionName: 1 });

        await Promise.all([
            this.createVectorSearchIndex(this.careerProfilesCollection.collectionName, "profileSummaryEmbedding", process.env.CAREER_PROFILE_VECTOR_INDEX_NAME || "career_profile_vector_index"),
            this.createVectorSearchIndex(this.conversationMemoriesCollection.collectionName, "embedding", process.env.CONVERSATION_MEMORY_VECTOR_INDEX_NAME || "conversation_memory_vector_index"),
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

    get conversationMemories(): Collection<ConversationMemoryDocument> {
        if (!this.conversationMemoriesCollection) {
            throw new Error("Conversation memories collection is not initialized");
        }
        return this.conversationMemoriesCollection;
    }

    get careerDirectionExamples(): Collection<CareerDirectionExample> {
        if (!this.careerDirectionExamplesCollection) {
            throw new Error("Career direction examples collection is not initialized");
        }
        return this.careerDirectionExamplesCollection;
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};