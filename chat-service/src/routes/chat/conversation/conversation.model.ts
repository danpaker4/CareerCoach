import { ObjectId } from "mongodb";
import type { ChatMessage, UserAchievement } from "../chat/chat.model";
import type { ConversationJobContext } from "../job-context/job-context.types";

export type CareerHorizon = "UNSET" | "IMMEDIATE" | "LONG_TERM";

export interface ConversationStageProgress {
    currentStageIndex: number;
    currentStageId?: string;
    completedStageIds?: string[];
    awaitingConfirmation: boolean;
    stageNotes: Record<string, string[]>;
    surfacedAchievementIds?: string[];
}

export interface Conversation {
    _id?: ObjectId;
    userId: string;
    achievements: UserAchievement[];
    messages: ChatMessage[];
    jobContext?: ConversationJobContext;
    /** When LONG_TERM, job search APIs are disabled; coach focuses on naming a dream role. */
    careerHorizon?: CareerHorizon;
    /** Set after a dream job title was saved for this thread; stops repeat long-term discovery. */
    longTermCapturedDreamJobTitle?: string;
    stageProgress: ConversationStageProgress;
    createdAt: Date;
    updatedAt: Date;
}
