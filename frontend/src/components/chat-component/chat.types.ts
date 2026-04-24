export interface ChatProps {
    userId: string;
    userName?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
}

export interface ChatResponse {
    response?: string;
}
