import type { ChatMessageResponse, JobSearchResultItem } from "../../api/shared/chat.types";
import type { Conversation } from "../../../routes/conversation/conversation.model";
import type { UserCareerProfile } from "../../../routes/career-profile/career-profile.types";
import type { RoleExperienceEntry } from "../../../routes/external-chat-tools/role-experience.types";
import type { SanitizedJob, JobRecommendationContextState } from "../../../routes/conversation/job-in-conversation.types";
import type { ConfidenceSummary } from "../../stage-1-prepare-context/confidence/confidence.types";
import type { ConversationMode } from "../../stage-1-prepare-context/mode-detection/conversation-mode.types";
import type { ChatFlowDeps, SendMessagePreparedContext } from "../../chat-flow.types";
import { detectPipelineIntent } from "./pipeline-intent.service";
import { addJobToPipeline } from "./pipeline.service";
import { buildBroaderJobSearchFilters } from "../../stage-5-job-search/direction-filters/chat.direction.utils";
import { buildBroaderJobSearchPlan } from "../../stage-5-job-search/search-plan/job-search-plan.service";
import { rankJobs } from "../../stage-6-present-jobs/ranking/job-ranking.service";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "../../stage-6-present-jobs/presentation/chat.job-presentation.utils";
import { sanitizeReply, validateRecommendedJobs } from "../../stage-6-present-jobs/presentation/chat.validation.service";
import { generateJobAwareReply } from "../../shared/llm/chat.llm.service";

