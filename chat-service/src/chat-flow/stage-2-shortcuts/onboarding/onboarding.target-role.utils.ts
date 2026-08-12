import type {
    OnboardingFlow,
    OnboardingNearTermRoleChoice,
} from "../../../routes/conversation/conversation.types";
import { extractNearTermSearchQuery } from "../../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import type { OnboardingLlmDecision, OnboardingStepResult } from "./onboarding.types";
import {
    ONBOARDING_DIFFERENT_ROLE_REPLY,
    ONBOARDING_DIRECTION_REASK_REPLY,
    ONBOARDING_ROLE_CHOICE_REPLY,
} from "./onboarding.types";

const SAME_ROLE_PATTERNS: readonly RegExp[] = [
    /^same(?: role| job| field)?[.!]?$/i,
    /\b(?:stay|continue|remain)\s+in\s+(?:the\s+)?same\b/i,
    /\b(?:another|new)\s+(?:job|position)\s+in\s+(?:the\s+)?same\s+(?:role|field)\b/i,
];

const DIFFERENT_ROLE_PATTERNS: readonly RegExp[] = [
    /^different(?: role| job| field)?[.!]?$/i,
    /\b(?:a|something)\s+different\b/i,
    /\b(?:change|switch|move|transition|pivot)\s+(?:my\s+)?(?:role|career|field|into|to)\b/i,
];

const getEditDistance = (source: string, target: string): number => {
    const initialRow = Array.from({ length: target.length + 1 }, (_, index) => index);
    const finalRow = [...source].reduce<readonly number[]>((previousRow, sourceCharacter, sourceIndex) =>
        [...target].reduce<readonly number[]>((currentRow, targetCharacter, targetIndex) => {
            const insertionCost = (currentRow[targetIndex] ?? 0) + 1;
            const deletionCost = (previousRow[targetIndex + 1] ?? 0) + 1;
            const substitutionCost = (previousRow[targetIndex] ?? 0)
                + (sourceCharacter === targetCharacter ? 0 : 1);
            return [...currentRow, Math.min(insertionCost, deletionCost, substitutionCost)];
        }, [sourceIndex + 1]), initialRow);

    return finalRow[target.length] ?? target.length;
};

const containsApproximateWord = (message: string, expectedWord: string, maxEditDistance: number): boolean => {
    const words = message.toLowerCase().match(/[a-z]+/g) ?? [];
    return words.some((word) =>
        Math.abs(word.length - expectedWord.length) <= maxEditDistance
        && getEditDistance(word, expectedWord) <= maxEditDistance);
};

export const resolveNearTermRoleChoice = (message: string): OnboardingNearTermRoleChoice | null => {
    const trimmed = message.trim();
    if (SAME_ROLE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return "SAME_ROLE";
    }
    if (DIFFERENT_ROLE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return "DIFFERENT_ROLE";
    }
    if (containsApproximateWord(trimmed, "same", 1)) {
        return "SAME_ROLE";
    }
    if (containsApproximateWord(trimmed, "different", 2)) {
        return "DIFFERENT_ROLE";
    }
    return null;
};

export const buildNearTermRoleChoiceReply = (currentRole: string | null | undefined): string => {
    const role = currentRole?.trim();
    if (!role) {
        return ONBOARDING_ROLE_CHOICE_REPLY;
    }
    return `Are you looking for the same role (${role}), or do you want to move into a different role?`;
};

export const buildDifferentRoleDiscoveryReply = (modelReply: string): string => {
    const trimmed = modelReply.trim();
    const isWrongStageQuestion = trimmed === ONBOARDING_DIRECTION_REASK_REPLY
        || /\bsame role\b.*\bdifferent role\b/i.test(trimmed);
    if (trimmed.endsWith("?") && !isWrongStageQuestion) {
        return trimmed;
    }
    return ONBOARDING_DIFFERENT_ROLE_REPLY;
};

export const normalizeTargetRole = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 80) {
        return null;
    }
    return trimmed;
};

const completeNearTermTarget = (
    current: OnboardingFlow,
    targetRole: string,
    roleChoice: OnboardingNearTermRoleChoice,
): OnboardingStepResult => ({
    reply: `Got it — I'll look for ${targetRole} roles you can move into soon.`,
    onboardingFlow: {
        ...current,
        directionResolved: true,
        completed: true,
        initialMode: "NEAR_TERM",
        nearTermTarget: {
            ...current.nearTermTarget,
            step: "discovering_target",
            roleChoice,
            targetRole,
            searchQuery: targetRole,
            exploratory: false,
        },
    },
    completedThisTurn: true,
});

