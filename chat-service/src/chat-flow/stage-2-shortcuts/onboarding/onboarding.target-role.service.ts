import { recordChatLlmParseEvent } from "../../shared/llm/chat.llm.observability.utils";
import type { ChatLlmObservedOperation } from "../../shared/llm/chat.llm.types";
import { ONBOARDING_DIFFERENT_ROLE_REPLY } from "./onboarding.types";
import { MAX_OPEN_TARGET_ROLE_QUESTIONS } from "./onboarding.target-role.consts";
import {
    parseTargetRoleDecision,
    parseTargetRoleGroundingDecision,
} from "./onboarding.target-role.llm.utils";
import {
    buildTargetRoleCorrectionPrompt,
    buildTargetRoleDecisionPrompt,
    buildTargetRoleGroundingPrompt,
} from "./onboarding.target-role.prompt.utils";
import { matchSuggestedRoleTitle } from "./onboarding.target-role.utils";
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
    const selectedSuggestedRole = matchSuggestedRoleTitle(
        params.latestUserMessage,
        targetState?.suggestedRoles ?? [],
    );
    if (selectedSuggestedRole) {
        return { status: "READY", targetRole: selectedSuggestedRole, discoveryFacts: {} };
    }

    const prompt = buildTargetRoleDecisionPrompt(
        params.conversation,
        params.latestUserMessage,
        params.userAccountContext,
    );
    const clarificationCount = targetState?.clarificationCount ?? 0;
    const mustOfferChoices = clarificationCount >= MAX_OPEN_TARGET_ROLE_QUESTIONS;
    const parseDecision = (rawText: string): TargetRoleDecision | null => {
        const decision = parseTargetRoleDecision(rawText);
        return mustOfferChoices && decision?.status === "NEEDS_CLARIFICATION" ? null : decision;
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
    const resolved = retry.decision;
    if (!resolved || resolved.status === "NEEDS_CLARIFICATION") {
        return resolved ?? {
            status: "NEEDS_CLARIFICATION",
            question: ONBOARDING_DIFFERENT_ROLE_REPLY,
            subject: "target_direction",
            discoveryFacts: {},
        };
    }
    if (resolved.status === "ROLE_OPTIONS") {
        return resolved;
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
        );
    const grounding = await completeJsonAttempt(
        params,
        groundingPrompt,
        "chat.onboarding.target_role.verify",
        parseGrounding,
    );
    if (grounding.decision?.kind === "GROUNDED_ROLE" || grounding.decision?.kind === "GROUNDED_SUGGESTION") {
        return resolved;
    }
    if (grounding.decision?.kind === "NEEDS_CLARIFICATION") {
        return {
            status: "NEEDS_CLARIFICATION",
            question: grounding.decision.question,
            subject: "target_role",
            discoveryFacts: resolved.discoveryFacts,
        };
    }

    const groundingRetry = await completeJsonAttempt(
        params,
        buildTargetRoleCorrectionPrompt(groundingPrompt, grounding.rawText),
        "chat.onboarding.target_role.verify.retry",
        parseGrounding,
    );
    if (
        groundingRetry.decision?.kind === "GROUNDED_ROLE"
        || groundingRetry.decision?.kind === "GROUNDED_SUGGESTION"
    ) {
        return resolved;
    }
    if (groundingRetry.decision?.kind === "NEEDS_CLARIFICATION") {
        return {
            status: "NEEDS_CLARIFICATION",
            question: groundingRetry.decision.question,
            subject: "target_role",
            discoveryFacts: resolved.discoveryFacts,
        };
    }
    return {
        status: "NEEDS_CLARIFICATION",
        question: ONBOARDING_DIFFERENT_ROLE_REPLY,
        subject: "target_direction",
        discoveryFacts: resolved.discoveryFacts,
    };
};
