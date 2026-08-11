import type { OnboardingBackground, OnboardingFlow, OnboardingInitialMode } from "../../../routes/conversation/conversation.types";

export type OnboardingLlmDecision = {
    response: string;
    background: OnboardingBackground;
    mode: OnboardingInitialMode | null;
    advance: boolean;
};

export type OnboardingStepResult = {
    reply: string;
    onboardingFlow: OnboardingFlow;
    completedThisTurn: boolean;
};

export const MAX_BACKGROUND_ASK_COUNT = 1;
export const MAX_DIRECTION_ASK_COUNT = 2;

export const ONBOARDING_BACKGROUND_REASK_REPLY =
    "Before we continue, I'd like to understand your starting point. Can you tell me about your work experience, studies, projects, or technical background?";

export const ONBOARDING_DIRECTION_REASK_REPLY =
    "Are you looking for a job now, aiming for a longer-term role in the future, or still figuring out what you want?";

export const ONBOARDING_PARSE_FALLBACK_REPLY =
    "Thanks — are you looking for a job now, thinking about a longer-term career goal, or still figuring it out?";
