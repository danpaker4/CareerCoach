export type ConversationSummary = {
    conversationId: string;
    updatedAt: string;
    previewText: string;
};

export interface ChatProps {
    userId: string;
    conversationId: string;
    onExportSnapshotChange?: (snapshot: ChatExportSnapshot) => void;
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

export interface ChatJobCard {
    id: string;
    title: string;
    company: string;
    seniority: string;
    location: string | null;
}

export interface Message {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    jobs?: ChatJobCard[];
}

export type ChatExportSnapshot = {
    readonly conversationId: string;
    readonly messages: readonly Message[];
};

export type ExportedChatTurn = {
    readonly user: string;
    readonly chatbot: string;
};

export type ExportedChatConversation = {
    readonly id: string;
    readonly chat: readonly ExportedChatTurn[];
};

export interface ConversationResponse {
    conversationId: string;
    userId: string;
    currentStageId?: string | null;
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
        id: string;
        title: string;
        url: string;
        seniority: string;
        description: string;
        company: string;
        salary: number | null;
        requirements: string[];
        mustKnowSkills: string[];
        niceToHaveSkills: string[];
        benefits: string[];
        location: string | null;
    }>;
    jobMatches?: Array<{
        jobId: string;
        title: string;
        matchScore: number;
    }>;
}

export type ChatRequestStatus = 'queued' | 'started' | 'completed' | 'failed';

export interface ChatQueuedResponse {
    requestId: string;
    conversationId: string;
    status: 'queued';
}

export interface ChatRequestResponse {
    requestId: string;
    userId: string;
    conversationId: string;
    status: ChatRequestStatus;
    createdAt: string;
    updatedAt: string;
    queuedAt: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    response?: ChatResponse;
    error?: string;
}

export type ChatRequestEvent =
    | {
        type: 'queued';
        requestId: string;
        userId: string;
        conversationId: string;
        status: 'queued';
      }
    | {
        type: 'started';
        requestId: string;
        userId: string;
        conversationId: string;
        status: 'started';
      }
    | {
        type: 'completed';
        requestId: string;
        userId: string;
        conversationId: string;
        status: 'completed';
        response: ChatResponse;
      }
    | {
        type: 'failed';
        requestId: string;
        userId: string;
        conversationId: string;
        status: 'failed';
        error: string;
      };
