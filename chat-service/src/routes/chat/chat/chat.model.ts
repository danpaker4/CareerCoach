export interface UserAchievement {
    id: string;
    name: string;
    grade: number;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
    timestamp: Date;
}