import { v4 as uuidv4 } from "uuid";
import type { SkillMatcher } from "../skill-matcher.model";

export const mockUserId = uuidv4();

export const mockSkillMatcher: SkillMatcher = {
    id: uuidv4(),
    userId: mockUserId,
    jobId: 101,
    skillToImprove: [
        { skill: "TypeScript", isDone: false },
        { skill: "React", isDone: true },
    ],
};

export const mockSkillMatcher2: SkillMatcher = {
    id: uuidv4(),
    userId: mockUserId,
    jobId: 102,
    skillToImprove: [
        { skill: "Node.js", isDone: false },
    ],
};

export const testServerConfig = {
    port: 0,
    mongoConfig: {
        mongoConnectionString: "mongodb://localhost:27017",
        mongoKeyPath: undefined,
    },
};
