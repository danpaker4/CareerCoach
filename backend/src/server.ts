import type { Service } from "./types/service";
import type { ServerConfig } from "./types/config";
import type { TypedFastify } from "./types/fastify";
import { createFastifyInstance } from "./utils/fastify";
import { Logs, toError } from "./utils/logger";
import { usersRouter } from "./routes/users/users.router";

export type { ServerConfig };

export class Server implements Service {
    readonly app: TypedFastify;
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        this.app = createFastifyInstance();
    }

    start = async (): Promise<void> => {
        try {
            this.app.register(usersRouter());
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
