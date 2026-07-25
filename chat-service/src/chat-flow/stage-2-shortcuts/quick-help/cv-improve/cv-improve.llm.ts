import type { TextCompletionPort } from "../../../../litellm/text-completion/text-completion.types";
import { parseJsonObjectFromLlm } from "../shared/quick-help.utils";
import { buildCvImprovePrompt } from "./cv-improve.prompt.utils";
import type { CvImproveLlmResult } from "./cv-improve.types";

const hasCvExcerptInContext = (userAccountContext: string): boolean =>
    /CV excerpt \(truncated\):/i.test(userAccountContext);

const extractAdviceReply = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return "";
    }

    const parsed = parseJsonObjectFromLlm(trimmed);
    const jsonReply = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";
    if (jsonReply.length > 0) {
        return jsonReply;
    }

    // Local models often ignore JSON instructions — use the prose reply as-is.
    const withoutFences = trimmed.replace(/^```(?:json|text)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return withoutFences;
};

export const generateCvImproveAdvice = async (
    textCompletion: TextCompletionPort,
    params: { userAccountContext: string; userId: string; followUpMessage?: string }
): Promise<CvImproveLlmResult> => {
    const hasCvExcerpt = hasCvExcerptInContext(params.userAccountContext);
    console.info(
        `[CHAT][CV_IMPROVE] userId=${params.userId} hasCvExcerpt=${hasCvExcerpt} contextChars=${params.userAccountContext.length}`
    );

    if (!hasCvExcerpt) {
        return {
            reply:
                "I still don't have readable CV text in this chat turn. Use the CV button to upload a PDF, wait for “uploaded and read”, then say \"ready\".",
        };
    }

    const raw = await textCompletion.complete(
        buildCvImprovePrompt({
            userAccountContext: params.userAccountContext,
            followUpMessage: params.followUpMessage,
        }),
        {
            operation: "chat.quick_help.cv_improve",
            userId: params.userId,
        }
    );
    const reply = extractAdviceReply(raw);
    if (reply.length > 0) {
        return { reply };
    }

    return {
        reply:
            "I read your CV, but I couldn't format the review just now. Ask again (for example: \"review my experience section\") and I'll retry.",
    };
};
