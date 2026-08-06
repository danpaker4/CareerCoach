import type { ChatMessageResponse } from "../../api/shared/chat.types";
import type { ChatFlowDeps, SendMessageBaseContext } from "../../chat-flow.types";
import { detectQuickHelpIntent } from "./shared/quick-help.utils";
import { runCvImproveFlow } from "./cv-improve/cv-improve-flow";
import { runInterviewPrepFlow } from "./interview-prep/interview-prep-flow";
import { runProfileJobMatchFlow } from "./profile-job-match/profile-job-match-flow";
import { runSkillsGapFlow } from "./skills-gap/skills-gap-flow";

/**
 * Handles sticky quick-help continuation and new quick-help intents.
 * A new quick-help intent always starts that flow (switching away from any active sticky help).
 * Returns null when this message is not a quick-help concern.
 */
export const tryQuickHelpShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessageBaseContext
): Promise<ChatMessageResponse | null> => {
    const activeFlow = ctx.conversationAfterUserMessage.quickHelpFlow;
    const intent = detectQuickHelpIntent(ctx.normalizedMessage);

    if (intent === "skills_gap") {
        return runSkillsGapFlow(deps, ctx, true);
    }
    if (intent === "cv_improve") {
        return runCvImproveFlow(deps, ctx, true);
    }
    if (intent === "interview_prep") {
        return runInterviewPrepFlow(deps, ctx, true);
    }
    if (intent === "profile_job_match") {
        if (activeFlow) {
            await deps.conversationService.updateQuickHelpFlow(ctx.userId, ctx.conversationId, undefined);
        }
        return runProfileJobMatchFlow(deps, ctx);
    }

    if (activeFlow?.kind === "skills_gap") {
        return runSkillsGapFlow(deps, ctx, false);
    }
    if (activeFlow?.kind === "cv_improve") {
        return runCvImproveFlow(deps, ctx, false);
    }
    if (activeFlow?.kind === "interview_prep") {
        return runInterviewPrepFlow(deps, ctx, false);
    }

    return null;
};