const handlePipelineAccept = async (params: {
    deps: ChatFlowDeps;
    conversationId: string;
    userId: string;
    jobContext: NonNullable<Conversation["jobContext"]>;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
}): Promise<ChatMessageResponse> => {
    const { deps, conversationId, userId, jobContext, mode, confidenceSummary } = params;
    const job = jobContext.selectedJobSnapshot;
    const rec = jobContext.jobRecommendationContext;
    if (!job || !rec) {
        const reply = "I do not have an active job recommendation to add yet. Ask me for roles and I will suggest one.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const result = await addJobToPipeline(deps.jobServiceBaseUrl, userId, job);
    if (result.status === "error") {
        const reply =
            "I could not add that role to your pipeline from here. You can add it from the Jobs page, or tell me if you want to keep exploring other roles.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const acceptedIds = rec.acceptedJobIds.includes(job.id) ? rec.acceptedJobIds : [...rec.acceptedJobIds, job.id];
    const companyPart = job.company.trim().length > 0 ? ` at ${job.company.trim()}` : "";
    const reply =
        result.status === "already_in_pipeline"
            ? `${job.title}${companyPart} is already in your pipeline — you can track it from My Pipeline. Want to explore another opportunity or prepare for interviews?`
            : `Done — I added the ${job.title} role${companyPart} to your pipeline.\n\nYou can now track it from My Pipeline. Want help preparing for interviews, strengthening a missing skill, or exploring more roles?`;
    const now = new Date();
    const nextContext = {
        ...jobContext,
        jobRecommendationContext: {
            ...rec,
            acceptedJobIds: acceptedIds,
            awaitingPipelineDecision: false,
            lastRecommendationAt: now,
        },
        updatedAt: now,
    };
    await deps.conversationService.saveJobContext(userId, conversationId, nextContext);
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
    return { reply, mode, confidenceSummary };
};

const pipelineRejectPresentNextSanitizedJob = async (params: {
    deps: ChatFlowDeps;
    userId: string;
    conversationId: string;
    jobContext: NonNullable<Conversation["jobContext"]>;
    nextSanitized: SanitizedJob;
    rejectedIds: string[];
    rec: JobRecommendationContextState;
    userCareerProfile: UserCareerProfile;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
}): Promise<ChatMessageResponse> => {
    const {
        deps, userId, conversationId, jobContext, nextSanitized, rejectedIds, rec,
        userCareerProfile, mode, confidenceSummary,
    } = params;
    const ranked = rankJobs(userCareerProfile, [nextSanitized]);
    const top = ranked[0];
    const reasonsText = top.reasons.join(" ");
    const reply = withPipelineClosing(
        `No problem. Another role that may fit is:\n${nextSanitized.title} — ${nextSanitized.company}\n\n${reasonsText}`
    );
    const now = new Date();
    const nextContext = {
        ...jobContext,
        selectedJobId: nextSanitized.id,
        selectedJobSnapshot: nextSanitized,
        jobRecommendationContext: {
            ...rec,
            rejectedJobIds: rejectedIds,
            selectedJobId: nextSanitized.id,
            selectedJob: nextSanitized,
            awaitingPipelineDecision: true,
            lastRecommendationAt: now,
        },
        updatedAt: now,
    };
    await deps.conversationService.saveJobContext(userId, conversationId, nextContext);
    const jobMatches = [mapRankedJobResultToChatMatchRow(top)];
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply, [nextSanitized]);
    return { reply, jobs: [nextSanitized], jobMatches, mode, confidenceSummary };
};

const pipelineRejectFinalizeBroaderRefill = async (params: {
    deps: ChatFlowDeps;
    conversationId: string;
    userId: string;
    normalizedMessage: string;
    conversation: Conversation;
    jobContext: NonNullable<Conversation["jobContext"]>;
    userCareerProfile: UserCareerProfile;
    rejectedIds: string[];
    rec: JobRecommendationContextState;
    userAccountContext: string;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
    filteredJobs: JobSearchResultItem[];
    orderedPool: JobSearchResultItem[];
    focusJob: JobSearchResultItem;
}): Promise<ChatMessageResponse> => {
    const {
        deps, conversationId, userId, conversation, jobContext, userCareerProfile,
        rejectedIds, rec, userAccountContext, mode, confidenceSummary,
        filteredJobs, orderedPool, focusJob,
    } = params;
    const userAchievements = await deps.externalService.readUserAchievements(userId);
    const jobAwareDecision = await generateJobAwareReply(
        deps.textCompletion,
        conversation,
        "Show another role",
        [focusJob],
        userAchievements,
        userAccountContext,
        deps.llmObserver
    );
    const validJobIds = validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, filteredJobs);
    const validatedAfterFallback = applyValidatedJobsFallback(
        orderedPool.filter((j) => validJobIds.includes(j.id)).slice(0, 10),
        sanitizeReply(jobAwareDecision.reply),
        focusJob
    );
    const selectedJob = validatedAfterFallback.validatedJobs[0] ?? focusJob;
    const queryLabel = jobContext.lastSearchQuery ?? "your direction";
    await deps.conversationService.saveJobContext(userId, conversationId, {
        ...jobContext,
        jobRecommendationContext: {
            ...rec,
            rejectedJobIds: rejectedIds,
        },
        updatedAt: new Date(),
    });
    await deps.conversationService.setJobContextAfterSearch(
        userId,
        conversationId,
        orderedPool,
        selectedJob,
        queryLabel,
        "BROADER_PIPELINE_REFILL"
    );
    const presentationJobs = [selectedJob];
    const rankedForMatches = rankJobs(userCareerProfile, presentationJobs);
    const jobMatches = rankedForMatches.map((item) => mapRankedJobResultToChatMatchRow(item));
    const reply = withPipelineClosing(validatedAfterFallback.sanitizedReply);
    await deps.conversationService.appendAssistantMessage(userId, conversationId, reply, presentationJobs);
    return {
        reply,
        jobs: presentationJobs,
        jobMatches,
        mode,
        confidenceSummary,
    };
};

const pipelineRejectRunBroaderRefill = async (params: {
    deps: ChatFlowDeps;
    conversationId: string;
    userId: string;
    normalizedMessage: string;
    conversation: Conversation;
    jobContext: NonNullable<Conversation["jobContext"]>;
    userCareerProfile: UserCareerProfile;
    userRoleExperience: RoleExperienceEntry[];
    rejectedIds: string[];
    rec: JobRecommendationContextState;
    excluded: ReadonlySet<string>;
    userAccountContext: string;
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
}): Promise<ChatMessageResponse> => {
    const {
        deps, userId, conversationId, normalizedMessage, conversation, jobContext,
        userCareerProfile, userRoleExperience, rejectedIds, rec, excluded,
        userAccountContext, mode, confidenceSummary,
    } = params;
    const broaderFilters = buildBroaderJobSearchFilters(jobContext, userCareerProfile);
    const broaderPlan = buildBroaderJobSearchPlan(userCareerProfile, broaderFilters, userRoleExperience);
    const searchedJobs = await deps.externalService.searchJobsByPlan(broaderPlan);
    const filteredJobs = searchedJobs.filter((j) => !excluded.has(j.id));
    if (filteredJobs.length === 0) {
        const reply =
            "I do not have another stored match right now, and a broader search did not surface a new role yet. Try naming a nearby title or domain you are curious about, and I will search again.";
        const now = new Date();
        await deps.conversationService.saveJobContext(userId, conversationId, {
            ...jobContext,
            jobRecommendationContext: {
                ...rec,
                rejectedJobIds: rejectedIds,
                awaitingPipelineDecision: false,
                lastRecommendationAt: now,
            },
            updatedAt: now,
        });
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const rankedJobs = rankJobs(userCareerProfile, filteredJobs);
    const orderedPool = rankedJobs.slice(0, 15).map((item) => item.job);
    const focusJob = orderedPool[0] ?? null;
    if (!focusJob) {
        const reply = "I could not find another role to suggest yet. Tell me a role family or skill area to lean into, and I will search again.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    return await pipelineRejectFinalizeBroaderRefill({
        deps,
        userId,
        conversationId,
        normalizedMessage,
        conversation,
        jobContext,
        userCareerProfile,
        rejectedIds,
        rec,
        userAccountContext,
        mode,
        confidenceSummary,
        filteredJobs,
        orderedPool,
        focusJob,
    });
};

