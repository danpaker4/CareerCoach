import type { ChatMessageResponse } from "../../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../../chat-flow.types";
import { CONVERSATION_MODE } from "../../../stage-1-prepare-context/mode-detection/conversation-mode.consts";
import { sanitizeReply } from "../../../stage-6-present-jobs/presentation/chat.validation.service";
import { QUICK_HELP_EXIT_REPLY } from "../shared/quick-help.consts";
import { detectQuickHelpExitIntent } from "../shared/quick-help.utils";
import { QUICK_HELP_SKILLS_ASK_ROLE } from "./skills-gap.consts";
import { generateSkillsGapAdvice } from "./skills-gap.llm";

export const runSkillsGapFlow = async (
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

    if (isNewIntent || flow?.kind !== "skills_gap") {
        await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, {
            kind: "skills_gap",
            step: "awaiting_role",
        });
        await deps.conversationService.appendAssistantMessage(
            ctx.userId,
            ctx.conversationId,
            QUICK_HELP_SKILLS_ASK_ROLE
        );
        return {
            reply: QUICK_HELP_SKILLS_ASK_ROLE,
            mode: CONVERSATION_MODE.SKILLS_GAP,
            confidenceSummary: ctx.confidenceSummary,
        };
    }

    const targetRole = ctx.normalizedMessage.trim();
    const advice = await generateSkillsGapAdvice(deps.textCompletion, {
        targetRole,
        userAccountContext: ctx.userAccountContext,
        userId: ctx.userId,
    });
    const reply = sanitizeReply(advice.reply);
    await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, undefined);
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
    return {
        reply,
        mode: CONVERSATION_MODE.GUIDED,
        confidenceSummary: ctx.confidenceSummary,
    };
};
