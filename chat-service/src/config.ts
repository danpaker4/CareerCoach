import { z } from "zod";
import type { ServerConfig } from "./server.types";

const envString = (name: string) => z.string().min(1, `${name} is required`);

const EnvSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3002),
    HOST: envString("HOST"),
    MONGO_CONNECTION_STRING: envString("MONGO_CONNECTION_STRING"),
    MONGO_KEY_PATH: z.string().optional(),
    USERS_SERVICE_BASE_URL: envString("USERS_SERVICE_BASE_URL"),
    JOB_SERVICE_BASE_URL: envString("JOB_SERVICE_BASE_URL"),
    GEMINI_API_KEY: envString("GEMINI_API_KEY"),
});

export const createConfigFromEnv = (env: NodeJS.ProcessEnv): ServerConfig => {
    const parsed = EnvSchema.parse(env);
    return {
        port: parsed.PORT,
        host: parsed.HOST,
        mongoConfig: {
            mongoConnectionString: parsed.MONGO_CONNECTION_STRING,
            mongoKeyPath: parsed.MONGO_KEY_PATH,
        },
        chatConfig: {
            usersServiceBaseUrl: parsed.USERS_SERVICE_BASE_URL,
            jobServiceBaseUrl: parsed.JOB_SERVICE_BASE_URL,
            geminiApiKey: parsed.GEMINI_API_KEY,
        },
    };
};
