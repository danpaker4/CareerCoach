import type { ProfileInput } from "../conversation/conversation.types";
import type { Conversation } from "../conversation/conversation.model";
import type { ChatMessageResponse, LlmDecision } from "./chat.types";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { ChatLlmService } from "./llm/chat.llm.service";
import { ChatValidationService } from "./llm/chat.validation.service";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ConfidenceService } from "./confidence/confidence.service";
import { AchievementInferenceService } from "./inference/achievement-inference/achievement-inference.service";
import type { AchievementInferenceResult } from "./inference/achievement-inference/achievement-inference.types";
import { toUserAchievementFromInferred } from "./inference/achievement-inference/achievement-inference.utils";
import { SeniorityInferenceService } from "./inference/seniority-inference/seniority-inference.service";
import { toRoleExperienceEntryFromInferred } from "./inference/seniority-inference/seniority-inference.utils";
import { mergeRoleExperience } from "../external-chat/role-experience.utils";
import type { RoleExperienceEntry } from "../external-chat/role-experience.types";
import { JobSearchPlanService } from "./search/job-search-plan.service";
import { JobRankingService } from "./ranking/job-ranking.service";
import { buildUserAccountContext } from "./llm/chat.user-account-context.utils";
import { CareerKnowledgeService } from "./knowledge/career-knowledge.service";
import type { CareerProfileSignalUpdate, UserCareerProfile } from "../career-profile/career-profile.types";
import type { ConfidenceSummary } from "./confidence/confidence.types";
import type { ConversationMode } from "./conversation-mode/conversation-mode.types";
import { ConversationModeService } from "./conversation-mode/conversation-mode.service";
import { shouldEnterDreamJobMode, conversationHasDreamJobContext } from "./conversation-mode/conversation-mode.utils";
import type { JobSearchResultItem } from "./chat.types";
import type { SanitizedJob, JobRecommendationContextState } from "../../job-in-conversation.types";
import { JobFollowUpAnswerService } from "./job-follow-up-answer/job-follow-up-answer.service";
import { resolveJobSelectionFromFollowUpMessage } from "./job-follow-up-answer/job-follow-up-answer.utils";
import { PipelineIntentService } from "./pipeline/pipeline-intent.service";
import { PipelineService } from "./pipeline/pipeline.service";
import type { PrepareSendMessageContextParams, SendMessagePreparedContext, StageFlowSendMessageResult } from "./chat.types";
import {
    inferDreamJobTitleFromMessage,
    isAffirmativeConfirmation,
    isNegativeConfirmation,
    normalizeDreamJobTitle,
} from "./dream-job/chat.dream-job.utils";
import type { DreamJobRoadmapCreator } from "./dream-job/chat.dream-job-roadmap.types";
import {
    buildBroaderJobSearchFilters,
    buildWorkDirectionFilters,
} from "./chat.direction.utils";
import {
    JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN,
} from "./chat.service.consts";
import {
    applyValidatedJobsFallback,
    mapRankedJobResultToChatMatchRow,
    withPipelineClosing,
} from "./chat.job-presentation.utils";
import { resolveSelectedJobFromRecommendations } from "./chat.job-mapping.utils";
import { toSignal } from "./chat.utils";

export class ChatService {
    constructor(
        private readonly conversationService: ChatConversationService,
        private readonly stageService: ConversationStageService,
        private readonly externalService: ChatExternalService,
        private readonly llmService: ChatLlmService,
        private readonly conversationModeService: ConversationModeService,
        private readonly validationService: ChatValidationService,
        private readonly profileService: CareerProfileService,
        private readonly confidenceService: ConfidenceService,
        private readonly achievementInferenceService: AchievementInferenceService,
        private readonly seniorityInferenceService: SeniorityInferenceService,
        private readonly searchPlanService: JobSearchPlanService,
        private readonly rankingService: JobRankingService,
        private readonly knowledgeService: CareerKnowledgeService,
        private readonly followUpAnswerService: JobFollowUpAnswerService,
        private readonly pipelineIntentService: PipelineIntentService,
        private readonly pipelineService: PipelineService,
        private readonly dreamJobRoadmapCreator: DreamJobRoadmapCreator
    ) { }

    private toSignalUpdateFromInferences = (
        message: string,
        achievementSkills: readonly string[],
        inferredSkills: readonly string[]
    ): CareerProfileSignalUpdate => ({
        strengths: inferredSkills.map((skill) => toSignal(skill, 0.7, message, "llm_inference")),
        technologies: achievementSkills.map((skill) => toSignal(skill, 0.86, message, "chat")),
        extractedKeywords: [...achievementSkills, ...inferredSkills]
            .map((keyword) => toSignal(keyword, 0.6, message, "llm_inference")),
    });

    private updateUserAchievements = async (userId: string, achievementInference: AchievementInferenceResult): Promise<void> => {
        await this.externalService
            .applyInferredAchievementSignals(userId, {
                technologies: achievementInference.skills,
                knownSkills: achievementInference.inferredSkills,
                achievements: achievementInference.achievements.map(toUserAchievementFromInferred),
            })
            .catch(() => null);
    };

