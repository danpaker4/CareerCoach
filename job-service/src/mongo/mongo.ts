import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { Pipeline } from "../routes/MyPipline/pipeline.model";
import type { PipelineJob } from "../routes/jobsInPipeline/pipeline-job.model";
import type { SkillMatcher } from "../routes/skillMatcher/skill-matcher.model";
import type { CareerRoadMap } from "../routes/careerRoadMap/career-roadmap.model";
import type { EnrichedJob } from "../poller/job-poller/stages/enrich/types";

export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private pipelinesCollection: Collection<Pipeline> | null = null;
    private pipelineJobsCollection: Collection<PipelineJob> | null = null;
    private skillMatchersCollection: Collection<SkillMatcher> | null = null;
    private careerRoadMapsCollection: Collection<CareerRoadMap> | null = null;
    private jobsCollection: Collection<EnrichedJob> | null = null;

    constructor(config: DatabaseConfig) {
       const dbKeyPathOption = (config.mongoKeyPath && config.mongoKeyPath !== 'none') 
    ? { tlsCertificateKeyFile: config.mongoKeyPath } 
    : {};
        this.connectionOptions = { ...dbKeyPathOption };
        this.mongoClient = new MongoDbClient(config.mongoConnectionString, this.connectionOptions);
    }

    start = async (): Promise<void> => {
        try {
            await this.mongoClient.connect();
            this.db = this.mongoClient.db();
            
            this.pipelinesCollection = this.db.collection<Pipeline>("pipelines");
            this.pipelineJobsCollection = this.db.collection<PipelineJob>("pipelineJobs");
            this.skillMatchersCollection = this.db.collection<SkillMatcher>("skillMatchers");
            this.careerRoadMapsCollection = this.db.collection<CareerRoadMap>("careerRoadMaps");
            this.jobsCollection = this.db.collection<EnrichedJob>("jobs");
            
            console.log('MongoDb Connection Succeeded');
        } catch (err) {
            console.error('Failed To Connect MongoDb', err);
            throw err;
        }
    };

    stop = async (): Promise<void> => {
        await this.mongoClient.close();
        this.db = null;
        this.pipelinesCollection = null;
        this.pipelineJobsCollection = null;
        this.skillMatchersCollection = null;
        this.careerRoadMapsCollection = null;
        this.jobsCollection = null;
        console.log('MongoDb Connection Closed');
    };

    get pipelines(): Collection<Pipeline> {
        if (!this.pipelinesCollection) {
            throw new Error("Pipelines collection is not initialized");
        }
        return this.pipelinesCollection;
    }

    get pipelineJobs(): Collection<PipelineJob> {
        if (!this.pipelineJobsCollection) {
            throw new Error("Pipeline jobs collection is not initialized");
        }
        return this.pipelineJobsCollection;
    }

    get skillMatchers(): Collection<SkillMatcher> {
        if (!this.skillMatchersCollection) {
            throw new Error("Skill matchers collection is not initialized");
        }
        return this.skillMatchersCollection;
    }

    get careerRoadMaps(): Collection<CareerRoadMap> {
        if (!this.careerRoadMapsCollection) {
            throw new Error("Career roadmaps collection is not initialized");
        }
        return this.careerRoadMapsCollection;
    }

    get jobs(): Collection<EnrichedJob> {
        if (!this.jobsCollection) {
            throw new Error("Jobs collection is not initialized");
        }
        return this.jobsCollection;
    }
}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};