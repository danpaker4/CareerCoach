import "../../../observability/register";
import dotenv from "dotenv";
import { createConfigFromEnv } from "../../../config";
import { MongoClient } from "../../../mongo/mongo";
import { ChatQueueClient } from "../../stage-0-gateway/queue/chat-queue.client";
import { ChatQueueWorker } from "../../stage-0-gateway/queue/chat-queue.worker";
import { ChatRateLimitDal } from "../../stage-0-gateway/rate-limit/chat-rate-limit.dal";
import { ChatRateLimitService } from "../../stage-0-gateway/rate-limit/chat-rate-limit.service";
import { ChatRequestDal } from "../async-jobs/chat-request.dal";
import { createChatServiceDependencies } from "../factory/chat-service.factory";

dotenv.config();

const config = createConfigFromEnv(process.env);
const dbClient = new MongoClient(config.mongoConfig);
const queueClient = new ChatQueueClient(config.queueConfig);

const startWorker = async (): Promise<void> => {
    await dbClient.start();
    const rateLimitDal = new ChatRateLimitDal(
        dbClient.chatRateLimitConfig,
        dbClient.chatRateLimitConfigHistory,
        dbClient.chatRateLimitCounters,
        dbClient.chatActiveRequests,
        dbClient.llmTokenUsage
    );
    const rateLimitService = new ChatRateLimitService(rateLimitDal);
    const requestDal = new ChatRequestDal(dbClient.chatRequests, dbClient.chatSocketTickets);
    const { chatFlow } = createChatServiceDependencies(dbClient, config.chatConfig);
    const worker = new ChatQueueWorker(queueClient, requestDal, rateLimitService, chatFlow.sendMessage);

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