const handlePipelineReject = async (params: {
    deps: ChatFlowDeps;
    conversationId: string;
    userId: string;
    normalizedMessage: string;
    conversation: Conversation;
    jobContext: NonNullable<Conversation["jobContext"]>;
    userCareerProfile: UserCareerProfile;
    userRoleExperience: RoleExperienceEntry[];
    mode: ConversationMode;
    confidenceSummary: ConfidenceSummary;
    userAccountContext: string;
}): Promise<ChatMessageResponse> => {
    const {
        deps, conversationId, userId, normalizedMessage, conversation, jobContext,
        userCareerProfile, userRoleExperience, mode, confidenceSummary, userAccountContext,
    } = params;
    const job = jobContext.selectedJobSnapshot;
    const rec = jobContext.jobRecommendationContext;
    if (!job || !rec) {
        const reply = "I do not have an active job recommendation to skip. Ask me for roles and I will suggest one.";
        await deps.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    }
    const rejectedIds = rec.rejectedJobIds.includes(job.id) ? rec.rejectedJobIds : [...rec.rejectedJobIds, job.id];
    const excluded = new Set([...rejectedIds, ...rec.acceptedJobIds]);
    const nextJobId = rec.recommendedJobIds.find((id) => !excluded.has(id));
    const nextSanitized = nextJobId ? jobContext.lastReturnedJobs.find((j) => j.id === nextJobId) ?? null : null;

    if (nextSanitized) {
        return await pipelineRejectPresentNextSanitizedJob({
            deps,
            conversationId,
            userId,
            jobContext,
            nextSanitized,
            rejectedIds,
            rec,
            userCareerProfile,
            mode,
            confidenceSummary,
        });
    }

    return await pipelineRejectRunBroaderRefill({
        deps,
        conversationId,
        userId,
        normalizedMessage,
        conversation,
        jobContext,
        userCareerProfile,
        userRoleExperience,
        rejectedIds,
        rec,
        excluded,
        userAccountContext,
        mode,
        confidenceSummary,
    });
};

export const tryPipelineShortcutResponse = async (
    deps: ChatFlowDeps,
    ctx: SendMessagePreparedContext
): Promise<ChatMessageResponse | null> => {
    const jobContext = ctx.conversationAfterUserMessage.jobContext;
    const awaitingPipelineDecision =
        jobContext?.jobRecommendationContext?.awaitingPipelineDecision === true
        && Boolean(jobContext.selectedJobSnapshot && jobContext.jobRecommendationContext);
    const pipelineIntent = awaitingPipelineDecision ? detectPipelineIntent(ctx.normalizedMessage) : null;
    if (pipelineIntent === "PIPELINE_ACCEPT" && jobContext) {
        return await handlePipelineAccept({
            deps,
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            jobContext,
            mode: ctx.mode,
            confidenceSummary: ctx.confidenceSummary,
        });
    }
    if (pipelineIntent === "PIPELINE_REJECT" && jobContext) {
        return await handlePipelineReject({
            deps,
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            normalizedMessage: ctx.normalizedMessage,
            conversation: ctx.conversationAfterUserMessage,
            jobContext,
            userCareerProfile: ctx.userCareerProfile,
            userRoleExperience: ctx.userRoleExperience,
            mode: ctx.mode,
            confidenceSummary: ctx.confidenceSummary,
            userAccountContext: ctx.userAccountContext,
        });
    }
    return null;
};
