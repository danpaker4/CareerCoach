export interface UserAchievement {
    id: string;
    name: string;
    grade: number;
}

export type AttachedJobSnapshot = {
    jobId: string;
    jobTitle: string;
    url: string;
    seniority: string;
    description: string;
    company: string;
    salary: number;
};

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
    timestamp: Date;
    attachedJobs?: AttachedJobSnapshot[];
}