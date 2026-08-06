import type { DreamJobLlmDecision } from "./chat.dream-job.types";
import { normalizeDreamJobTitle } from "./chat.dream-job.utils";

export const DREAM_JOB_LLM_PARSE_FALLBACK_REPLY =
    "Tell me more about the future role you want to grow into — what impact or field matters most to you?";

export const parseDreamJobLlmDecisionFromJson = (rawText: string): DreamJobLlmDecision => {
    const parsed: unknown = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("LLM returned non-object dream job payload");
    }

    const obj = parsed as Record<string, unknown>;
    const rawTitle = typeof obj.proposedDreamJobTitle === "string" ? obj.proposedDreamJobTitle : undefined;
    const proposedDreamJobTitle =
        rawTitle !== undefined && rawTitle.trim().length > 0 ? normalizeDreamJobTitle(rawTitle) : undefined;

    return {
        reply: typeof obj.reply === "string" ? obj.reply : DREAM_JOB_LLM_PARSE_FALLBACK_REPLY,
        proposedDreamJobTitle,
        awaitingConfirmation: obj.awaitingConfirmation === true,
        userConfirmed: obj.userConfirmed === true,
    };
};
