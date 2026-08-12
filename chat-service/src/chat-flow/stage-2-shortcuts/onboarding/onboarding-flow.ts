import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext, SendMessagePreparedContext } from "../../chat-flow.types";
import { extractNearTermSearchQuery } from "../../stage-1-prepare-context/mode-detection/conversation-mode.pivot.utils";
import {
    CONVERSATION_MODE,
    DEFAULT_MODE_DETECTION_RESULT,
} from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import type { ConversationModeDetectionResult } from "../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import { completeAllStages } from "../../../routes/conversation/conversation.stage.utils";
import { defaultOnboardingFlow } from "../../../routes/conversation/conversation.utils";
import type { OnboardingFlow } from "../../../routes/conversation/conversation.model";
import { runDreamJobFlow } from "../dream-job/dream-job-flow";
import { runNearTermSearchFlow } from "../near-term/near-term-search-flow";
import { buildBackgroundReviewPrompt, buildOnboardingPrompt } from "./onboarding.prompt.utils";
import { parseOnboardingLlmDecisionFromJson } from "./onboarding.llm.utils";
import { applyOnboardingDecision } from "./onboarding.state.utils";
import { ONBOARDING_PARSE_FALLBACK_REPLY } from "./onboarding.types";
import type { OnboardingLlmDecision } from "./onboarding.types";
import { recordChatLlmParseEvent } from "../../shared/llm/chat.llm.observability.utils";
import { resolveTargetRoleDecision } from "./onboarding.target-role.service";
import { formatTargetRoleOptionsReply } from "./onboarding.target-role.utils";

const completeBackgroundAndTimelineStages = (completedStageIds: readonly string[]): string[] => {
    const next = new Set(completedStageIds);
    next.add("achievements");
    next.add("timeline");
    return [...next];
};

const buildModeDetectionForHandoff = (
    onboardingFlow: OnboardingFlow,
    latestUserMessage: string,
): ConversationModeDetectionResult => {
    const mode = onboardingFlow.initialMode ?? "GUIDED";
    if (mode === "NEAR_TERM") {
        const searchQuery = onboardingFlow.nearTermTarget?.searchQuery?.trim()
            || onboardingFlow.nearTermTarget?.targetRole?.trim()
            || (onboardingFlow.completed && !onboardingFlow.nearTermTarget
                ? onboardingFlow.background?.role?.trim()
                : undefined)
            || extractNearTermSearchQuery(latestUserMessage)
            || undefined;
        return {
            ...DEFAULT_MODE_DETECTION_RESULT,
            mode: CONVERSATION_MODE.NEAR_TERM,
            isReady: Boolean(searchQuery),
            readinessScore: searchQuery ? 100 : 0,
            shouldSearchJobs: Boolean(searchQuery),
            searchQuery,
            missingInformation: searchQuery ? [] : ["target role"],
        };
    }
    if (mode === "DREAMJOB") {
        return {
            ...DEFAULT_MODE_DETECTION_RESULT,
            mode: CONVERSATION_MODE.DREAMJOB,
            isReady: false,
            readinessScore: 0,
            shouldSearchJobs: false,
            missingInformation: ["dream job title"],
        };
    }
    return {
        ...DEFAULT_MODE_DETECTION_RESULT,
        mode: CONVERSATION_MODE.GUIDED,
    };
};

const persistOnboardingProgress = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext,
    nextFlow: OnboardingFlow,
): Promise<void> => {
    await deps.conversationService.updateOnboardingFlow(ctx.userId, ctx.conversationId, nextFlow);

    if (!nextFlow.completed) {
        return;
    }

    const stageProgress = ctx.conversationAfterUserMessage.stageProgress;
    if (nextFlow.initialMode === "GUIDED") {
        const completedStageIds = completeBackgroundAndTimelineStages(stageProgress.completedStageIds ?? []);
        await deps.conversationService.updateStageProgress(ctx.userId, ctx.conversationId, {
            ...stageProgress,
            completedStageIds,
            currentStageId: "preferences",
            currentStageIndex: completedStageIds.length,
            awaitingConfirmation: false,
        });
        return;
    }

    await deps.conversationService.updateStageProgress(
        ctx.userId,
        ctx.conversationId,
        completeAllStages(stageProgress),
    );
};

