import { v4 as uuidv4 } from "uuid";
import type { CareerRoadMap } from "../career-roadmap.model";

export const mockUserId = uuidv4();

export const mockCareerRoadMap: CareerRoadMap = {
    id: uuidv4(),
    userId: mockUserId,
    dreamJob: "Senior Software Engineer",
    stagesToDreamJob: [
        { jobId: 101, isDone: true },
        { jobId: 102, isDone: false },
        { jobId: 103, isDone: false },
    ],
};

export const mockCareerRoadMap2: CareerRoadMap = {
    id: uuidv4(),
    userId: mockUserId,
    dreamJob: "Tech Lead",
    stagesToDreamJob: [
        { jobId: 201, isDone: false },
    ],
};

export const testServerConfig = {
    port: 0,
    mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined,
    },
};

