import type { TextCompletionRequest } from "../../../../litellm/text-completion/text-completion.types";

export const buildCvImprovePrompt = (params: {
    userAccountContext: string;
    followUpMessage?: string;
}): TextCompletionRequest => {
    const followUpBlock =
        params.followUpMessage && params.followUpMessage.trim().length > 0
            ? `\nUser follow-up question:\n${params.followUpMessage.trim()}\n`
            : "";

    return {
        systemPrompt: `You are a career coach reviewing the user's CV / profile for concrete improvements.

Instructions:
- Ground every suggestion in the supplied CV excerpt and profile data.
- Call out specific strengths and gaps (summary, role titles, bullets, impact metrics, skills, clarity, structure).
- Prefer actionable edits the candidate can apply (rewrite examples, what to add/remove).
- Do not invent employers, dates, or achievements that are not supported by the data.
- If the CV excerpt is missing or too thin, say exactly what is missing.
- Be specific and useful; use short bullets. Aim for 6-12 focused points when enough CV text is present.

Write the coaching reply as plain text only (no JSON, no markdown code fences).`,
        userPrompt: `User background (includes CV text when available):
${params.userAccountContext}
${followUpBlock}`,
        responseFormat: "text",
    };
};
