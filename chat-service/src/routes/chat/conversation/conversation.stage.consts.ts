export type ConversationStage = {
    id: string;
    objective: string;
};

export const CONVERSATION_STAGES: readonly ConversationStage[] = [
    {
        id: "achievements",
        objective: "Understand the user's background, experience, and concrete achievements.",
    },
    {
        id: "timeline",
        objective: "Understand whether the user is looking for immediate opportunities, long-term goals, or both.",
    },
    {
        id: "preferences",
        objective: "Understand job preferences: role type, domain/industry, and relevant career constraints supported by the product.",
    },
];
