import dotenv from "dotenv";
import { createConfigFromEnv } from "./config";
import { MongoClient } from "./mongo/mongo";
import { ChatQueueClient } from "./routes/chat/queue/chat-queue.client";
import { ChatQueueWorker } from "./routes/chat/queue/chat-queue.worker";
import { ChatRateLimitRepository } from "./routes/chat/rate-limit/chat-rate-limit.repository";
import { ChatRateLimitService } from "./routes/chat/rate-limit/chat-rate-limit.service";
import { ChatRequestRepository } from "./routes/chat/request/chat-request.repository";
import { createChatServiceDependencies } from "./routes/chat/chat-service.factory";

dotenv.config();

const config = createConfigFromEnv(process.env);
const dbClient = new MongoClient(config.mongoConfig);
const queueClient = new ChatQueueClient(config.queueConfig);

const startWorker = async (): Promise<void> => {
    await dbClient.start();
    const rateLimitRepository = new ChatRateLimitRepository(
        dbClient.chatRateLimitConfig,
        dbClient.chatRateLimitConfigHistory,
        dbClient.chatRateLimitCounters,
        dbClient.chatActiveRequests,
        dbClient.llmTokenUsage
    );
    const rateLimitService = new ChatRateLimitService(rateLimitRepository);
    const requestRepository = new ChatRequestRepository(dbClient.chatRequests, dbClient.chatSocketTickets);
    const { chatService } = createChatServiceDependencies(dbClient, config.chatConfig);
    const worker = new ChatQueueWorker(queueClient, requestRepository, rateLimitService, chatService);

    await worker.start();
    console.log("Chat queue worker started");

    const shutdown = async (): Promise<void> => {
        await worker.stop();
        await dbClient.stop();
        process.exit(0);
    };

    process.on("SIGINT", () => {
        void shutdown();
    });
    process.on("SIGTERM", () => {
        void shutdown();
    });
};

startWorker().catch((error: unknown) => {
    console.error("Chat queue worker failed to start", error);
    process.exit(1);
});

