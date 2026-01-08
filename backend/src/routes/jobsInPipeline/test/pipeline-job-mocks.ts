import { v4 as uuidv4 } from "uuid";
import type { PipelineJob } from "../pipeline-job.model";

export const mockUserId = uuidv4();

export const mockPipelineJob: PipelineJob = {
    id: uuidv4(),
    userId: mockUserId,
    jobId: 101,
    jobStage: "watchlist",
    description: "Software Engineer at TechCorp",
};

export const mockPipelineJob2: PipelineJob = {
    id: uuidv4(),
    userId: mockUserId,
    jobId: 102,
    jobStage: "in progress",
    description: "Frontend Developer at WebSoft",
};

export const testServerConfig = {
    port: 0,
    mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined,
    },
};

