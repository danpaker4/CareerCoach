import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import { parseJsonObjectFromLlm } from "../../../shared/llm/json-response.utils";
import { buildSkillsGapPrompt } from "./skills-gap.prompt.utils";
import type { SkillsGapLlmResult } from "./skills-gap.types";

export const generateSkillsGapAdvice = async (
    textCompletion: TextCompletionPort,
    params: { targetRole: string; userAccountContext: string; userId: string }
): Promise<SkillsGapLlmResult> => {
    const raw = await textCompletion.complete(
        buildSkillsGapPrompt({
            targetRole: params.targetRole,
            userAccountContext: params.userAccountContext,
        }),
        { operation: "chat.quick_help.skills_gap", userId: params.userId, responseFormat: "json" }
    );
    const parsed = parseJsonObjectFromLlm(raw);
    const reply = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";
    const skillsToLearn = Array.isArray(parsed?.skillsToLearn)
        ? parsed.skillsToLearn.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
    if (reply.length > 0) {
        return { reply, skillsToLearn };
    }
    return {
        reply: `For ${params.targetRole}, focus on closing gaps versus your current background. Share more about tools you already use if you want a sharper list.`,
        skillsToLearn: [],
    };
};
