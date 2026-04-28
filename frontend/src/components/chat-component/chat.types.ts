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
    };
}

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
    }[];
}

export interface ChatResponse {
    reply?: string;
}
