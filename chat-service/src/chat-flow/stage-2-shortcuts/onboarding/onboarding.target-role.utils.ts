import type {
    OnboardingFlow,
    OnboardingNearTermRoleChoice,
} from "../../../routes/conversation/conversation.types";
import { extractNearTermSearchQuery } from "../../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import type { OnboardingLlmDecision, OnboardingStepResult } from "./onboarding.types";
import type { TargetRoleOption } from "./onboarding.target-role.types";
import {
    ONBOARDING_DIFFERENT_ROLE_REPLY,
    ONBOARDING_DIRECTION_REASK_REPLY,
    ONBOARDING_ROLE_CHOICE_REPLY,
} from "./onboarding.types";

const MAX_DISCOVERY_FACTS = 20;
const MAX_DISCOVERY_FACT_CHARS = 240;

const isStringFactEntry = (entry: [string, unknown]): entry is [string, string] =>
    entry[0].trim().length > 0 && typeof entry[1] === "string";

export const parseTargetDiscoveryFacts = (value: unknown): Readonly<Record<string, string>> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(value)
            .filter(isStringFactEntry)
            .map(([key, fact]) => [key.trim().slice(0, 80), fact.trim().slice(0, MAX_DISCOVERY_FACT_CHARS)])
            .filter(([, fact]) => fact.length > 0)
            .slice(0, MAX_DISCOVERY_FACTS),
    );
};

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

export const resolveNearTermRoleChoice = (message: string): OnboardingNearTermRoleChoice | null => {
    const trimmed = message.trim();
    if (SAME_ROLE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return "SAME_ROLE";
    }
    if (DIFFERENT_ROLE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
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

export const formatTargetRoleOptionsReply = (summary: string, roles: readonly TargetRoleOption[]): string => {
    const roleLines = roles.map((role, index) => `${index + 1}. ${role.title} — ${role.reason}`);
    return [
        summary.trim(),
        ...roleLines,
        "Which role feels closest, or do none of them fit?",
    ].join("\n");
};

export const normalizeTargetRole = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 80) {
        return null;
    }
    return trimmed;
};

export const matchSuggestedRoleTitle = (
    latestUserMessage: string,
    suggestedRoles: readonly string[],
): string | null => {
    const normalizedMessage = latestUserMessage.trim().toLocaleLowerCase();
    return suggestedRoles.find((role) => role.trim().toLocaleLowerCase() === normalizedMessage) ?? null;
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
    const discoveryFacts = {
        ...(targetFlow.discoveryFacts ?? {}),
        ...(decision.targetDiscoveryFacts ?? {}),
    };
    const coveredSubjects = decision.targetDiscoverySubject
        ? [...new Set([...(targetFlow.coveredSubjects ?? []), decision.targetDiscoverySubject])]
        : targetFlow.coveredSubjects;
    const currentWithDiscovery: OnboardingFlow = {
        ...current,
        nearTermTarget: {
            ...targetFlow,
            discoveryFacts,
            coveredSubjects,
        },
    };
    const explicitTarget = normalizeTargetRole(extractNearTermSearchQuery(latestUserMessage));
    const modelTarget = decision.targetRoleReady ? normalizeTargetRole(decision.targetRole) : null;
    const targetRole = explicitTarget ?? modelTarget;
    if (targetRole) {
        return completeNearTermTarget(currentWithDiscovery, targetRole, "DIFFERENT_ROLE");
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
                reply: buildDifferentRoleDiscoveryReply(decision.response),
                onboardingFlow: {
                    ...current,
                    nearTermTarget: {
                        step: "discovering_target",
                        roleChoice,
                        clarificationCount: 1,
                        discoveryFacts,
                        coveredSubjects,
                    },
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
                clarificationCount: decision.targetDiscoverySubject
                    ? (targetFlow.clarificationCount ?? 0) + 1
                    : targetFlow.clarificationCount,
                suggestedRoles: decision.targetRoleOptions ?? targetFlow.suggestedRoles,
                discoveryFacts,
                coveredSubjects,
            },
        },
        completedThisTurn: false,
    };
};
