import { recordChatLlmParseEvent } from "../../shared/llm/chat.llm.observability.utils";
import type { ChatLlmObservedOperation } from "../../shared/llm/chat.llm.types";
import {
    MAX_OPEN_TARGET_ROLE_QUESTIONS,
    MIN_TARGET_DISCOVERY_FACTS_FOR_OPTIONS,
} from "./onboarding.target-role.consts";
import {
    parseTargetRoleDecision,
    parseTargetRoleGroundingDecision,
    parseTargetRoleOptionsReviewDecision,
} from "./onboarding.target-role.llm.utils";
import {
    buildTargetRoleCorrectionPrompt,
    buildTargetRoleDecisionPrompt,
    buildTargetRoleGroundingCorrectionPrompt,
    buildTargetRoleGroundingPrompt,
    buildTargetRoleOptionsReviewPrompt,
} from "./onboarding.target-role.prompt.utils";
import { buildTargetRoleFallbackReply } from "./onboarding.target-role.utils";
import type {
    ResolveTargetRoleDecisionParams,
    TargetRoleDecision,
    TargetRoleGroundingDecision,
} from "./onboarding.target-role.types";

const completeJsonAttempt = async <T>(
    params: ResolveTargetRoleDecisionParams,
    prompt: string,
    operation: ChatLlmObservedOperation,
    parse: (rawText: string) => T | null,
): Promise<{ readonly decision: T | null; readonly rawText: string }> => {
    try {
        const rawText = await params.textCompletion.complete(prompt, {
            operation,
            userId: params.userId,
            sessionId: params.conversationId,
            feature: "chat",
            responseFormat: "json",
        });
        const decision = parse(rawText);
        recordChatLlmParseEvent(params.observer, {
            operation,
            rawText,
            parseStatus: decision ? "success" : "fallback",
            userId: params.userId,
            sessionId: params.conversationId,
        }, decision ? undefined : new Error("Invalid target-role decision"));
        return { decision, rawText };
    } catch (error: unknown) {
        recordChatLlmParseEvent(params.observer, {
            operation,
            rawText: "",
            parseStatus: "fallback",
            userId: params.userId,
            sessionId: params.conversationId,
        }, error);
        return { decision: null, rawText: "" };
    }
};

