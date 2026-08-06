import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { CONVERSATION_MODE } from "../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { decideDreamJobStep } from "../../shared/llm/chat.llm.service";
import { sanitizeReply } from "../../stage-6-present-jobs/presentation/chat.validation.service";
import {
    inferDreamJobTitleFromMessage,
    isAffirmativeConfirmation,
    isNegativeConfirmation,
    normalizeDreamJobTitle,
} from "./chat.dream-job.utils";

export const runDreamJobFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse> => {
    const dreamJobFlow = ctx.conversationAfterUserMessage.dreamJobFlow;
    const decision = await decideDreamJobStep(
        deps.textCompletion,
        ctx.conversationAfterUserMessage,
        ctx.normalizedMessage,
        ctx.userAccountContext,
        dreamJobFlow
    );

    const detectedTitle =
        ctx.modeDetection.dreamJobTitle !== undefined && ctx.modeDetection.dreamJobTitle.length > 0
            ? normalizeDreamJobTitle(ctx.modeDetection.dreamJobTitle)
            : undefined;
    const inferredTitle = inferDreamJobTitleFromMessage(ctx.normalizedMessage) ?? detectedTitle;
    const pendingTitle =
        decision.proposedDreamJobTitle !== undefined && decision.proposedDreamJobTitle.length > 0
            ? normalizeDreamJobTitle(decision.proposedDreamJobTitle)
            : dreamJobFlow?.proposedTitle !== undefined && dreamJobFlow.proposedTitle.length > 0
              ? dreamJobFlow.proposedTitle
              : inferredTitle !== undefined
                ? inferredTitle
                : undefined;

    const rulesConfirmed =
        dreamJobFlow?.awaitingConfirmation === true &&
        isAffirmativeConfirmation(ctx.normalizedMessage) &&
        !isNegativeConfirmation(ctx.normalizedMessage);

    const userConfirmed =
        pendingTitle !== undefined &&
        (decision.userConfirmed || rulesConfirmed) &&
        !isNegativeConfirmation(ctx.normalizedMessage);

    if (userConfirmed && pendingTitle !== undefined) {
        const saved = await deps.externalService.updateDreamJob(ctx.userId, pendingTitle, ctx.authorization);
        if (!saved) {
            const failureReply =
                "I couldn't save your dream job right now. Please try again from your profile, or confirm once more.";
            await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, failureReply);
            return { reply: failureReply, mode: CONVERSATION_MODE.DREAMJOB, confidenceSummary: ctx.confidenceSummary };
        }

        await deps.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, undefined);
        const roadmapResult = await deps.dreamJobRoadmapCreator
            .create(ctx.userId, pendingTitle)
            .catch(() => ({ created: false as const, reason: "generation_failed" as const }));
        const successReply = roadmapResult.created
            ? `Saved ${pendingTitle} as your dream job and created a 4-stage roadmap toward it. You can review it on My Roadmap.`
            : `Saved ${pendingTitle} as your dream job, but I couldn't create the roadmap right now. You can create it from My Roadmap.`;
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, successReply);
        return { reply: successReply, mode: CONVERSATION_MODE.DREAMJOB, confidenceSummary: ctx.confidenceSummary };
    }

    if (isNegativeConfirmation(ctx.normalizedMessage) && dreamJobFlow?.awaitingConfirmation === true) {
        await deps.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, {
            awaitingConfirmation: false,
        });
    } else if (pendingTitle !== undefined && (decision.awaitingConfirmation || inferredTitle !== undefined)) {
        await deps.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, {
            proposedTitle: pendingTitle,
            awaitingConfirmation: true,
        });
    }

    const sanitized = sanitizeReply(decision.reply);
    const reply =
        pendingTitle !== undefined &&
        dreamJobFlow?.awaitingConfirmation !== true &&
        (decision.awaitingConfirmation || inferredTitle !== undefined)
            ? `It sounds like your long-term dream role is ${pendingTitle}. Should I save "${pendingTitle}" as your dream job?`
            : sanitized;
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return { reply, mode: CONVERSATION_MODE.DREAMJOB, confidenceSummary: ctx.confidenceSummary };
};
