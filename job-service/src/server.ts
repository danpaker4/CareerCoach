import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"; 

import { MongoClient } from "./mongo/mongo";
import { UserEmbeddingCache } from "./cache/user-embedding.cache";
import { startUserChangeStream } from "./cache/user-change-stream";
import { pipelineRouter } from "./routes/MyPipline/pipeline.router";
import { pipelineJobRouter } from "./routes/jobsInPipeline/pipeline-job.router";
import { skillMatcherRouter } from "./routes/skillMatcher/skill-matcher.router";
import { careerRoadMapRouter } from "./routes/careerRoadMap/career-roadmap.router";
import { jobSearchRouter } from "./routes/jobSearch/job-search.router";
import { startJobPollerSchedule } from "./poller/job-poller";
import { jobsRouter } from "./routes/jobs/jobs.router";
import { wantedJobsRouter } from "./routes/wantedJobs/wanted-job.router";
import { notificationsRouter } from "./routes/notifications/notification.router";
import { NotificationBroker } from "./routes/notifications/notification.broker";
import { NotificationService } from "./routes/notifications/notification.service";
import { dispatchWantedJobMatches } from "./routes/notifications/wanted-job-match.dispatch";
import type { ServerConfig } from "./server.types";

export type { ServerConfig } from "./server.types";

export class Server {
    readonly app: FastifyInstance;
    private readonly config: ServerConfig;
    readonly DBClient: MongoClient;
    readonly embeddingCache = new UserEmbeddingCache();
    readonly notificationBroker = new NotificationBroker();

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

            try {
                startUserChangeStream(this.DBClient.database, this.embeddingCache);
            } catch (err) {
                console.warn("Change Stream not available (requires replica set):", err);
            }

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
            const notificationService = new NotificationService(this.DBClient.notifications);
            const wantedJobsCollection = this.DBClient.wantedJobs;
            const broker = this.notificationBroker;
            const onJobCreated = async (job: import("./poller/job-poller-api-stack/stages/enrich/types").EnrichedJob) => {
                await dispatchWantedJobMatches({
                    job,
                    wantedJobsCollection,
                    notificationService,
                    broker,
                });
            };

            await this.app.register(jobsRouter(
                this.DBClient.jobs,
                this.DBClient.llmTokenUsage,
                this.embeddingCache,
                onJobCreated
            ));
            await this.app.register(wantedJobsRouter(this.DBClient.wantedJobs));
            await this.app.register(notificationsRouter(this.DBClient.notifications, this.DBClient.pipelineJobs, this.notificationBroker));

            const address = await this.app.listen({
                port: this.config.port,
                host: process.env.HOST || "127.0.0.1"
            });
            startJobPollerSchedule(this.DBClient.jobs, this.DBClient.llmTokenUsage);
            console.log(`🚀 Server running on ${address}`);

        } catch (err) {
            console.error("🔥 Server failed to start:", err);
            this.app.log.error(err);
            process.exit(1);
        }
    };

    stop = async (): Promise<void> => {
        this.notificationBroker.shutdown();
        await this.app.close();
        await this.DBClient.stop();
    };
}
