import { MongoClient as MongoDbClient, type Collection, type Db, type MongoClientOptions } from "mongodb";
import { Service } from "../types/service";
import type { Pipeline } from "../routes/MyPipline/pipeline.model";
import type { PipelineJob } from "../routes/jobsInPipeline/pipeline-job.model";
import type { SkillMatcher } from "../routes/skillMatcher/skill-matcher.model";
import type { CareerRoadMap } from "../routes/careerRoadMap/career-roadmap.model";
import type { EnrichedJob } from "../poller/job-poller-api-stack/stages/enrich/types";
import type {
    CareerDirectionExample,
    CareerPathProfile,
    CareerRoleProfile,
    CareerSkillProfile,
} from "../routes/careerKnowledge/career-knowledge.types";
import type { LlmTokenUsageDocument } from "../llm-token-usage/llm-token-usage.types";
export class MongoClient implements Service {
    private readonly mongoClient: MongoDbClient;
    private readonly connectionOptions: MongoClientOptions;
    private db: Db | null = null;
    private pipelinesCollection: Collection<Pipeline> | null = null;
    private pipelineJobsCollection: Collection<PipelineJob> | null = null;
    private skillMatchersCollection: Collection<SkillMatcher> | null = null;
    private careerRoadMapsCollection: Collection<CareerRoadMap> | null = null;
    private jobsCollection: Collection<EnrichedJob> | null = null;
    private careerRoleProfilesCollection: Collection<CareerRoleProfile> | null = null;
    private careerSkillProfilesCollection: Collection<CareerSkillProfile> | null = null;
    private careerPathProfilesCollection: Collection<CareerPathProfile> | null = null;
    private careerDirectionExamplesCollection: Collection<CareerDirectionExample> | null = null;
    private llmTokenUsageCollection: Collection<LlmTokenUsageDocument> | null = null;

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
            this.careerRoleProfilesCollection = this.db.collection<CareerRoleProfile>("career_role_profiles");
            this.careerSkillProfilesCollection = this.db.collection<CareerSkillProfile>("career_skill_profiles");
            this.careerPathProfilesCollection = this.db.collection<CareerPathProfile>("career_path_profiles");
            this.careerDirectionExamplesCollection = this.db.collection<CareerDirectionExample>("career_direction_examples");
            this.llmTokenUsageCollection = this.db.collection<LlmTokenUsageDocument>("llmTokenUsage");
            await this.llmTokenUsageCollection.createIndex({ createdAt: -1, provider: 1, model: 1 });

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
        this.careerRoleProfilesCollection = null;
        this.careerSkillProfilesCollection = null;
        this.careerPathProfilesCollection = null;
        this.careerDirectionExamplesCollection = null;
        this.llmTokenUsageCollection = null;
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

    get careerRoleProfiles(): Collection<CareerRoleProfile> {
        if (!this.careerRoleProfilesCollection) {
            throw new Error("Career role profiles collection is not initialized");
        }
        return this.careerRoleProfilesCollection;
    }

    get careerSkillProfiles(): Collection<CareerSkillProfile> {
        if (!this.careerSkillProfilesCollection) {
            throw new Error("Career skill profiles collection is not initialized");
        }
        return this.careerSkillProfilesCollection;
    }

    get careerPathProfiles(): Collection<CareerPathProfile> {
        if (!this.careerPathProfilesCollection) {
            throw new Error("Career path profiles collection is not initialized");
        }
        return this.careerPathProfilesCollection;
    }

    get careerDirectionExamples(): Collection<CareerDirectionExample> {
        if (!this.careerDirectionExamplesCollection) {
            throw new Error("Career direction examples collection is not initialized");
        }
        return this.careerDirectionExamplesCollection;
    }

    get database(): Db {
        if (!this.db) throw new Error("Database not initialized");
        return this.db;
    }

    get llmTokenUsage(): Collection<LlmTokenUsageDocument> {
        if (!this.llmTokenUsageCollection) {
            throw new Error("LLM token usage collection is not initialized");
        }
        return this.llmTokenUsageCollection;
    }

}

export type DatabaseConfig = {
    mongoConnectionString: string;
    mongoKeyPath?: string;
};
