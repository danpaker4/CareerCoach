import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 
import { MongoClient } from "./mongo/mongo"; 
import { authRouter } from "./routes/auth/auth.router";
import { usersRouter } from "./routes/users/users.router";
import { githubRouter } from "./routes/github/github.router";
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
            await this.app.register(cookie);
            await this.app.register(multipart, {
                limits: {
                    fileSize: 5 * 1024 * 1024,
                    files: 1,
                },
            });

            await this.app.register(authRouter(this.DBClient.users));
            await this.app.register(usersRouter(this.DBClient.users));
            await this.app.register(githubRouter());

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
    };

    stop = async (): Promise<void> => {
        await this.app.close();
        await this.DBClient.stop();
    };
}