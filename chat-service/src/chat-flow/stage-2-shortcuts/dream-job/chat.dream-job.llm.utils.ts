import type { DreamJobLlmDecision } from "./chat.dream-job.types";
import { normalizeDreamJobTitle } from "./chat.dream-job.utils";
import { dreamJobLlmDecisionSchema } from "./chat.dream-job.schema";

export const DREAM_JOB_LLM_PARSE_FALLBACK_REPLY =
    "Tell me more about the future role you want to grow into — what impact or field matters most to you?";

export const parseDreamJobLlmDecisionFromJson = (rawText: string): DreamJobLlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    const obj = dreamJobLlmDecisionSchema.parse(parsed);
    const rawTitle = obj.proposedDreamJobTitle;
    const proposedDreamJobTitle =
        rawTitle !== undefined && rawTitle.trim().length > 0 ? normalizeDreamJobTitle(rawTitle) : undefined;

    return {
        reply: obj.reply,
        proposedDreamJobTitle,
        awaitingConfirmation: obj.awaitingConfirmation,
        userConfirmed: obj.userConfirmed,
    };
};
