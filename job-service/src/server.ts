import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 

import { MongoClient } from "./mongo/mongo"; 
import { pipelineRouter } from "./routes/MyPipline/pipeline.router";
import { pipelineJobRouter } from "./routes/jobsInPipeline/pipeline-job.router";
import { skillMatcherRouter } from "./routes/skillMatcher/skill-matcher.router";
import { careerRoadMapRouter } from "./routes/careerRoadMap/career-roadmap.router";
import { jobSearchRouter } from "./routes/jobSearch/job-search.router";
import { startJobPollerSchedule } from "./poller/job-poller";
import { jobsRouter } from "./routes/jobs/jobs.router";
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

            await this.app.register(pipelineRouter(this.DBClient.pipelines));
            await this.app.register(pipelineJobRouter(this.DBClient.pipelineJobs));
            await this.app.register(skillMatcherRouter(this.DBClient.skillMatchers));
            await this.app.register(careerRoadMapRouter(this.DBClient.careerRoadMaps));
            await this.app.register(jobSearchRouter(this.DBClient.jobs));
            await this.app.register(jobsRouter(this.DBClient.jobs, this.DBClient.skillMatchers));

            const address = await this.app.listen({
                port: this.config.port,
                host: process.env.HOST || "127.0.0.1"
            });
            startJobPollerSchedule(this.DBClient.jobs);
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