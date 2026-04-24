import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { ChatSession } from "../routes/chat/chat.model"; 

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private chatsCollection: Collection<ChatSession> | null = null;

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
            
            this.chatsCollection = this.db.collection<ChatSession>("chats");
            
            console.log('MongoDb Connection Succeeded');
        } catch (err) {
            console.error('Failed To Connect MongoDb', err);
            throw err;
        }
    };

    stop = async (): Promise<void> => {
        await this.mongoClient.close();
        this.db = null;
        this.chatsCollection = null;
        console.log('MongoDb Connection Closed');
    };

    get chats(): Collection<ChatSession> {
        if (!this.chatsCollection) {
            throw new Error("Chats collection is not initialized");
        }
        return this.chatsCollection;
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};