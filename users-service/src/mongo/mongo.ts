import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { User } from "../routes/users/user.model";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private usersCollection: Collection<User> | null = null;

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
            
            this.usersCollection = this.db.collection<User>("users");
            
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
        console.log('MongoDb Connection Closed');
    };

    get users(): Collection<User> {
        if (!this.usersCollection) {
            throw new Error("Users collection is not initialized");
        }
        return this.usersCollection;
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};