const completeNearTermExploration = (
    current: OnboardingFlow,
    searchQuery: string,
    reply: string,
): OnboardingStepResult => ({
    reply,
    onboardingFlow: {
        ...current,
        directionResolved: true,
        completed: true,
        initialMode: "NEAR_TERM",
        nearTermTarget: {
            ...current.nearTermTarget,
            step: "discovering_target",
            roleChoice: "DIFFERENT_ROLE",
            searchQuery,
            exploratory: true,
        },
    },
    completedThisTurn: true,
});

export const startNearTermTargetSelection = (
    current: OnboardingFlow,
    latestUserMessage: string,
): OnboardingStepResult => {
    const explicitTarget = normalizeTargetRole(extractNearTermSearchQuery(latestUserMessage));
    if (explicitTarget) {
        const currentRole = current.background?.role?.trim().toLowerCase();
        const roleChoice = currentRole === explicitTarget.toLowerCase() ? "SAME_ROLE" : "DIFFERENT_ROLE";
        return completeNearTermTarget(current, explicitTarget, roleChoice);
    }

    return {
        reply: buildNearTermRoleChoiceReply(current.background?.role),
        onboardingFlow: {
            ...current,
            directionResolved: true,
            completed: false,
            initialMode: "NEAR_TERM",
            nearTermTarget: { step: "awaiting_role_choice", clarificationCount: 0 },
        },
        completedThisTurn: false,
    };
};

export const continueNearTermTargetSelection = (
    current: OnboardingFlow,
    decision: OnboardingLlmDecision,
    latestUserMessage: string,
): OnboardingStepResult => {
    const targetFlow = current.nearTermTarget ?? { step: "awaiting_role_choice" as const };
    const explorationQuery = decision.targetExplorationReady
        ? decision.targetSearchQuery?.trim()
        : null;
    if (explorationQuery) {
        return completeNearTermExploration(current, explorationQuery, decision.response);
    }
    const explicitTarget = normalizeTargetRole(extractNearTermSearchQuery(latestUserMessage));
    const modelTarget = decision.targetRoleReady ? normalizeTargetRole(decision.targetRole) : null;
    const targetRole = explicitTarget ?? modelTarget;
    if (targetRole) {
        return completeNearTermTarget(current, targetRole, "DIFFERENT_ROLE");
    }

    if (targetFlow.step === "awaiting_role_choice") {
        const roleChoice = resolveNearTermRoleChoice(latestUserMessage) ?? decision.roleChoice ?? null;
        if (roleChoice === "SAME_ROLE") {
            const currentRole = normalizeTargetRole(current.background?.role);
            if (currentRole) {
                return completeNearTermTarget(current, currentRole, "SAME_ROLE");
            }
            return {
                reply: ONBOARDING_DIFFERENT_ROLE_REPLY,
                onboardingFlow: {
                    ...current,
                    nearTermTarget: {
                        step: "discovering_target",
                        roleChoice: "SAME_ROLE",
                        clarificationCount: 0,
                    },
                },
                completedThisTurn: false,
            };
        }
        if (roleChoice === "DIFFERENT_ROLE") {
            return {
                reply: ONBOARDING_DIFFERENT_ROLE_REPLY,
                onboardingFlow: {
                    ...current,
                    nearTermTarget: { step: "discovering_target", roleChoice, clarificationCount: 0 },
                },
                completedThisTurn: false,
            };
        }
        return {
            reply: buildNearTermRoleChoiceReply(current.background?.role),
            onboardingFlow: current,
            completedThisTurn: false,
        };
    }

    return {
        reply: buildDifferentRoleDiscoveryReply(decision.response),
        onboardingFlow: {
            ...current,
            nearTermTarget: {
                ...targetFlow,
                step: "discovering_target",
                clarificationCount: (targetFlow.clarificationCount ?? 0) + 1,
                suggestedRoles: decision.targetRoleOptions ?? targetFlow.suggestedRoles,
            },
        },
        completedThisTurn: false,
    };
};
