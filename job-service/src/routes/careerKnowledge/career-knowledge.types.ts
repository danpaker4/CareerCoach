export type CareerRoleProfile = {
    roleName: string;
    commonSkills: string[];
    relatedRoles: string[];
    commonDomains: string[];
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
