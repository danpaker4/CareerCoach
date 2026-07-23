import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import {
    buildDisambiguationQuestion,
    buildFollowUpAnswer,
} from "./job-follow-up-answer.service";
import { resolveJobSelectionFromFollowUpMessage } from "./job-follow-up-answer.utils";

export const tryFollowUpShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    const hasStoredJobs = (jobContext?.lastReturnedJobs.length ?? 0) > 0;
    if (!hasStoredJobs || !ctx.followUpIntent.isFollowUp || ctx.followUpIntent.isExplicitNewSearch || !jobContext) {
        return null;
    }
    const resolution = resolveJobSelectionFromFollowUpMessage(
        ctx.normalizedMessage,
        jobContext.selectedJobSnapshot,
        jobContext.lastReturnedJobs
    );
    if (resolution.status === "missing") {
        const missingMessage = "I do not have stored jobs in context yet. Ask me for jobs first, and I will keep them for follow-up questions.";
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, missingMessage);
        return { reply: missingMessage, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    }
    if (resolution.status === "ambiguous") {
        const question = buildDisambiguationQuestion(resolution.options);
        await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, question);
        return { reply: question, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    }

    const followUpReply = buildFollowUpAnswer(
        ctx.followUpIntent.requestedField,
        resolution.job,
        ctx.normalizedMessage,
        ctx.userCareerProfile
    );
    await deps.conversationService.setSelectedJob(ctx.userId, ctx.conversationId, resolution.job);
    await deps.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, followUpReply);
    return { reply: followUpReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
};
