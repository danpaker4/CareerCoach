import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 
import { MongoClient } from "./mongo/mongo"; 
import { chatRouter } from "./chat-flow/api/routers/chat.router";
import { conversationRouter } from "./routes/conversation/conversation.router";
import { benchmarkRouter } from "./routes/benchmark/benchmark.router";
import { internalRouter } from "./routes/internal-api/internal.router";
import { ChatRateLimitRepository } from "./chat-flow/stage-0-gateway/rate-limit/chat-rate-limit.repository";
import { ChatRateLimitService } from "./chat-flow/stage-0-gateway/rate-limit/chat-rate-limit.service";
import { chatRateLimitRouter } from "./chat-flow/stage-0-gateway/rate-limit/chat-rate-limit.router";
import type { ServerConfig } from "./server.types";
import { ChatQueueClient } from "./chat-flow/stage-0-gateway/queue/chat-queue.client";
import { ChatRequestRealtimeService } from "./chat-flow/api/async-jobs/chat-request-realtime.service";

export class Server {
    readonly app: FastifyInstance;
    private readonly config: ServerConfig;
    readonly DBClient: MongoClient;
    private queueClient: ChatQueueClient | null = null;

    constructor(config: ServerConfig) {
        this.config = config;
        this.app = Fastify({ logger: true });
        this.DBClient = new MongoClient(this.config.mongoConfig);
        
        this.app.setValidatorCompiler(validatorCompiler);
        this.app.setSerializerCompiler(serializerCompiler);
    }

    start = async (): Promise<void> => {
        try {
            console.log("🔄 Starting Server...");
            await this.DBClient.start();
            console.log(" MongoDB Connected");

            const queueClient = new ChatQueueClient(this.config.queueConfig);
            await queueClient.start();
            this.queueClient = queueClient;
            console.log(" RabbitMQ Connected");

            await this.app.register(cors, {
                origin: true,
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: ['Content-Type', 'Authorization']
            });
            await this.app.register(websocket);

            const rateLimitRepository = new ChatRateLimitRepository(
                this.DBClient.chatRateLimitConfig,
                this.DBClient.chatRateLimitConfigHistory,
                this.DBClient.chatRateLimitCounters,
                this.DBClient.chatActiveRequests,
                this.DBClient.llmTokenUsage
            );
            const rateLimitService = new ChatRateLimitService(rateLimitRepository);
            const realtimeService = new ChatRequestRealtimeService();
            await queueClient.consumeEvents(async (event) => {
                realtimeService.broadcast(event);
            });

            await this.app.register(conversationRouter(this.DBClient, this.config.chatConfig));
            await this.app.register(chatRouter(this.DBClient, this.config.chatConfig, rateLimitService, queueClient, realtimeService));
            await this.app.register(chatRateLimitRouter(rateLimitService, this.config.chatConfig));
            await this.app.register(benchmarkRouter(this.DBClient, this.config.chatConfig));
            await this.app.register(internalRouter(this.DBClient, this.config.chatConfig));

            const address = await this.app.listen({ 
                port: this.config.port, 
                host: this.config.host
            });
            
            console.log(`🚀 Server running on ${address}`);

        } catch (err) {
            console.error("🔥 Server failed to start:", err);
            this.app.log.error(err);
            process.exit(1);
        }
    };

    stop = async (): Promise<void> => {
        await this.app.close();
        await this.queueClient?.stop();
        this.queueClient = null;
        await this.DBClient.stop();
    };
}
