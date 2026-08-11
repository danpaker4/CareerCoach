import type { SanitizedJob } from "../../../../routes/conversation/job-in-conversation.types";

const MAX_CANDIDATES = 10;

export const buildPipelineJobSelectionPrompt = (
    userMessage: string,
    candidates: readonly SanitizedJob[],
    focusJobId: string | null,
): string => {
    const listed = candidates.slice(0, MAX_CANDIDATES).map((job, index) => ({
        index: index + 1,
        jobId: job.id,
        title: job.title,
        company: job.company,
        seniority: job.seniority,
        isFocus: focusJobId !== null && job.id === focusJobId,
    }));

    return `
You match the user's message to one job from the candidate list.
Return ONLY compact JSON, no markdown:
{"jobId":"<exact jobId from candidates or null>","confidence":"high"|"low"}

Rules:
- Prefer the job that best matches company and/or title the user named (spelling variants and spacing count, e.g. "checkpoint" = "Check Point").
- Ordinals like "first" / "the 2nd one" map to the listed index.
- Bare accept with no specifier ("yes", "add it", "sure") → return the candidate marked isFocus=true when present; otherwise null.
- If none clearly match, or several match equally, return {"jobId":null,"confidence":"low"}.
- jobId must be copied exactly from the candidates list. Never invent an id.

Candidates:
${JSON.stringify(listed)}

User message:
${userMessage}
`.trim();
};
