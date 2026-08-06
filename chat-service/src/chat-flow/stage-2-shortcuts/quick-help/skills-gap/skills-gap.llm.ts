import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import { buildSkillsGapPrompt } from "./skills-gap.prompt.utils";
import type { SkillsGapLlmResult } from "./skills-gap.types";
import { skillsGapLlmResultSchema } from "./skills-gap.schema";
import { parseLlmJsonWithSchema } from "../../../shared/llm/chat.llm.validation.utils";

export const generateSkillsGapAdvice = async (
    textCompletion: TextCompletionPort,
    params: { targetRole: string; userAccountContext: string; userId: string }
): Promise<SkillsGapLlmResult> => {
    const raw = await textCompletion.complete(
        buildSkillsGapPrompt({
            targetRole: params.targetRole,
            userAccountContext: params.userAccountContext,
        }),
        { operation: "chat.quick_help.skills_gap", userId: params.userId }
    );
    const parsed = parseLlmJsonWithSchema("chat.quick_help.skills_gap", raw, skillsGapLlmResultSchema);
    if (parsed) {
        return parsed;
    }
    return {
        reply: `For ${params.targetRole}, focus on closing gaps versus your current background. Share more about tools you already use if you want a sharper list.`,
        skillsToLearn: [],
    };
};
