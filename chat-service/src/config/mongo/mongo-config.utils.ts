import type { MongoConfigEnv } from "./mongo-config.schema";
import type { MongoConfig } from "./mongo-config.types";

export const createMongoConfig = (env: MongoConfigEnv): MongoConfig => ({
    mongoConnectionString: env.MONGO_CONNECTION_STRING,
    mongoKeyPath: env.MONGO_KEY_PATH,
});
