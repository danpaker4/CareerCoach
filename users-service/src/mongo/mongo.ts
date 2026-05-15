import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { UserDocument } from "../routes/users/user.model";
import type { LlmTokenUsageDocument } from "../routes/admin/admin-token-usage.model";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private usersCollection: Collection<UserDocument> | null = null;
    private llmTokenUsageCollection: Collection<LlmTokenUsageDocument> | null = null;

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
            
            this.usersCollection = this.db.collection<UserDocument>("users");
            this.llmTokenUsageCollection = this.db.collection<LlmTokenUsageDocument>("llmTokenUsage");
            await this.llmTokenUsageCollection.createIndex({ createdAt: -1, provider: 1, model: 1 });
            
            console.log('MongoDb Connection Succeeded');
        } catch (err) {
            console.error('Failed To Connect MongoDb', err);
            throw err;
        }
    };

    stop = async (): Promise<void> => {
        await this.mongoClient.close();
        this.db = null;
        this.usersCollection = null;
        this.llmTokenUsageCollection = null;
        console.log('MongoDb Connection Closed');
    };

    get users(): Collection<UserDocument> {
        if (!this.usersCollection) {
            throw new Error("Users collection is not initialized");
        }
        return this.usersCollection;
    }

    get llmTokenUsage(): Collection<LlmTokenUsageDocument> {
        if (!this.llmTokenUsageCollection) {
            throw new Error("LLM token usage collection is not initialized");
        }
        return this.llmTokenUsageCollection;
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};
