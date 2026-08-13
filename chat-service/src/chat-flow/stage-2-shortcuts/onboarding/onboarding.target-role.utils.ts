import type {
    OnboardingFlow,
    OnboardingNearTermRoleChoice,
} from "../../../routes/conversation/conversation.types";
import { extractNearTermSearchQuery } from "../../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import { sanitizeClaimedRole } from "../role-conflict/role-conflict.utils";
import type { OnboardingLlmDecision, OnboardingStepResult } from "./onboarding.types";
import type { TargetRoleOption } from "./onboarding.target-role.types";
import {
    ONBOARDING_DIFFERENT_ROLE_REPLY,
    ONBOARDING_DIRECTION_REASK_REPLY,
    ONBOARDING_FIRST_ROLE_REPLY,
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

export const buildTargetRoleFallbackReply = (previousAssistantMessage: string | undefined): string => {
    const previousQuestion = previousAssistantMessage?.trim().toLowerCase();
    if (previousQuestion === ONBOARDING_DIFFERENT_ROLE_REPLY.toLowerCase()) {
        return "Could you name a specific job title, or would you like me to suggest a few roles?";
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
    const trimmed = value ? sanitizeClaimedRole(value) : undefined;
    if (!trimmed || trimmed.length < 3 || trimmed.length > 80) {
        return null;
    }
    return trimmed;
};

const buildNormalizedSameRoleBackground = (current: OnboardingFlow, targetRole: string): OnboardingFlow["background"] => {
    const background = current.background;
    if (!background) return undefined;
    const years = background.yearsOfExperience;
    const company = background.companies?.[0]?.trim();
    const companySuffix = company ? ` at ${company}` : "";
    const summary = years !== null && years !== undefined
        ? `${targetRole} for about ${years} years${companySuffix}`
        : `${targetRole}${companySuffix}`;
    return { ...background, role: targetRole, summary };
};

const completeNearTermTarget = (
    current: OnboardingFlow,
    targetRole: string,
    roleChoice: OnboardingNearTermRoleChoice,
): OnboardingStepResult => ({
    reply: `Got it — I'll look for ${targetRole} roles you can move into soon.`,
    onboardingFlow: {
        ...current,
        ...(roleChoice === "SAME_ROLE"
            ? { background: buildNormalizedSameRoleBackground(current, targetRole) }
            : {}),
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
    decision?: OnboardingLlmDecision,
): OnboardingStepResult => {
    const currentRole = normalizeTargetRole(current.background?.role);
    const explicitTarget = normalizeTargetRole(extractNearTermSearchQuery(latestUserMessage));
    if (explicitTarget) {
        const roleChoice = currentRole?.toLowerCase() === explicitTarget.toLowerCase()
            ? "SAME_ROLE"
            : "DIFFERENT_ROLE";
        return completeNearTermTarget(current, explicitTarget, roleChoice);
    }

    if (!currentRole) {
        const candidateQuestion = decision?.response.trim();
        const subject = decision?.targetDiscoverySubject?.trim();
        const validatedQuestion = candidateQuestion ? buildDifferentRoleDiscoveryReply(candidateQuestion) : null;
        const modelGeneratedQuestion = candidateQuestion && subject && validatedQuestion === candidateQuestion
            ? candidateQuestion
            : null;
        return {
            reply: modelGeneratedQuestion ?? ONBOARDING_FIRST_ROLE_REPLY,
            onboardingFlow: {
                ...current,
                directionResolved: true,
                completed: false,
                initialMode: "NEAR_TERM",
                nearTermTarget: {
                    step: "discovering_target",
                    clarificationCount: modelGeneratedQuestion ? 1 : 0,
                    ...(modelGeneratedQuestion && subject ? { coveredSubjects: [subject] } : {}),
                },
            },
            completedThisTurn: false,
        };
    }

    return {
        reply: buildNearTermRoleChoiceReply(currentRole),
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
    const rejectedSuggestedRoles = decision.rejectedTargetRoleOptions
        ? [...new Set([
            ...(targetFlow.rejectedSuggestedRoles ?? []),
            ...(targetFlow.suggestedRoles ?? []),
        ])]
        : targetFlow.rejectedSuggestedRoles;
    const currentWithDiscovery: OnboardingFlow = {
        ...current,
        nearTermTarget: {
            ...targetFlow,
            discoveryFacts,
            coveredSubjects,
            rejectedSuggestedRoles,
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
                suggestedRoles: decision.targetRoleOptions ?? targetFlow.suggestedRoles ?? [],
                discoveryFacts,
                coveredSubjects,
                rejectedSuggestedRoles,
            },
        },
        completedThisTurn: false,
    };
};
