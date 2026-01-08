import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { User } from "../routes/users/user.model";
import type { Pipeline } from "../routes/MyPipline/pipeline.model";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db!: Db;
    public users!: Collection<User>;
    public pipelines!: Collection<Pipeline>;

    constructor(
        config: DatabaseConfig
    ) {
        const dbKeyPathOption = config.mongoKeyPath ? { tlsCertificateKeyFile: config.mongoKeyPath } : {};

        this.connectionOptions = {
            ...dbKeyPathOption
        };
        this.mongoClient = new MongoDbClient(config.mongoConnectionString, this.connectionOptions);
    }

    start = async (): Promise<void> => {
        try {
            await this.mongoClient.connect();
            this.db = this.mongoClient.db();
            
            this.users = this.db.collection<User>("users");
            this.pipelines = this.db.collection<Pipeline>("pipelines");
            console.log('MongoDb Connection Succeeded');
        } catch (err) {
            console.error('Failed To Connect MongoDb', err);
            throw err;
        }
    };

    stop = async (): Promise<void> => {
        if (this.mongoClient) {
            await this.mongoClient.close();
            console.log('MongoDb Connection Closed');
        }
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath: string | undefined;
};