const resolveGeneralOnboardingDecision = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext,
    currentFlow: OnboardingFlow,
): Promise<OnboardingLlmDecision> => {
    const prompt = buildOnboardingPrompt(
        ctx.conversationAfterUserMessage,
        ctx.normalizedMessage,
        ctx.userAccountContext,
        currentFlow,
    );
    try {
        const rawText = await deps.textCompletion.complete(prompt, {
            operation: "chat.onboarding",
            userId: ctx.userId,
            sessionId: ctx.conversationId,
            feature: "chat",
            responseFormat: "json",
        });
        const decision = parseOnboardingLlmDecisionFromJson(rawText);
        recordChatLlmParseEvent(deps.llmObserver, {
            operation: "chat.onboarding",
            rawText,
            parseStatus: "success",
            userId: ctx.userId,
            sessionId: ctx.conversationId,
        });
        if (!currentFlow.backgroundResolved && decision.background.status === "FOUND") {
            const reviewRawText = await deps.textCompletion.complete(
                buildBackgroundReviewPrompt(ctx.normalizedMessage, decision, ctx.userAccountContext),
                {
                    operation: "chat.onboarding.background_review",
                    userId: ctx.userId,
                    sessionId: ctx.conversationId,
                    feature: "chat",
                    responseFormat: "json",
                },
            );
            const reviewedDecision = parseOnboardingLlmDecisionFromJson(reviewRawText);
            recordChatLlmParseEvent(deps.llmObserver, {
                operation: "chat.onboarding.background_review",
                rawText: reviewRawText,
                parseStatus: "success",
                userId: ctx.userId,
                sessionId: ctx.conversationId,
            });
            return reviewedDecision;
        }
        return decision;
    } catch (error: unknown) {
        recordChatLlmParseEvent(deps.llmObserver, {
            operation: "chat.onboarding",
            rawText: "",
            parseStatus: "fallback",
            userId: ctx.userId,
            sessionId: ctx.conversationId,
        }, error);
        return {
            response: currentFlow.backgroundResolved
                ? ONBOARDING_PARSE_FALLBACK_REPLY
                : "Before we continue, I'd like to understand your starting point. Can you tell me about your work experience, studies, projects, or technical background?",
            background: currentFlow.background ?? { status: "UNKNOWN" },
            mode: null,
            advance: false,
        };
    }
};

const resolveOnboardingDecision = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext,
    currentFlow: OnboardingFlow,
): Promise<OnboardingLlmDecision> => {
    if (currentFlow.nearTermTarget?.step !== "discovering_target") {
        return await resolveGeneralOnboardingDecision(deps, ctx, currentFlow);
    }

    const targetDecision = await resolveTargetRoleDecision({
        textCompletion: deps.textCompletion,
        conversation: ctx.conversationAfterUserMessage,
        latestUserMessage: ctx.normalizedMessage,
        userAccountContext: ctx.userAccountContext,
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        observer: deps.llmObserver,
    });
    if (targetDecision.status === "READY") {
        return {
            response: `Got it — ${targetDecision.targetRole}.`,
            background: currentFlow.background ?? { status: "UNKNOWN" },
            mode: null,
            advance: true,
            targetRole: targetDecision.targetRole,
            targetRoleReady: true,
            targetDiscoveryFacts: targetDecision.discoveryFacts,
        };
    }
    if (targetDecision.status === "ROLE_OPTIONS") {
        return {
            response: formatTargetRoleOptionsReply(targetDecision.summary, targetDecision.roles),
            background: currentFlow.background ?? { status: "UNKNOWN" },
            mode: null,
            advance: false,
            targetRoleOptions: targetDecision.roles.map((role) => role.title),
            targetDiscoveryFacts: targetDecision.discoveryFacts,
        };
    }
    return {
        response: targetDecision.question,
        background: currentFlow.background ?? { status: "UNKNOWN" },
        mode: null,
        advance: false,
        targetRoleReady: false,
        targetDiscoveryFacts: targetDecision.discoveryFacts,
        targetDiscoverySubject: targetDecision.subject,
    };
};

export const runOnboardingFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext,
): Promise<ChatMessageResponse> => {
    const currentFlow = ctx.conversationAfterUserMessage.onboardingFlow ?? defaultOnboardingFlow();
    const decision = await resolveOnboardingDecision(deps, ctx, currentFlow);

    const step = applyOnboardingDecision(currentFlow, decision, ctx.normalizedMessage);
    await persistOnboardingProgress(deps, ctx, step.onboardingFlow);

    const modeDetection = step.onboardingFlow.completed || step.onboardingFlow.initialMode
        ? buildModeDetectionForHandoff(step.onboardingFlow, ctx.normalizedMessage)
        : DEFAULT_MODE_DETECTION_RESULT;

    const preparedCtx: SendMessagePreparedContext = {
        ...ctx,
        conversationAfterUserMessage: {
            ...ctx.conversationAfterUserMessage,
            onboardingFlow: step.onboardingFlow,
        },
        modeDetection,
    };

    if (step.completedThisTurn && step.onboardingFlow.initialMode === "NEAR_TERM" && modeDetection.shouldSearchJobs) {
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, step.reply);
        return await runNearTermSearchFlow(deps, preparedCtx, modeDetection.searchQuery);
    }

    if (step.completedThisTurn && step.onboardingFlow.initialMode === "DREAMJOB") {
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, step.reply);
        return await runDreamJobFlow(deps, preparedCtx);
    }

    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, step.reply);
    return {
        reply: step.reply,
        mode: modeDetection.mode,
        confidenceSummary: ctx.confidenceSummary,
    };
};
