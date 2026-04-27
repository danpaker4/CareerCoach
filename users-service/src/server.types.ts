import { z } from "zod";

export const ServerEnvSchema = z.object({
    PORT: z.coerce.number().int().nonnegative().default(3001),
    HOST: z.string().min(1).default("127.0.0.1"),
    MONGO_CONNECTION_STRING: z.string().min(1).default("mongodb://127.0.0.1:27017/careerCoachDB"),
    MONGO_KEY_PATH: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export interface ServerConfig {
    port: number;
    host: string;
    mongoConfig: {
        mongoConnectionString: string;
        mongoKeyPath?: string;
    };
}
