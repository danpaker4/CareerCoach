import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 

import { MongoClient } from "./mongo/mongo"; 
import { chatRouter } from "./routes/chat/chat.router";

export interface ServerConfig {
    port: number;
    mongoConfig: {
        mongoConnectionString: string;
        mongoKeyPath?: string;
    };
}

export class Server {
    readonly app: FastifyInstance;
    private config: ServerConfig;
    readonly DBClient: MongoClient;

    constructor(config: ServerConfig) {
        this.config = config;
        this.app = Fastify({ logger: true });
        this.DBClient = new MongoClient(this.config.mongoConfig);
        
        this.app.setValidatorCompiler(validatorCompiler);
        this.app.setSerializerCompiler(serializerCompiler);
    }

    public async start() {
        try {
            console.log("🔄 Starting Server...");
            await this.DBClient.start();
            console.log(" MongoDB Connected");

            await this.app.register(cors, {
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: ['Content-Type', 'Authorization']
            });

            await this.app.register(chatRouter(this.DBClient.chats));

            const address = await this.app.listen({ 
                port: this.config.port, 
                host: process.env.HOST || "127.0.0.1" 
            });
            
            console.log(`🚀 Server running on ${address}`);

        } catch (err) {
            console.error("🔥 Server failed to start:", err);
            this.app.log.error(err);
            process.exit(1);
        }
    }
}