import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import { CONVERSATION_MODE } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { sanitizeReply } from "../../../stage-6-present-jobs/presentation/chat.validation.service";
import { QUICK_HELP_EXIT_REPLY } from "../shared/quick-help.consts";
import { detectQuickHelpExitIntent } from "../shared/quick-help.utils";
import { QUICK_HELP_CV_ASK_UPLOAD, QUICK_HELP_CV_COACHING_CLOSING } from "./cv-improve.consts";
import { generateCvImproveAdvice } from "./cv-improve.llm";
import { hasUsableCvContext, isAffirmativeReadyMessage } from "./cv-improve.utils";

const deliverCvAdvice = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    followUpMessage?: string
): Promise<ChatMessageResponse> => {
    const advice = await generateCvImproveAdvice(deps.textCompletion, {
        userAccountContext: ctx.userAccountContext,
        userId: ctx.userId,
        followUpMessage,
    });
    const reply = `${sanitizeReply(advice.reply)}\n\n${QUICK_HELP_CV_COACHING_CLOSING}`;
    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
        kind: "cv_improve",
        step: "coaching",
    });
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return {
        reply,
        mode: CONVERSATION_MODE.CV_IMPROVE,
        confidenceSummary: ctx.confidenceSummary,
    };
};

export const runCvImproveFlow = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext,
    isNewIntent: boolean
): Promise<ChatMessageResponse> => {
    const flow = ctx.conversationAfterUserMessage.quickHelpFlow;

    if (detectQuickHelpExitIntent(ctx.normalizedMessage) && !isNewIntent) {
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, undefined);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, QUICK_HELP_EXIT_REPLY);
        return {
            reply: QUICK_HELP_EXIT_REPLY,
            mode: CONVERSATION_MODE.GUIDED,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    const usable = hasUsableCvContext({
        profile: ctx.profile,
        userAccountContext: ctx.userAccountContext,
    });

    if (isNewIntent || flow?.kind !== "cv_improve") {
        if (!usable) {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
                kind: "cv_improve",
                step: "awaiting_cv_or_proceed",
            });
            await deps.conversationService.appendAssistantMessage(
                ctx.userId,
                ctx.conversationId,
                QUICK_HELP_CV_ASK_UPLOAD
            );
            return {
                reply: QUICK_HELP_CV_ASK_UPLOAD,
                mode: CONVERSATION_MODE.CV_IMPROVE,
                confidenceSummary: ctx.confidenceSummary,
            };
        }
        return deliverCvAdvice(deps, ctx);
    }

    if (flow.step === "awaiting_cv_or_proceed" && !usable) {
        if (isAffirmativeReadyMessage(ctx.normalizedMessage)) {
            await deps.conversationService.appendAssistantMessage(
                ctx.userId,
                ctx.conversationId,
                QUICK_HELP_CV_ASK_UPLOAD
            );
            return {
                reply: QUICK_HELP_CV_ASK_UPLOAD,
                mode: CONVERSATION_MODE.CV_IMPROVE,
                confidenceSummary: ctx.confidenceSummary,
            };
        }
        const nudge =
            "I still don't have readable CV text. Upload a PDF with the button next to the chat input, then say \"ready\".";
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, nudge);
        return {
            reply: nudge,
            mode: CONVERSATION_MODE.CV_IMPROVE,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    if (flow.step === "awaiting_cv_or_proceed" && usable) {
        return deliverCvAdvice(deps, ctx);
    }

    // coaching: "ready" means regenerate overall advice, not a follow-up topic
    if (isAffirmativeReadyMessage(ctx.normalizedMessage)) {
        return deliverCvAdvice(deps, ctx);
    }

    return deliverCvAdvice(deps, ctx, ctx.normalizedMessage);
};
