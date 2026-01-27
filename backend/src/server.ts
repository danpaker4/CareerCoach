import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 

import { MongoClient } from "./mongo/mongo"; 
import { authRouter } from "./routes/users/auth.router";
import { usersRouter } from "./routes/users/users.router";
import { pipelineRouter } from "./routes/MyPipline/pipeline.router";
import { pipelineJobRouter } from "./routes/jobsInPipeline/pipeline-job.router";
import { skillMatcherRouter } from "./routes/skillMatcher/skill-matcher.router";
import { careerRoadMapRouter } from "./routes/careerRoadMap/career-roadmap.router";
import { chatRouter } from "./routes/chat/chat.router";

dotenv.config();

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

            await this.app.register(authRouter(this.DBClient.users));
            await this.app.register(usersRouter(this.DBClient.users));
            await this.app.register(pipelineRouter(this.DBClient.pipelines));
            await this.app.register(pipelineJobRouter(this.DBClient.pipelineJobs));
            await this.app.register(skillMatcherRouter(this.DBClient.skillMatchers));
            await this.app.register(careerRoadMapRouter(this.DBClient.careerRoadMaps));
            
            await this.app.register(chatRouter(this.DBClient.chats, this.DBClient.users));

            const address = await this.app.listen({ 
                port: this.config.port, 
                host: "0.0.0.0" 
            });
            
            console.log(`🚀 Server running on ${address}`);

        } catch (err) {
            console.error("🔥 Server failed to start:", err);
            this.app.log.error(err);
            process.exit(1);
        }
    }
}

const config: ServerConfig = {
    port: parseInt(process.env.PORT || "3000"),
    mongoConfig: {
        mongoConnectionString: process.env.MONGO_CONNECTION_STRING || "mongodb://127.0.0.1:27017/careerCoachDB",
        mongoKeyPath: process.env.MONGO_KEY_PATH
    }
};

const server = new Server(config);
server.start();