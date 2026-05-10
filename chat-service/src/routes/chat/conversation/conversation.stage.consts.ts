export type ConversationStage = {
    id: string;
    objective: string;
};

export const CONVERSATION_STAGES: readonly ConversationStage[] = [
    {
        id: "achievements",
        objective:
            "Understand the user's background, experience, and concrete achievements. If they sound unsure about their direction, still gather what they have done—and note what parts of it they liked.",
    },
    {
        id: "timeline",
        objective:
            "Understand whether they want to move soon or are thinking longer-term, and whether they already picture a specific next role or are still discovering what fits.",
    },
    {
        id: "preferences",
        objective:
            "When they can name a target role or field: capture role type, domain, and career constraints the product supports. When they still cannot name a specific job: draw out what they love doing, care about, and want more of in the future—without asking them to label or choose a 'career path type'; use their answers as signals for job discovery.",
    },
];
