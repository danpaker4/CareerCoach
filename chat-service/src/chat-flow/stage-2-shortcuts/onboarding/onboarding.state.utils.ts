import type { OnboardingFlow } from "../../../routes/conversation/conversation.model";
import type { OnboardingInitialMode } from "../../../routes/conversation/conversation.types";
import type { OnboardingLlmDecision, OnboardingStepResult } from "./onboarding.types";
import {
    MAX_BACKGROUND_ASK_COUNT,
    MAX_DIRECTION_ASK_COUNT,
    ONBOARDING_BACKGROUND_REASK_REPLY,
    ONBOARDING_DIRECTION_REASK_REPLY,
} from "./onboarding.types";
import { resolveOnboardingDirectionMode } from "./onboarding.direction.utils";
import {
    applyChatStatedFactsToBackground,
    buildChatStatedBackgroundReply,
    doesReplyMatchChatStatedFacts,
    extractChatStatedBackgroundFacts,
} from "./onboarding.chat-facts.utils";
import {
    continueNearTermTargetSelection,
    startNearTermTargetSelection,
} from "./onboarding.target-role.utils";

const withStoredBackground = (
    flow: OnboardingFlow,
    decision: OnboardingLlmDecision,
    latestUserMessage = "",
): OnboardingFlow => {
    const baseBackground = decision.background.status === "UNKNOWN" && flow.background
        ? flow.background
        : {
            ...decision.background,
            // Once background is stored, prefer keeping the first resolved role unless the model sends a clearer one.
            role: decision.background.role ?? flow.background?.role ?? null,
            summary: decision.background.summary ?? flow.background?.summary ?? null,
        };

    const chatFacts = extractChatStatedBackgroundFacts(latestUserMessage);
    return {
        ...flow,
        background: applyChatStatedFactsToBackground(baseBackground, chatFacts),
    };
};

const nearTermCompletionReply = (role: string | null | undefined): string => {
    if (role && role.trim().length > 0) {
        return `Got it — I'll look for ${role.trim()} roles you can move into soon.`;
    }
    return "Got it — I'll look for roles that fit what you're aiming for now.";
};

const dreamJobCompletionReply = (): string =>
    "Got it — let's focus on the longer-term role you want to grow into.";

const guidedCompletionReply = (): string =>
    "No problem — we can figure out the best direction together. What kind of work have you enjoyed so far?";

const completionReplyForMode = (
    mode: OnboardingInitialMode,
    role: string | null | undefined,
): string => {
    if (mode === "NEAR_TERM") {
        return nearTermCompletionReply(role);
    }
    if (mode === "DREAMJOB") {
        return dreamJobCompletionReply();
    }
    return guidedCompletionReply();
};

export const applyOnboardingDecision = (
    current: OnboardingFlow,
    decision: OnboardingLlmDecision,
    latestUserMessage = "",
): OnboardingStepResult => {
    if (current.completed) {
        return {
            reply: decision.response,
            onboardingFlow: current,
            completedThisTurn: false,
        };
    }

    if (!current.backgroundResolved) {
        if (decision.background.status === "FOUND" || decision.background.status === "NONE") {
            const chatFacts = extractChatStatedBackgroundFacts(latestUserMessage);
            const withBackground: OnboardingFlow = {
                ...withStoredBackground(current, decision, latestUserMessage),
                backgroundResolved: true,
                backgroundAskCount: current.backgroundAskCount,
            };
            const resolvedMode: OnboardingInitialMode | null =
                resolveOnboardingDirectionMode(latestUserMessage);
            if (resolvedMode) {
                if (resolvedMode === "NEAR_TERM") {
                    return startNearTermTargetSelection(withBackground, latestUserMessage);
                }
                const next: OnboardingFlow = {
                    ...withBackground,
                    directionResolved: true,
                    completed: true,
                    initialMode: resolvedMode,
                };
                return {
                    reply: completionReplyForMode(resolvedMode, next.background?.role),
                    onboardingFlow: next,
                    completedThisTurn: true,
                };
            }
            const fallbackReply = buildChatStatedBackgroundReply(chatFacts);
            const reply = fallbackReply && !doesReplyMatchChatStatedFacts(decision.response, chatFacts)
                ? fallbackReply
                : decision.response;
            return {
                reply,
                onboardingFlow: withBackground,
                completedThisTurn: false,
            };
        }

        if (current.backgroundAskCount < MAX_BACKGROUND_ASK_COUNT) {
            return {
                reply: decision.response.trim().length > 0 ? decision.response : ONBOARDING_BACKGROUND_REASK_REPLY,
                onboardingFlow: {
                    ...current,
                    backgroundAskCount: current.backgroundAskCount + 1,
                    background: decision.background,
                },
                completedThisTurn: false,
            };
        }

        const stored = withStoredBackground(current, decision, latestUserMessage);
        return {
            reply: ONBOARDING_DIRECTION_REASK_REPLY,
            onboardingFlow: {
                ...stored,
                backgroundResolved: true,
                background: {
                    ...(stored.background ?? decision.background),
                    status: "UNKNOWN",
                },
            },
            completedThisTurn: false,
        };
    }

    if (!current.directionResolved) {
        const resolvedMode: OnboardingInitialMode | null =
            decision.mode ?? resolveOnboardingDirectionMode(latestUserMessage);

        if (resolvedMode) {
            if (resolvedMode === "NEAR_TERM") {
                return startNearTermTargetSelection(current, latestUserMessage);
            }
            const next: OnboardingFlow = {
                ...current,
                background: current.background ?? decision.background,
                directionResolved: true,
                completed: true,
                initialMode: resolvedMode,
            };
            return {
                reply: completionReplyForMode(resolvedMode, next.background?.role),
                onboardingFlow: next,
                completedThisTurn: true,
            };
        }

        const nextAskCount = current.directionAskCount + 1;
        if (nextAskCount >= MAX_DIRECTION_ASK_COUNT) {
            const next: OnboardingFlow = {
                ...current,
                directionAskCount: nextAskCount,
                directionResolved: true,
                completed: true,
                initialMode: "GUIDED",
            };
            return {
                reply: guidedCompletionReply(),
                onboardingFlow: next,
                completedThisTurn: true,
            };
        }

        return {
            reply: ONBOARDING_DIRECTION_REASK_REPLY,
            onboardingFlow: {
                ...current,
                directionAskCount: nextAskCount,
            },
            completedThisTurn: false,
        };
    }

    if (current.initialMode === "NEAR_TERM" && current.directionResolved) {
        return continueNearTermTargetSelection(current, decision, latestUserMessage);
    }

    return {
        reply: decision.response,
        onboardingFlow: {
            ...current,
            completed: true,
            initialMode: current.initialMode ?? "GUIDED",
        },
        completedThisTurn: true,
    };
};
