import type { ConversationStage } from "./conversation.types";

export const STAGE_SIGNALS: Readonly<Record<string, readonly string[]>> = {
    achievements: [
        "experience",
        "project",
        "built",
        "developed",
        "worked",
        "achievement",
        "skill",
        "stack",
        "developer",
        "engineer",
        "years",
    ],
    timeline: [
        "immediately",
        "asap",
        "soon",
        "now",
        "looking for",
        "next job",
        "next role",
        "timeline",
        "months",
        "long-term",
        "long term",
        "future",
        "dream",
        "don't know",
        "do not know",
        "dont know",
        "not sure",
        "no idea",
        "unsure",
        "exploring",
        "figuring out",
    ],
    preferences: [
        "role",
        "position",
        "product manager",
        "frontend",
        "backend",
        "fullstack",
        "domain",
        "industry",
        "prefer",
        "love",
        "enjoy",
        "passion",
        "interested in",
        "care about",
    ],
};

export const CONVERSATION_STAGES: readonly ConversationStage[] = [
    {
        id: "achievements",
        objective:
            "Background collection is handled by onboarding. If still on this stage after onboarding, advance without re-asking for background.",
    },
    {
        id: "timeline",
        objective:
            "Initial career-direction selection is handled by onboarding. If still on this stage after onboarding, advance without re-asking the direction fork.",
    },
    {
        id: "preferences",
        objective:
            "Only when the user is undecided (GUIDED after onboarding): dig into what they have done, what they enjoy, and useful constraints to help them choose near-term vs longer-term. Do not use this stage when they already chose a job now or a future/dream path.",
    },
];
