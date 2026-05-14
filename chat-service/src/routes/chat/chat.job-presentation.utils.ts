import type { JobSearchResultItem, ChatJobMatchRow } from "./chat.types";
import {
    GROWTH_POTENTIAL_GOOD_COPY,
    GROWTH_POTENTIAL_MODERATE_COPY,
    GROWTH_POTENTIAL_SCORE_THRESHOLD,
    NEXT_STEP_DEFAULT_APPLY,
    NEXT_STEP_STRENGTHEN_PREFIX,
    NEXT_STEP_STRENGTHEN_SUFFIX,
} from "./chat.service.consts";
import type { RankedJobResult } from "./ranking/job-ranking.types";

export const mapRankedJobResultToChatMatchRow = (item: RankedJobResult): ChatJobMatchRow => ({
    jobId: item.jobId,
    title: item.job.jobTitle,
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

export const buildDeterministicJobsReply = (
    jobs: readonly { jobTitle: string; company?: string; seniority: string }[],
    directionHint?: string
): string => {
    const topJobs = jobs.slice(0, 4);
    if (topJobs.length === 0) {
        return directionHint
            ? `I searched for ${directionHint} but did not find exact matches yet. I can broaden this to adjacent roles.`
            : "I could not find exact matches yet. I can broaden this to adjacent roles.";
    }
    const lead = directionHint
        ? `I found real opportunities for ${directionHint}.`
        : "I found real opportunities that can fit your direction.";
    const list = topJobs
        .map((job) => {
            const companyPart = job.company && job.company.trim().length > 0 ? ` at ${job.company.trim()}` : "";
            return `- ${job.jobTitle}${companyPart}\n  Seniority: ${job.seniority}`;
        })
        .join("\n");
    return `${lead}\n${list}`;
};

export const buildFocusedDeterministicJobReply = (
    job: { jobTitle: string; company?: string; seniority: string },
    directionHint?: string
): string => {
    const companyPart = job.company && job.company.trim().length > 0 ? ` at ${job.company.trim()}` : "";
    const direction = directionHint ? `For ${directionHint}, ` : "";
    return `${direction}here is a strong match:\n${job.jobTitle}${companyPart}\nSeniority: ${job.seniority}`;
};

export const withPipelineClosing = (reply: string): string => {
    const trimmed = reply.trim();
    const lowered = trimmed.toLowerCase();
    if (lowered.includes("pipeline") && lowered.includes("?")) {
        return trimmed;
    }
    return `${trimmed}\n\nWould you like to move forward with this role and add it to your pipeline?`;
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
