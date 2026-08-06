import type { JobSearchResultItem, ChatJobMatchRow } from "../../api/shared/chat.types";
import {
    GROWTH_POTENTIAL_GOOD_COPY,
    GROWTH_POTENTIAL_MODERATE_COPY,
    GROWTH_POTENTIAL_SCORE_THRESHOLD,
    NEXT_STEP_DEFAULT_APPLY,
    NEXT_STEP_STRENGTHEN_PREFIX,
    NEXT_STEP_STRENGTHEN_SUFFIX,
} from "./chat.service.consts";
import type { RankedJobResult } from "../ranking/job-ranking.types";

export const mapRankedJobResultToChatMatchRow = (item: RankedJobResult): ChatJobMatchRow => ({
    jobId: item.jobId,
    title: item.job.title,
    matchScore: item.finalScore,
    matchReasons: item.reasons,
    possibleConcerns: item.concerns,
    missingSkills: item.missingSkills,
    growthPotential:
        item.scoreBreakdown.growthPotentialScore >= GROWTH_POTENTIAL_SCORE_THRESHOLD
            ? GROWTH_POTENTIAL_GOOD_COPY
            : GROWTH_POTENTIAL_MODERATE_COPY,
    whyThisFitsUser: item.reasons.join(" "),
    nextStepSuggestion:
        item.missingSkills.length > 0
            ? `${NEXT_STEP_STRENGTHEN_PREFIX}${item.missingSkills[0]}${NEXT_STEP_STRENGTHEN_SUFFIX}`
            : NEXT_STEP_DEFAULT_APPLY,
});

const buildFocusedDeterministicJobReply = (
    job: { title: string; company: string; seniority: string },
    directionHint?: string
): string => {
    const companyPart = job.company.trim().length > 0 ? ` at ${job.company.trim()}` : "";
    const direction = directionHint ? `For ${directionHint}, ` : "";
    return `${direction}here is a strong match:\n${job.title}${companyPart}\nSeniority: ${job.seniority}`;
};

export const withPipelineClosing = (reply: string): string => {
    const trimmed = reply.trim();
    const lowered = trimmed.toLowerCase();
    if (lowered.includes("pipeline") && lowered.includes("?")) {
        return trimmed;
    }
    return `${trimmed}\n\nWould you like to move forward with this role and add it to your pipeline?`;
};

/**
 * Closing line for a reply that carries job cards. A single match keeps the original
 * yes/no pipeline question; a list asks the user to name which card to act on.
 */
export const withJobSelectionClosing = (
    reply: string,
    jobs: readonly { company: string }[]
): string => {
    if (jobs.length <= 1) {
        return withPipelineClosing(reply);
    }
    const firstCompany = jobs[0]?.company.trim() ?? "";
    const namedExample = firstCompany.length > 0 ? ` or "add the ${firstCompany} role"` : "";
    return (
        `${reply.trim()}\n\nI listed ${jobs.length} matches above. Tell me which one to add to your pipeline — ` +
        `say "add the first one"${namedExample}. If none of them fit, say "none" and I can either broaden the ` +
        `search or save the role to your wishlist.`
    );
};

export const applyValidatedJobsFallback = (
    validatedJobs: JobSearchResultItem[],
    sanitizedReply: string,
    focusJob: JobSearchResultItem | null,
    directionHint?: string
): { validatedJobs: JobSearchResultItem[]; sanitizedReply: string } => {
    if (validatedJobs.length > 0 || !focusJob) {
        return { validatedJobs, sanitizedReply };
    }
    return {
        validatedJobs: [focusJob],
        sanitizedReply: buildFocusedDeterministicJobReply(focusJob, directionHint),
    };
};
