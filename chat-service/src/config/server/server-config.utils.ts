import type { ServerConfigEnv } from "./server-config.schema";
import type { ServerHostConfig } from "./server-config.types";

export const createServerHostConfig = (env: ServerConfigEnv): ServerHostConfig => ({
    port: env.PORT,
    host: env.HOST,
});
