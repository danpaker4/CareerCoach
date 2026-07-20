import "./observability/register";
import dotenv from "dotenv";
import { buildApp } from "./app";
import { connectMongo, disconnectMongo } from "./models/evaluation-case.model";
import { ServerEnvSchema } from "./server.types";

const start = async (): Promise<void> => {
    dotenv.config();
    const env = ServerEnvSchema.parse(process.env);

    try {
        console.log("🔄 Starting Evaluation Service...");
        await connectMongo(env.MONGO_CONNECTION_STRING);
        console.log("MongoDB connected");

        const app = await buildApp({
            chatServiceBaseUrl: env.CHAT_SERVICE_BASE_URL.replace(/\/$/, ""),
            evaluationUserId: env.EVALUATION_USER_ID,
            internalServiceApiKey: env.INTERNAL_SERVICE_API_KEY,
        });

        const address = await app.listen({
            port: env.PORT,
            host: env.HOST,
        });

        console.log(`🚀 Evaluation Service running on ${address}`);

        const shutdown = async (): Promise<void> => {
            await app.close();
            await disconnectMongo();
            process.exit(0);
        };

        process.on("SIGINT", () => {
            void shutdown();
        });
        process.on("SIGTERM", () => {
            void shutdown();
        });
    } catch (error) {
        console.error("🔥 Evaluation Service failed to start:", error);
        process.exit(1);
    }
};

void start();
