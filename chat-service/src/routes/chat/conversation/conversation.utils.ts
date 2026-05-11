import type { Conversation } from "./conversation.model";
import type { ConversationResponse, ProfileInput } from "./conversation.types";

export const formatAchievementsForWelcome = (achievements: readonly { name: string; grade: number }[]): string => {
    if (achievements.length === 0) {
        return "I do not have achievements yet. Share your highlights and I will build your profile as we chat.";
    }

    return achievements.map((achievement) => `- ${achievement.name}`).join("\n");
};

export const profileToSeedAchievements = (profile?: ProfileInput): { id: string; name: string; grade: number }[] => {
    const profileAchievements = profile?.achievements ?? [];
    if (profileAchievements.length > 0) {
        return profileAchievements;
    }

    if (profile?.currentJob && profile.currentJob.trim()) {
        return [{
            id: "profile-current-job",
            name: `Current job: ${profile.currentJob.trim()}`,
            grade: 70,
        }];
    }

    return [];
};

export const toConversationResponse = (conversation: Conversation): ConversationResponse => ({
    userId: conversation.userId,
    achievements: conversation.achievements,
    messages: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        ...(message.attachedJobs && message.attachedJobs.length > 0 ? { attachedJobs: message.attachedJobs } : {}),
    })),
});
