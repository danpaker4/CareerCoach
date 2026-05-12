export interface ChatProps {
    userId: string;
    userProfile?: {
        firstName?: string;
        lastName?: string;
        currentJob?: string;
        achievements?: {
            id: string;
            name: string;
            grade: number;
        }[];
        technologies?: string[];
        interests?: string[];
        githubSkills?: string[];
        knownSkills?: string[];
        /** Plain-text CV snippet for the coach (keep reasonably short). */
        cvExcerpt?: string;
    };
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

export interface Message {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ConversationResponse {
    userId: string;
    achievements: {
        id: string;
        name: string;
        grade: number;
    }[];
    messages: {
        role: 'system' | 'user' | 'assistant';
        content: string;
        timestamp: string;
        attachedJobs?: AttachedJobSnapshot[];
    }[];
}

export interface ChatResponse {
    reply?: string;
    jobs?: Array<{
        jobId: string;
        jobTitle: string;
        url: string;
        seniority: string;
        description: string;
        company?: string;
        salary?: number;
    }>;
    jobMatches?: Array<{
        jobId: string;
        title: string;
        matchScore: number;
    }>;
}