    private updateUserRoleExperience = async (userId: string, roleExperience: readonly RoleExperienceEntry[]): Promise<void> => {
        await this.externalService.applyInferredRoleExperience(userId, { roleExperience }).catch(() => null);
    };

    private handlePipelineAccept = async (params: {
        conversationId: string;
        userId: string;
        jobContext: NonNullable<Conversation["jobContext"]>;
        mode: ConversationMode;
        confidenceSummary: ConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const { conversationId, userId, jobContext, mode, confidenceSummary } = params;
        const job = jobContext.selectedJobSnapshot;
        const rec = jobContext.jobRecommendationContext;
        if (!job || !rec) {
            const reply = "I do not have an active job recommendation to add yet. Ask me for roles and I will suggest one.";
            await this.conversationService.appendAssistantMessage(userId, conversationId, reply);
            return { reply, mode, confidenceSummary };
        }
        const result = await this.pipelineService.addJobToPipeline(userId, job);
        if (result.status === "error") {
            const reply =
                "I could not add that role to your pipeline from here. You can add it from the Jobs page, or tell me if you want to keep exploring other roles.";
            await this.conversationService.appendAssistantMessage(userId, conversationId, reply);
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
        await this.conversationService.saveJobContext(userId, conversationId, nextContext);
        await this.conversationService.appendAssistantMessage(userId, conversationId, reply);
        return { reply, mode, confidenceSummary };
    };

    private pipelineRejectPresentNextSanitizedJob = async (params: {
        userId: string;
        conversationId: string;
        jobContext: NonNullable<Conversation["jobContext"]>;
        nextSanitized: SanitizedJob;
        rejectedIds: string[];
        rec: JobRecommendationContextState;
        userCareerProfile: UserCareerProfile;
        userRoleExperience: RoleExperienceEntry[];
        mode: ConversationMode;
        confidenceSummary: ConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const { userId, conversationId, jobContext, nextSanitized, rejectedIds, rec, userCareerProfile, userRoleExperience, mode, confidenceSummary } = params;
        const ranked = this.rankingService.rankJobs(userCareerProfile, [nextSanitized], userRoleExperience);
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
        await this.conversationService.saveJobContext(userId, conversationId, nextContext);
        const jobMatches = [mapRankedJobResultToChatMatchRow(top)];
        await this.conversationService.appendAssistantMessage(userId, conversationId, reply, [nextSanitized]);
        return { reply, jobs: [nextSanitized], jobMatches, mode, confidenceSummary };
    };

    private pipelineRejectRunBroaderRefill = async (params: {
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
            userId,
            conversationId,
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
        } = params;
        const broaderFilters = buildBroaderJobSearchFilters(jobContext, userCareerProfile);
        const broaderPlan = this.searchPlanService.buildBroaderPlan(userCareerProfile, broaderFilters, userRoleExperience);
        const searchedJobs = await this.externalService.searchJobsByPlan(broaderPlan);
        const filteredJobs = searchedJobs.filter((j) => !excluded.has(j.id));
        if (filteredJobs.length === 0) {
            const reply =
                "I do not have another stored match right now, and a broader search did not surface a new role yet. Try naming a nearby title or domain you are curious about, and I will search again.";
            const now = new Date();
            await this.conversationService.saveJobContext(userId, conversationId, {
                ...jobContext,
                jobRecommendationContext: {
                    ...rec,
                    rejectedJobIds: rejectedIds,
                    awaitingPipelineDecision: false,
                    lastRecommendationAt: now,
                },
                updatedAt: now,
            });
            await this.conversationService.appendAssistantMessage(userId, conversationId, reply);
            return { reply, mode, confidenceSummary };
        }
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, filteredJobs, userRoleExperience);
        const orderedPool = rankedJobs.slice(0, 15).map((item) => item.job);
        const focusJob = orderedPool[0] ?? null;
        if (!focusJob) {
            const reply = "I could not find another role to suggest yet. Tell me a role family or skill area to lean into, and I will search again.";
            await this.conversationService.appendAssistantMessage(userId, conversationId, reply);
            return { reply, mode, confidenceSummary };
        }
        return await this.pipelineRejectFinalizeBroaderRefill({
            userId,
            conversationId,
            normalizedMessage,
            conversation,
            jobContext,
            userCareerProfile,
            userRoleExperience,
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

    private pipelineRejectFinalizeBroaderRefill = async (params: {
        conversationId: string;
        userId: string;
        normalizedMessage: string;
        conversation: Conversation;
        jobContext: NonNullable<Conversation["jobContext"]>;
        userCareerProfile: UserCareerProfile;
        userRoleExperience: RoleExperienceEntry[];
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
            conversationId,
            userId,
            normalizedMessage,
            conversation,
            jobContext,
            userCareerProfile,
            userRoleExperience,
            rejectedIds,
            rec,
            userAccountContext,
            mode,
            confidenceSummary,
            filteredJobs,
            orderedPool,
            focusJob,
        } = params;
        const userAchievements = await this.externalService.readUserAchievements(userId);
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversation,
            "Show another role",
            [focusJob],
            userAchievements,
            userAccountContext
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, filteredJobs);
        const validatedAfterFallback = applyValidatedJobsFallback(
            orderedPool.filter((j) => validJobIds.includes(j.id)).slice(0, 10),
            this.validationService.sanitizeReply(jobAwareDecision.reply),
            focusJob
        );
        const selectedJob = validatedAfterFallback.validatedJobs[0] ?? focusJob;
        const queryLabel = jobContext.lastSearchQuery ?? "your direction";
        await this.conversationService.saveJobContext(userId, conversationId, {
            ...jobContext,
            jobRecommendationContext: {
                ...rec,
                rejectedJobIds: rejectedIds,
            },
            updatedAt: new Date(),
        });
        await this.conversationService.setJobContextAfterSearch(
            userId,
            conversationId,
            orderedPool,
            selectedJob,
            queryLabel,
            "BROADER_PIPELINE_REFILL"
        );
        const presentationJobs = [selectedJob];
        const rankedForMatches = this.rankingService.rankJobs(userCareerProfile, presentationJobs, userRoleExperience);
        const jobMatches = rankedForMatches.map((item) => mapRankedJobResultToChatMatchRow(item));
        const reply = withPipelineClosing(validatedAfterFallback.sanitizedReply);
        await this.conversationService.appendAssistantMessage(userId, conversationId, reply, presentationJobs);
        return {
            reply,
            jobs: presentationJobs,
            jobMatches,
            mode,
            confidenceSummary,
        };
    };

    private handlePipelineReject = async (params: {
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
        const { conversationId, userId, normalizedMessage, conversation, jobContext, userCareerProfile, userRoleExperience, mode, confidenceSummary, userAccountContext } = params;
        const job = jobContext.selectedJobSnapshot;
        const rec = jobContext.jobRecommendationContext;
        if (!job || !rec) {
            const reply = "I do not have an active job recommendation to skip. Ask me for roles and I will suggest one.";
            await this.conversationService.appendAssistantMessage(userId, conversationId, reply);
            return { reply, mode, confidenceSummary };
        }
        const rejectedIds = rec.rejectedJobIds.includes(job.id) ? rec.rejectedJobIds : [...rec.rejectedJobIds, job.id];
        const excluded = new Set([...rejectedIds, ...rec.acceptedJobIds]);
        const nextJobId = rec.recommendedJobIds.find((id) => !excluded.has(id));
        const nextSanitized = nextJobId ? jobContext.lastReturnedJobs.find((j) => j.id === nextJobId) ?? null : null;

        if (nextSanitized) {
            return await this.pipelineRejectPresentNextSanitizedJob({
                conversationId,
                userId,
                jobContext,
                nextSanitized,
                rejectedIds,
                rec,
                userCareerProfile,
                userRoleExperience,
                mode,
                confidenceSummary,
            });
        }

        return await this.pipelineRejectRunBroaderRefill({
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

    private resolveStageFlowForSendMessage = async (params: {
        normalizedMessage: string;
        conversationAfterUserMessage: Conversation;
        currentStage: ReturnType<ConversationStageService["getCurrentStage"]>;
        shouldSkipStages: boolean;
        mode: ConversationMode;
        userId: string;
        conversationId: string;
        userAccountContext: string;
        userAchievements: SendMessagePreparedContext["userAchievements"];
        stageProgressWithNote: Conversation["stageProgress"];
        confidenceSummary: ConfidenceSummary;
    }): Promise<StageFlowSendMessageResult> => {
        const {
            conversationId,
            userId,
            normalizedMessage,
            conversationAfterUserMessage,
            currentStage,
            shouldSkipStages,
            mode,
            userAccountContext,
            userAchievements,
            stageProgressWithNote,
            confidenceSummary,
        } = params;
        const initialProgress = shouldSkipStages
            ? this.stageService.completeAllStages(stageProgressWithNote)
            : stageProgressWithNote;

        if (!currentStage || shouldSkipStages || mode === "FAST_SEARCH" || mode === "DREAMJOB") {
            return { kind: "continue_main_flow", progress: initialProgress };
        }

        const stageReply = await this.llmService.generateStageReply(
            conversationAfterUserMessage,
            normalizedMessage,
            currentStage,
            userAchievements,
            mode,
            userAccountContext
        );
        const nextStageProgress = this.stageService.applyStageAdvance(
            stageProgressWithNote,
            currentStage.id,
            stageReply.shouldAdvanceStage
        );
        const conversationAfterStageAdvance = {
            ...conversationAfterUserMessage,
            stageProgress: nextStageProgress,
        };
        const nextStage = this.stageService.getCurrentStage(conversationAfterStageAdvance, normalizedMessage);
        if (nextStage) {
            await this.conversationService.updateStageProgress(userId, conversationId, nextStageProgress);
            await this.conversationService.appendAssistantMessage(userId, conversationId, stageReply.reply);
            return {
                kind: "stage_reply_only",
                progress: nextStageProgress,
                reply: stageReply.reply,
                mode,
                confidenceSummary,
            };
        }
        return { kind: "continue_main_flow", progress: nextStageProgress };
    };

    private respondAfterWorkDirectionSearch = async (params: {
        conversationId: string;
        userId: string;
        normalizedMessage: string;
        conversationAfterUserMessage: Conversation;
        userCareerProfile: UserCareerProfile;
        userRoleExperience: RoleExperienceEntry[];
        normalizedQuery: string;
        jobs: JobSearchResultItem[];
        userAccountContext: string;
        userAchievements: SendMessagePreparedContext["userAchievements"];
        mode: ConversationMode;
        confidenceSummary: ConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const {
            conversationId,
            userId,
            normalizedMessage,
            conversationAfterUserMessage,
            userCareerProfile,
            userRoleExperience,
            normalizedQuery,
            jobs,
            userAccountContext,
            userAchievements,
            mode,
            confidenceSummary,
        } = params;
        const rejectedIds = new Set(conversationAfterUserMessage.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
        const acceptedIds = new Set(conversationAfterUserMessage.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs, userRoleExperience);
        const eligibleRanked = rankedJobs.filter(
            (item) => !rejectedIds.has(item.job.id) && !acceptedIds.has(item.job.id)
        );
        const orderedRankedPool = eligibleRanked.slice(0, 15);
        if (orderedRankedPool.length === 0) {
            const exhaustedReply =
                "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";
            await this.conversationService.appendAssistantMessage(userId, conversationId, exhaustedReply);
            return { reply: exhaustedReply, mode, confidenceSummary };
        }
        const topRankedJobs = orderedRankedPool.map((item) => item.job);
        const focusJob = topRankedJobs[0] ?? null;
        const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversationAfterUserMessage,
            normalizedMessage,
            jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
            userAchievements,
            userAccountContext
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        const fallbackPack = applyValidatedJobsFallback(
            topRankedJobs.filter((jobItem) => validJobIds.includes(jobItem.id)).slice(0, 10),
            this.validationService.sanitizeReply(jobAwareDecision.reply),
            focusJob,
            normalizedQuery
        );
        const sanitizedReply = withPipelineClosing(fallbackPack.sanitizedReply);
        const selectedJob = resolveSelectedJobFromRecommendations(fallbackPack.validatedJobs, validJobIds) ?? focusJob;
        await this.conversationService.setJobContextAfterSearch(
            userId,
            conversationId,
            topRankedJobs,
            selectedJob,
            normalizedQuery,
            "WORK_DIRECTION_INTENT"
        );
        const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
        const primaryJobId = presentationJobs[0]?.id;
        const jobMatches = rankedJobs
            .filter((item) => item.jobId === primaryJobId)
            .map((item) => mapRankedJobResultToChatMatchRow(item));
        await this.conversationService.appendAssistantMessage(userId, conversationId, sanitizedReply, presentationJobs);
        return {
            reply: sanitizedReply,
            jobs: presentationJobs.length > 0 ? presentationJobs : fallbackPack.validatedJobs,
            jobMatches,
            mode,
            confidenceSummary,
        };
    };

    private respondAfterSearchPlan = async (params: {
        userId: string;
        conversationId: string;
        normalizedMessage: string;
        conversationForDecision: Conversation;
        userCareerProfile: UserCareerProfile;
        userRoleExperience: RoleExperienceEntry[];
        jobs: JobSearchResultItem[];
        userAccountContext: string;
        userAchievements: SendMessagePreparedContext["userAchievements"];
        mode: ConversationMode;
        confidenceSummary: ConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const {
            userId,
            conversationId,
            normalizedMessage,
            conversationForDecision,
            userCareerProfile,
            userRoleExperience,
            jobs,
            userAccountContext,
            userAchievements,
            mode,
            confidenceSummary,
        } = params;
        const rejectedIds = new Set(conversationForDecision.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
        const acceptedIds = new Set(conversationForDecision.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs, userRoleExperience);
        const eligibleRanked = rankedJobs.filter(
            (item) => !rejectedIds.has(item.job.id) && !acceptedIds.has(item.job.id)
        );
        const orderedRankedPool = eligibleRanked.slice(0, 15);
        if (orderedRankedPool.length === 0) {
            const exhaustedReply =
                "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";
            await this.conversationService.appendAssistantMessage(userId, conversationId, exhaustedReply);
            return { reply: exhaustedReply, mode, confidenceSummary };
        }
        const topRankedJobs = orderedRankedPool.map((item) => item.job);
        const focusJob = topRankedJobs[0] ?? null;
        const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversationForDecision,
            normalizedMessage,
            jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
            userAchievements,
            userAccountContext
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        const recommendedDirections = await this.knowledgeService.suggestDirections(userCareerProfile, userRoleExperience);
        const fallbackPack = applyValidatedJobsFallback(
            topRankedJobs.filter((jobItem) => validJobIds.includes(jobItem.id)).slice(0, 10),
            this.validationService.sanitizeReply(jobAwareDecision.reply),
            focusJob
        );
        const sanitizedReply = withPipelineClosing(fallbackPack.sanitizedReply);
        const selectedJob = resolveSelectedJobFromRecommendations(fallbackPack.validatedJobs, validJobIds) ?? focusJob;
        await this.conversationService.setJobContextAfterSearch(
            userId,
            conversationId,
            topRankedJobs,
            selectedJob,
            normalizedMessage,
            "SEARCH_PLAN"
        );
        const replyWithDomainContext = sanitizedReply;
        const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
        const primaryJobId = presentationJobs[0]?.id;
        const jobMatches = rankedJobs
            .filter((item) => item.jobId === primaryJobId)
            .map((item) => mapRankedJobResultToChatMatchRow(item));

        await this.conversationService.appendAssistantMessage(userId, conversationId, replyWithDomainContext, presentationJobs);

        return {
            reply: replyWithDomainContext,
            jobs: presentationJobs.length > 0 ? presentationJobs : fallbackPack.validatedJobs,
            jobMatches,
            recommendedDirections,
            mode,
            confidenceSummary,
        };
    };

    private runDreamJobFlow = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse> => {
        const dreamJobFlow = ctx.conversationAfterUserMessage.dreamJobFlow;
        const decision = await this.llmService.decideDreamJobStep(
            ctx.conversationAfterUserMessage,
            ctx.normalizedMessage,
            ctx.userAccountContext,
            dreamJobFlow
        );

        const inferredTitle = inferDreamJobTitleFromMessage(ctx.normalizedMessage);
        const pendingTitle =
            decision.proposedDreamJobTitle !== undefined && decision.proposedDreamJobTitle.length > 0
                ? normalizeDreamJobTitle(decision.proposedDreamJobTitle)
                : dreamJobFlow?.proposedTitle !== undefined && dreamJobFlow.proposedTitle.length > 0
                  ? dreamJobFlow.proposedTitle
                  : inferredTitle !== undefined
                    ? inferredTitle
                    : undefined;

        const rulesConfirmed =
            dreamJobFlow?.awaitingConfirmation === true &&
            isAffirmativeConfirmation(ctx.normalizedMessage) &&
            !isNegativeConfirmation(ctx.normalizedMessage);

        const userConfirmed =
            pendingTitle !== undefined &&
            (decision.userConfirmed || rulesConfirmed) &&
            !isNegativeConfirmation(ctx.normalizedMessage);

        if (userConfirmed && pendingTitle !== undefined) {
            const saved = await this.externalService.updateDreamJob(ctx.userId, pendingTitle, ctx.authorization);
            if (!saved) {
                const failureReply =
                    "I couldn't save your dream job right now. Please try again from your profile, or confirm once more.";
                await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, failureReply);
                return { reply: failureReply, mode: "DREAMJOB", confidenceSummary: ctx.confidenceSummary };
            }

            await this.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, undefined);
            const roadmapResult = await this.dreamJobRoadmapCreator
                .create(ctx.userId, pendingTitle)
                .catch(() => ({ created: false as const, reason: "generation_failed" as const }));
            const successReply = roadmapResult.created
                ? `Saved ${pendingTitle} as your dream job and created a 4-stage roadmap toward it. You can review it on My Roadmap.`
                : `Saved ${pendingTitle} as your dream job, but I couldn't create the roadmap right now. You can create it from My Roadmap.`;
            await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, successReply);
            return { reply: successReply, mode: "DREAMJOB", confidenceSummary: ctx.confidenceSummary };
        }

        if (isNegativeConfirmation(ctx.normalizedMessage) && dreamJobFlow?.awaitingConfirmation === true) {
            await this.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, {
                awaitingConfirmation: false,
            });
        } else if (pendingTitle !== undefined && (decision.awaitingConfirmation || inferredTitle !== undefined)) {
            await this.conversationService.updateDreamJobFlow(ctx.userId, ctx.conversationId, {
                proposedTitle: pendingTitle,
                awaitingConfirmation: true,
            });
        }

        const sanitizedReply = this.validationService.sanitizeReply(decision.reply);
        const reply =
            pendingTitle !== undefined &&
            dreamJobFlow?.awaitingConfirmation !== true &&
            (decision.awaitingConfirmation || inferredTitle !== undefined)
                ? `It sounds like your long-term dream role is ${pendingTitle}. Should I save "${pendingTitle}" as your dream job?`
                : sanitizedReply;
        await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, reply);
        return { reply, mode: "DREAMJOB", confidenceSummary: ctx.confidenceSummary };
    };

    private prepareSendMessageContext = async (params: PrepareSendMessageContextParams): Promise<SendMessagePreparedContext> => {
        const { userId, normalizedMessage, profile, requestedConversationId, authorization } = params;
        const { conversationId } = await this.conversationService.ensureConversationExists(userId, requestedConversationId);
        await this.profileService.updateProfileFromInput(userId, profile);
        await this.conversationService.appendUserMessage(userId, conversationId, normalizedMessage);

        const serverUser = await this.externalService.readUserPublicProfile(userId).catch(() => null);
        const userAccountContext = buildUserAccountContext({ serverUser, profile });

        const conversationAfterUserMessage = await this.conversationService.getConversationOrThrow(userId, conversationId);
        const userAchievements = await this.externalService.readUserAchievements(userId);
        const baseCareerProfile = await this.profileService.getOrCreateProfile(userId);
        const achievementInference = this.achievementInferenceService.inferFromMessage(normalizedMessage);
        const seniorityInference = this.seniorityInferenceService.inferFromMessage(normalizedMessage);
        const inferredRoleExperience = seniorityInference.entries.map(toRoleExperienceEntryFromInferred);
        const existingRoleExperience = await this.externalService.readUserRoleExperience(userId);
        const inferredSignalUpdate = this.toSignalUpdateFromInferences(
            normalizedMessage,
            achievementInference.skills,
            achievementInference.inferredSkills
        );
        const userCareerProfile = await this.profileService.mergeProfileSignals(baseCareerProfile, inferredSignalUpdate);
        await this.updateUserAchievements(userId, achievementInference);
        await this.updateUserRoleExperience(userId, inferredRoleExperience);
        const userRoleExperience = mergeRoleExperience(existingRoleExperience, inferredRoleExperience);
        const confidenceSummary = this.confidenceService.calculateConfidence(userCareerProfile, userRoleExperience);
        const detectionResult = await this.conversationModeService.detectConversationMode(
            conversationAfterUserMessage,
            normalizedMessage,
            userAchievements,
            userAccountContext
        );
        const serverDreamJob = typeof serverUser?.dreamJob === "string" ? serverUser.dreamJob : null;
        const existingDreamJob = conversationAfterUserMessage.dreamJobFlow?.proposedTitle ?? serverDreamJob;
        const isDreamJobRule = shouldEnterDreamJobMode(normalizedMessage, existingDreamJob) ||
            conversationAfterUserMessage.dreamJobFlow !== undefined ||
            (conversationHasDreamJobContext(conversationAfterUserMessage.messages) && serverDreamJob === null);
        const mode = isDreamJobRule ? "DREAMJOB" : detectionResult.mode;

        const followUpIntent = this.followUpAnswerService.detectFollowUpIntent(normalizedMessage);
        const jobContext = conversationAfterUserMessage.jobContext;
        return {
            userId,
            conversationId,
            normalizedMessage,
            profile,
            userAchievements,
            userAccountContext,
            conversationAfterUserMessage,
            userCareerProfile,
            userRoleExperience,
            confidenceSummary,
            mode,
            fastSearchQuery: detectionResult.fastSearchQuery,
            followUpIntent,
            jobContext,
            authorization,
        };
    };

    private tryPipelineShortcutResponse = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse | null> => {
        const awaitingPipelineDecision =
            ctx.jobContext?.jobRecommendationContext?.awaitingPipelineDecision === true
            && Boolean(ctx.jobContext.selectedJobSnapshot && ctx.jobContext.jobRecommendationContext);
        const pipelineIntent = awaitingPipelineDecision ? this.pipelineIntentService.detect(ctx.normalizedMessage) : null;
        if (pipelineIntent === "PIPELINE_ACCEPT" && ctx.jobContext) {
            return await this.handlePipelineAccept({
                userId: ctx.userId,
                conversationId: ctx.conversationId,
                jobContext: ctx.jobContext,
                mode: ctx.mode,
                confidenceSummary: ctx.confidenceSummary,
            });
        }
        if (pipelineIntent === "PIPELINE_REJECT" && ctx.jobContext) {
            return await this.handlePipelineReject({
                userId: ctx.userId,
                conversationId: ctx.conversationId,
                normalizedMessage: ctx.normalizedMessage,
                conversation: ctx.conversationAfterUserMessage,
                jobContext: ctx.jobContext,
                userCareerProfile: ctx.userCareerProfile,
                userRoleExperience: ctx.userRoleExperience,
                mode: ctx.mode,
                confidenceSummary: ctx.confidenceSummary,
                userAccountContext: ctx.userAccountContext,
            });
        }
        return null;
    };

    private tryFollowUpShortcutResponse = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse | null> => {
        const hasStoredJobs = (ctx.jobContext?.lastReturnedJobs.length ?? 0) > 0;
        if (!hasStoredJobs || !ctx.followUpIntent.isFollowUp || ctx.followUpIntent.isExplicitNewSearch || !ctx.jobContext) {
            return null;
        }
        const resolution = resolveJobSelectionFromFollowUpMessage(
            ctx.normalizedMessage,
            ctx.jobContext.selectedJobSnapshot,
            ctx.jobContext.lastReturnedJobs
        );
        if (resolution.status === "missing") {
            const missingMessage = "I do not have stored jobs in context yet. Ask me for jobs first, and I will keep them for follow-up questions.";
            await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, missingMessage);
            return { reply: missingMessage, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }
        if (resolution.status === "ambiguous") {
            const question = this.followUpAnswerService.buildDisambiguationQuestion(resolution.options);
            await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, question);
            return { reply: question, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        const followUpReply = this.followUpAnswerService.buildAnswer(
            ctx.followUpIntent.requestedField,
            resolution.job,
            ctx.normalizedMessage,
            ctx.userCareerProfile
        );
        await this.conversationService.setSelectedJob(ctx.userId, ctx.conversationId, resolution.job);
        await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, followUpReply);
        return { reply: followUpReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    };



    private finalizeSendMessageFromLlmDecision = async (params: {
        ctx: SendMessagePreparedContext;
        conversationForDecision: Conversation;
        llmDecision: LlmDecision;
    }): Promise<ChatMessageResponse> => {
        const { ctx, conversationForDecision, llmDecision } = params;
        const effectiveSearchFilters = llmDecision.searchFilters;
        const shouldSearchJobs = llmDecision.shouldSearchJobs;
        console.info(
            `[CHAT][SEARCH] userId=${ctx.userId} trigger=LLM_OR_RULE shouldSearchJobs=${shouldSearchJobs} mode=${ctx.mode} filters=${JSON.stringify(effectiveSearchFilters)}`
        );

        if (!shouldSearchJobs) {
            const sanitizedReply = this.validationService.sanitizeReply(llmDecision.reply);
            await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, sanitizedReply);
            return { reply: sanitizedReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        const searchPlan = this.searchPlanService.buildPlan(ctx.userCareerProfile, effectiveSearchFilters, ctx.userRoleExperience);
        console.info(
            `[CHAT][SEARCH] userId=${ctx.userId} trigger=SEARCH_PLAN planSearches=${searchPlan.searches.length} plan=${JSON.stringify(searchPlan.searches.map((item) => ({ type: item.type, query: item.query })))}`
        );
        let jobs = await this.externalService.searchJobsByPlan(searchPlan);
        console.info(`[CHAT][SEARCH] userId=${ctx.userId} trigger=SEARCH_PLAN results=${jobs.length}`);
        
        if (jobs.length === 0) {
            console.info(`[CHAT][SEARCH] userId=${ctx.userId} trigger=SEARCH_PLAN broader search fallback`);
            const broaderPlan = this.searchPlanService.buildBroaderPlan(ctx.userCareerProfile, effectiveSearchFilters, ctx.userRoleExperience);
            jobs = await this.externalService.searchJobsByPlan(broaderPlan);
        }

        if (jobs.length === 0) {
            const noJobsReply = "I looked for matches based on what we discussed, but couldn't find open roles right now. Could you share a different title or skill area to lean into?";
            await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, noJobsReply);
            return { reply: noJobsReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        return await this.respondAfterSearchPlan({
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            normalizedMessage: ctx.normalizedMessage,
            conversationForDecision,
            userCareerProfile: ctx.userCareerProfile,
            userRoleExperience: ctx.userRoleExperience,
            jobs,
            userAccountContext: ctx.userAccountContext,
            userAchievements: ctx.userAchievements,
            mode: ctx.mode,
            confidenceSummary: ctx.confidenceSummary,
        });
    };

    private runFastSearchFlow = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse> => {
        const query = ctx.fastSearchQuery && ctx.fastSearchQuery.trim() !== "" ? ctx.fastSearchQuery : ctx.normalizedMessage;
        const searchFilters = buildWorkDirectionFilters(query);
        const searchPlan = this.searchPlanService.buildPlan(ctx.userCareerProfile, searchFilters, ctx.userRoleExperience);
        console.info(
            `[CHAT][SEARCH] userId=${ctx.userId} trigger=FAST_SEARCH query="${query}" filters=${JSON.stringify(searchFilters)} planSearches=${searchPlan.searches.length}`
        );
        let jobs = await this.externalService.searchJobsByPlan(searchPlan);
        console.info(`[CHAT][SEARCH] userId=${ctx.userId} trigger=FAST_SEARCH results=${jobs.length}`);

        if (jobs.length === 0) {
            console.info(`[CHAT][SEARCH] userId=${ctx.userId} trigger=FAST_SEARCH broader search fallback`);
            const broaderPlan = this.searchPlanService.buildBroaderPlan(ctx.userCareerProfile, searchFilters, ctx.userRoleExperience);
            jobs = await this.externalService.searchJobsByPlan(broaderPlan);
        }

        if (jobs.length === 0) {
            const fallback = `I searched for ${query} roles but couldn't find any open positions matching that right now. Could you share a different role or field you'd like to explore?`;
            await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, fallback);
            return { reply: fallback, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        const rankedJobs = this.rankingService.rankJobs(ctx.userCareerProfile, jobs, ctx.userRoleExperience);
        const topRankedJobs = rankedJobs.map((item) => item.job);
        const focusJob = topRankedJobs[0];

        const fallbackPack = applyValidatedJobsFallback(
            topRankedJobs.slice(0, 10),
            "",
            focusJob
        );
        const sanitizedReply = withPipelineClosing(fallbackPack.sanitizedReply);

        await this.conversationService.setJobContextAfterSearch(
            ctx.userId,
            ctx.conversationId,
            topRankedJobs,
            focusJob,
            ctx.normalizedMessage,
            "SEARCH_PLAN"
        );

        const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
        const primaryJobId = presentationJobs[0]?.id;
        const jobMatches = rankedJobs
            .filter((item) => item.jobId === primaryJobId)
            .map((item) => mapRankedJobResultToChatMatchRow(item));

        await this.conversationService.appendAssistantMessage(ctx.userId, ctx.conversationId, sanitizedReply, presentationJobs);

        return {
            reply: sanitizedReply,
            jobs: presentationJobs,
            jobMatches,
            mode: ctx.mode,
            confidenceSummary: ctx.confidenceSummary,
        };
    };

    private runLlmStageAndSearchFlow = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse> => {
        if (ctx.mode === "DREAMJOB") {
            console.info(`[CHAT][DREAMJOB] userId=${ctx.userId} routing to dream job flow from LLM mode`);
            return await this.runDreamJobFlow({ ...ctx, mode: "DREAMJOB" });
        }

        if (ctx.mode === "FAST_SEARCH") {
            console.info(`[CHAT][FAST_SEARCH] userId=${ctx.userId} routing to fast search flow`);
            return await this.runFastSearchFlow(ctx);
        }

        const llmDecision = await this.llmService.decideNextStep(
            ctx.conversationAfterUserMessage,
            ctx.normalizedMessage,
            ctx.userAchievements,
            ctx.userAccountContext
        );



        const currentStage = this.stageService.getCurrentStage(ctx.conversationAfterUserMessage, ctx.normalizedMessage);
        const stageProgressWithNote = currentStage
            ? this.stageService.recordStageMessage(ctx.conversationAfterUserMessage, ctx.normalizedMessage, currentStage.id)
            : ctx.conversationAfterUserMessage.stageProgress;
        const shouldSkipStages = llmDecision.shouldSearchJobs;
        const stageFlow = await this.resolveStageFlowForSendMessage({
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            normalizedMessage: ctx.normalizedMessage,
            conversationAfterUserMessage: ctx.conversationAfterUserMessage,
            currentStage,
            shouldSkipStages,
            mode: ctx.mode,
            userAccountContext: ctx.userAccountContext,
            userAchievements: ctx.userAchievements,
            stageProgressWithNote,
            confidenceSummary: ctx.confidenceSummary,
        });

        if (stageFlow.kind === "stage_reply_only") {
            return {
                reply: stageFlow.reply,
                mode: stageFlow.mode,
                confidenceSummary: stageFlow.confidenceSummary,
            };
        }

        await this.conversationService.updateStageProgress(ctx.userId, ctx.conversationId, stageFlow.progress);

        const conversationForDecision = {
            ...ctx.conversationAfterUserMessage,
            stageProgress: stageFlow.progress,
        };

        const updatedAchievements = await this.externalService
            .upsertAchievementFromUserMessage(ctx.userId, ctx.normalizedMessage, ctx.userAchievements)
            .catch(() => null);

        const ctxForDecision = updatedAchievements ? { ...ctx, userAchievements: updatedAchievements } : ctx;

        return await this.finalizeSendMessageFromLlmDecision({
            ctx: ctxForDecision,
            conversationForDecision,
            llmDecision,
        });
    };

    sendMessage = async (
        userId: string,
        message: string,
        profile?: ProfileInput,
        conversationId?: string,
        authorization?: string
    ): Promise<ChatMessageResponse> => {
        const normalizedMessage = message.trim();
        if (normalizedMessage.length === 0) {
            throw new Error("Message is required");
        }
        console.info(`[CHAT][INTENT] userId=${userId} incoming="${normalizedMessage}"`);
        const ctx = await this.prepareSendMessageContext({
            userId,
            normalizedMessage,
            profile,
            requestedConversationId: conversationId,
            authorization,
        });

        if (ctx.mode === "DREAMJOB") {
            console.info(`[CHAT][DREAMJOB] userId=${userId} routing to dream job flow`);
            return await this.runDreamJobFlow(ctx);
        }

        const pipelineResponse = await this.tryPipelineShortcutResponse(ctx);
        if (pipelineResponse) {
            return pipelineResponse;
        }
        const followUpResponse = await this.tryFollowUpShortcutResponse(ctx);
        if (followUpResponse) {
            return followUpResponse;
        }
        return await this.runLlmStageAndSearchFlow(ctx);
    };
}