export const resolveTargetRoleDecision = async (
    params: ResolveTargetRoleDecisionParams,
): Promise<TargetRoleDecision> => {
    const targetState = params.conversation.onboardingFlow?.nearTermTarget;
    const previousAssistantMessage = [...params.conversation.messages]
        .reverse()
        .find((message) => message.role === "assistant")?.content;
    const fallbackQuestion = buildTargetRoleFallbackReply(previousAssistantMessage);
    const prompt = buildTargetRoleDecisionPrompt(
        params.conversation,
        params.latestUserMessage,
        params.userAccountContext,
    );
    const clarificationCount = targetState?.clarificationCount ?? 0;
    const mustOfferChoices = clarificationCount >= MAX_OPEN_TARGET_ROLE_QUESTIONS
        && (targetState?.suggestedRoles?.length ?? 0) === 0;
    const parseDecision = (rawText: string): TargetRoleDecision | null => {
        const decision = parseTargetRoleDecision(rawText, params.latestUserMessage);
        if (decision?.status !== "NEEDS_CLARIFICATION") {
            return decision;
        }
        const repeatedSubject = (targetState?.coveredSubjects ?? []).includes(decision.subject);
        const repeatedQuestion = previousAssistantMessage?.trim().toLowerCase()
            === decision.question.trim().toLowerCase();
        return mustOfferChoices || repeatedSubject || repeatedQuestion ? null : decision;
    };
    const first = await completeJsonAttempt(
        params,
        prompt,
        "chat.onboarding.target_role",
        parseDecision,
    );
    const retry = first.decision
        ? first
        : await completeJsonAttempt(
            params,
            buildTargetRoleCorrectionPrompt(prompt, first.rawText),
            "chat.onboarding.target_role.retry",
            parseDecision,
        );
    const initialResolved = retry.decision;
    if (!initialResolved || initialResolved.status === "NEEDS_CLARIFICATION") {
        return initialResolved ?? {
            status: "NEEDS_CLARIFICATION",
            question: fallbackQuestion,
            subject: "target_direction",
            discoveryFacts: {},
        };
    }
    const optionsReview = initialResolved.status === "ROLE_OPTIONS"
        ? await completeJsonAttempt(
            params,
            buildTargetRoleOptionsReviewPrompt(
                params.conversation,
                params.latestUserMessage,
                JSON.stringify(initialResolved),
            ),
            "chat.onboarding.target_role.review",
            (rawText) => {
                const decision = parseTargetRoleOptionsReviewDecision(rawText, params.latestUserMessage);
                if (decision?.verdict !== "RESUME_DISCOVERY") {
                    return decision;
                }
                const repeatedSubject = (targetState?.coveredSubjects ?? []).includes(decision.subject);
                const repeatedQuestion = previousAssistantMessage?.trim().toLowerCase()
                    === decision.question.trim().toLowerCase();
                return repeatedSubject || repeatedQuestion ? null : decision;
            },
        )
        : null;
    if (optionsReview?.decision?.verdict === "RESUME_DISCOVERY") {
        return {
            status: "NEEDS_CLARIFICATION",
            question: optionsReview.decision.question,
            subject: optionsReview.decision.subject,
            discoveryFacts: optionsReview.decision.discoveryFacts,
            rejectedSuggestedRoles: optionsReview.decision.rejectedSuggestedRoles,
        };
    }
    const reviewedReady = optionsReview?.decision?.verdict === "READY"
        ? {
            status: "READY" as const,
            targetRole: optionsReview.decision.targetRole,
            discoveryFacts: initialResolved.discoveryFacts,
        }
        : null;
    const resolved = reviewedReady ?? initialResolved;
    const optionsFallback = initialResolved.status === "ROLE_OPTIONS" ? initialResolved : null;
    if (resolved.status === "ROLE_OPTIONS") {
        const discoveryFactCount = Object.keys({
            ...(targetState?.discoveryFacts ?? {}),
            ...resolved.discoveryFacts,
        }).length;
        const previousRoleNames = [
            ...(targetState?.suggestedRoles ?? []),
            ...(targetState?.rejectedSuggestedRoles ?? []),
        ].map((role) => role.trim().toLowerCase());
        const repeatsPreviousRole = resolved.roles.some(
            (role) => previousRoleNames.includes(role.title.trim().toLowerCase()),
        );
        const reviewerKeptOptions = optionsReview?.decision?.verdict === "KEEP_OPTIONS";
        const hasEnoughDiscoveryFacts = discoveryFactCount >= MIN_TARGET_DISCOVERY_FACTS_FOR_OPTIONS;
        if (!repeatsPreviousRole && (mustOfferChoices || hasEnoughDiscoveryFacts || reviewerKeptOptions)) {
            return resolved;
        }
        return {
            status: "NEEDS_CLARIFICATION",
            question: fallbackQuestion,
            subject: "target_direction",
            discoveryFacts: resolved.discoveryFacts,
        };
    }

    const groundingPrompt = buildTargetRoleGroundingPrompt(
        params.conversation,
        params.latestUserMessage,
        resolved.targetRole,
    );
    const parseGrounding = (rawText: string): TargetRoleGroundingDecision | null =>
        parseTargetRoleGroundingDecision(
            rawText,
            resolved.targetRole,
            params.latestUserMessage,
            params.conversation.onboardingFlow?.nearTermTarget?.suggestedRoles,
            previousAssistantMessage,
        );
    const grounding = await completeJsonAttempt(
        params,
        groundingPrompt,
        "chat.onboarding.target_role.verify",
        parseGrounding,
    );
    if (grounding.decision?.kind === "GROUNDED_ROLE") {
        return { ...resolved, targetRole: grounding.decision.normalizedTargetRole };
    }
    if (grounding.decision?.kind === "GROUNDED_CONFIRMATION") {
        return { ...resolved, targetRole: grounding.decision.normalizedTargetRole };
    }
    if (grounding.decision?.kind === "GROUNDED_SUGGESTION") {
        return resolved;
    }
    if (grounding.decision?.kind === "NEEDS_CLARIFICATION") {
        if (optionsFallback) {
            return optionsFallback;
        }
        return {
            status: "NEEDS_CLARIFICATION",
            question: grounding.decision.question,
            subject: "target_role",
            discoveryFacts: resolved.discoveryFacts,
        };
    }

    const groundingRetry = await completeJsonAttempt(
        params,
        buildTargetRoleGroundingCorrectionPrompt(groundingPrompt, grounding.rawText),
        "chat.onboarding.target_role.verify.retry",
        parseGrounding,
    );
    if (groundingRetry.decision?.kind === "GROUNDED_ROLE") {
        return { ...resolved, targetRole: groundingRetry.decision.normalizedTargetRole };
    }
    if (groundingRetry.decision?.kind === "GROUNDED_CONFIRMATION") {
        return { ...resolved, targetRole: groundingRetry.decision.normalizedTargetRole };
    }
    if (groundingRetry.decision?.kind === "GROUNDED_SUGGESTION") {
        return resolved;
    }
    if (groundingRetry.decision?.kind === "NEEDS_CLARIFICATION") {
        if (optionsFallback) {
            return optionsFallback;
        }
        return {
            status: "NEEDS_CLARIFICATION",
            question: groundingRetry.decision.question,
            subject: "target_role",
            discoveryFacts: resolved.discoveryFacts,
        };
    }
    if (optionsFallback) {
        return optionsFallback;
    }
    return {
        status: "NEEDS_CLARIFICATION",
        question: fallbackQuestion,
        subject: "target_direction",
        discoveryFacts: resolved.discoveryFacts,
    };
};
