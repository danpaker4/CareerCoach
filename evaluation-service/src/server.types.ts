import { z } from "zod";

export const ServerEnvSchema = z.object({
    PORT: z.coerce.number().int().nonnegative().default(3004),
    HOST: z.string().min(1).default("127.0.0.1"),
    MONGO_CONNECTION_STRING: z.string().min(1).default("mongodb://127.0.0.1:27017/careerCoachDB"),
    CHAT_SERVICE_BASE_URL: z.string().min(1).default("http://127.0.0.1:3002"),
    EVALUATION_USER_ID: z.string().min(1).default("evaluation-runner-user"),
    INTERNAL_SERVICE_API_KEY: z.string().min(1).default("local-dev-internal-service-key"),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export type RunnerConfig = {
    chatServiceBaseUrl: string;
    evaluationUserId: string;
    internalServiceApiKey: string;
};
