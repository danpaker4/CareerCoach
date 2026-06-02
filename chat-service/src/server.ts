import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 

import { MongoClient } from "./mongo/mongo"; 
import { chatRouter } from "./routes/chat/chat.router";
import { conversationRouter } from "./routes/conversation/conversation.router";
import { roadmapGenerationRouter } from "./routes/roadmap-generation/roadmap-generation.router";
import { benchmarkRouter } from "./routes/benchmark/benchmark.router";
import type { ServerConfig } from "./server.types";

export type { ServerConfig } from "./server.types";

export class Server {
    readonly app: FastifyInstance;
    private readonly config: ServerConfig;
    readonly DBClient: MongoClient;

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

            await this.app.register(cors, {
                origin: true,
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: ['Content-Type', 'Authorization']
            });

            await this.app.register(conversationRouter(this.DBClient, this.config.chatConfig));
            await this.app.register(chatRouter(this.DBClient, this.config.chatConfig));
            await this.app.register(roadmapGenerationRouter(this.DBClient, this.config.chatConfig));
            await this.app.register(benchmarkRouter(this.DBClient, this.config.chatConfig));

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
        await this.DBClient.stop();
    };
}
