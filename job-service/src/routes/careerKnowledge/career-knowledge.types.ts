export type CareerRoleProfile = {
    roleCategory: string;
    roleName: string;
    commonSkills: string[];
    relatedRoles: string[];
    commonDomains: string[];
    responsibilities: string[];
    leadershipSignals: string[];
    architectureSignals: string[];
    seniorityDistribution: Record<string, number>;
    sourceJobIds: string[];
    embedding: number[];
    createdAt: Date;
    updatedAt: Date;
};

export type CareerSkillProfile = {
    skillName: string;
    relatedRoles: string[];
    relatedSkills: string[];
    demandScore: number;
    sourceJobIds: string[];
    embedding: number[];
    createdAt: Date;
    updatedAt: Date;
};

export type CareerPathProfile = {
    fromRole: string;
    toRole: string;
    requiredSkills: string[];
    overlapScore: number;
    evidenceJobIds: string[];
    embedding: number[];
    createdAt: Date;
    updatedAt: Date;
};

export type CareerDirectionExample = {
    directionName: string;
    description: string;
    exampleRoles: string[];
    exampleTasks: string[];
    relatedSkills: string[];
    embedding: number[];
    sourceJobIds: string[];
    createdAt: Date;
    updatedAt: Date;
};

export type MarketRequirementsResponse = {
    roleCategory: string;
    commonSkills: string[];
    responsibilities: string[];
    leadershipSignals: string[];
    architectureSignals: string[];
    seniorityDistribution: Record<string, number>;
    sampleJobCount: number;
};

export type CareerPathQueryResponse = {
    fromRole: string;
    toRole: string;
    paths: CareerPathProfile[];
};
