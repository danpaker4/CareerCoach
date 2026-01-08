import type { Service } from "./types/service";
import type { ServerConfig } from "./types/config";
import type { TypedFastify } from "./types/fastify";
import { createFastifyInstance } from "./utils/fastify";
import { Logs, toError } from "./utils/logger";
import { usersRouter } from "./routes/users/users.router";
import { pipelineRouter } from "./routes/MyPipline/pipeline.router";
import { MongoClient } from "./mongo/mongo";

export type { ServerConfig };

export class Server implements Service {
    readonly app: TypedFastify;
    private config: ServerConfig;
    readonly DBClient: MongoClient;

    constructor(config: ServerConfig) {
        this.config = config;
        this.app = createFastifyInstance();
        this.DBClient = new MongoClient(this.config.mongoConfig);
    }

    start = async (): Promise<void> => {
        try {
            await this.DBClient.start();
            this.app.register(usersRouter(this.DBClient.users));
            this.app.register(pipelineRouter(this.DBClient.pipelines));
            const address = await this.app.listen({
                port: this.config.port,
                host: this.config.host || "0.0.0.0",
            });
            Logs.logInfo(`Server listening on ${address}`, {});
        } catch (e) {
            Logs.logError("Server failed to run", toError(e), {});
            process.exit(1);
        }
    };

    stop = async (): Promise<void> => {
        await this.app.close();
    };
}
