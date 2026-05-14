import type { ConversationRef, ProfileInput } from "./conversation/conversation.types";
import type { Conversation } from "./conversation/conversation.model";
import type { ChatMessageResponse } from "./chat.types";
import { ChatConversationService } from "./conversation/conversation.service";
import { ConversationStageService } from "./conversation/conversation.stage.service";
import { ChatLlmService } from "./llm/chat.llm.service";
import { ChatValidationService } from "./llm/chat.validation.service";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ConversationMemoryService } from "./memory/conversation-memory.service";
import { CareerConfidenceService } from "./coach/career-confidence.service";
import { ConversationModeService } from "./coach/conversation-mode.service";
import { AchievementInferenceService } from "./inference/achievement-inference.service";
import { WorkStyleInferenceService } from "./inference/work-style-inference.service";
import { JobSearchPlanService } from "./search/job-search-plan.service";
import { JobRankingService } from "./ranking/job-ranking.service";
import { buildUserAccountContext } from "./llm/chat.user-account-context.utils";
import { CareerKnowledgeService } from "./knowledge/career-knowledge.service";
import type { CareerProfileSignalUpdate, CareerSignal, UserCareerProfile } from "../career-profile/career-profile.types";
import type { CareerConfidenceSummary } from "./coach/career-confidence.types";
import type { ConversationMode } from "./coach/conversation-mode.types";
import type { JobSearchResultItem } from "./chat.types";
import type { SanitizedJob, JobRecommendationContextState } from "./job-context/job-context.types";
import { JobFollowUpIntentService } from "./job-context/job-follow-up-intent.service";
import { JobSelectionResolverService } from "./job-context/job-selection-resolver.service";
import { JobFollowUpAnswerService } from "./job-context/job-follow-up-answer.service";
import { PipelineIntentService } from "./pipeline/pipeline-intent.service";
import { PipelineService } from "./pipeline/pipeline.service";
import type { StageFlowSendMessageResult, SendMessagePreparedContext } from "./chat.service.types";
import {
    buildBroaderJobSearchFilters,
    buildDomainExplorationFilters,
    buildDiscoveryQuestion,
    detectDomainExplorationTarget,
    extractWorkDirectionQuery,
    isStageSkipRequested,
    isWorkDirectionIntent,
    shouldRunJobSearch,
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
import { resolveSelectedJobFromRecommendations, sanitizedJobToSearchItem } from "./chat.job-mapping.utils";

export class ChatService {
    constructor(
        private readonly conversationService: ChatConversationService,
        private readonly stageService: ConversationStageService,
        private readonly externalService: ChatExternalService,
        private readonly llmService: ChatLlmService,
        private readonly validationService: ChatValidationService,
        private readonly profileService: CareerProfileService,
        private readonly memoryService: ConversationMemoryService,
        private readonly confidenceService: CareerConfidenceService,
        private readonly modeService: ConversationModeService,
        private readonly achievementInferenceService: AchievementInferenceService,
        private readonly workStyleInferenceService: WorkStyleInferenceService,
        private readonly searchPlanService: JobSearchPlanService,
        private readonly rankingService: JobRankingService,
        private readonly knowledgeService: CareerKnowledgeService,
        private readonly followUpIntentService: JobFollowUpIntentService,
        private readonly selectionResolverService: JobSelectionResolverService,
        private readonly followUpAnswerService: JobFollowUpAnswerService,
        private readonly pipelineIntentService: PipelineIntentService,
        private readonly pipelineService: PipelineService
    ) { }

    getConversation = async (userId: string, conversationId?: string) =>
        this.conversationService.getConversationResponse(userId, conversationId);

    listConversationSummaries = async (userId: string) => this.conversationService.listConversationSummaries(userId);

    createConversation = async (userId: string, profile?: ProfileInput) => {
        const profileAchievements = this.conversationService.getProfileAchievements(profile);
        return this.conversationService.createAdditionalConversation(userId, profileAchievements);
    };

    deleteConversation = async (userId: string, conversationId: string): Promise<void> =>
        this.conversationService.deleteConversation(userId, conversationId);

    private toSignal = (value: string, confidence: number, evidence: string, source: CareerSignal["source"]): CareerSignal => ({
        value,
        confidence,
        evidence: [evidence],
        source,
        updatedAt: new Date(),
    });

    private toSignalUpdateFromInferences = (
        message: string,
        achievementSkills: readonly string[],
        inferredSkills: readonly string[],
        workStyleSignals: readonly string[]
    ): CareerProfileSignalUpdate => ({
        strengths: inferredSkills.map((skill) => this.toSignal(skill, 0.7, message, "llm_inference")),
        technologies: achievementSkills.map((skill) => this.toSignal(skill, 0.86, message, "chat")),
        workStyle: workStyleSignals.map((signal) => this.toSignal(signal, 0.75, message, "llm_inference")),
        extractedKeywords: [...achievementSkills, ...inferredSkills, ...workStyleSignals]
            .map((keyword) => this.toSignal(keyword, 0.6, message, "llm_inference")),
    });

    private handlePipelineAccept = async (params: {
        ref: ConversationRef;
        userId: string;
        jobContext: NonNullable<Conversation["jobContext"]>;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const { ref, userId, jobContext, mode, confidenceSummary } = params;
        const job = jobContext.selectedJobSnapshot;
        const rec = jobContext.jobRecommendationContext;
        if (!job || !rec) {
            const reply = "I do not have an active job recommendation to add yet. Ask me for roles and I will suggest one.";
            await this.conversationService.appendAssistantMessage(ref, reply);
            return { reply, mode, confidenceSummary };
        }
        const result = await this.pipelineService.addJobToPipeline(userId, job);
        if (result.status === "error") {
            const reply =
                "I could not add that role to your pipeline from here. You can add it from the Jobs page, or tell me if you want to keep exploring other roles.";
            await this.conversationService.appendAssistantMessage(ref, reply);
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
        await this.conversationService.saveJobContext(ref, nextContext);
        await this.conversationService.appendAssistantMessage(ref, reply);
        return { reply, mode, confidenceSummary };
    };

    private pipelineRejectPresentNextSanitizedJob = async (params: {
        ref: ConversationRef;
        jobContext: NonNullable<Conversation["jobContext"]>;
        nextSanitized: SanitizedJob;
        rejectedIds: string[];
        rec: JobRecommendationContextState;
        userCareerProfile: UserCareerProfile;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const { ref, jobContext, nextSanitized, rejectedIds, rec, userCareerProfile, mode, confidenceSummary } = params;
        const nextItem = sanitizedJobToSearchItem(nextSanitized);
        const ranked = this.rankingService.rankJobs(userCareerProfile, [nextItem]);
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
        await this.conversationService.saveJobContext(ref, nextContext);
        const jobMatches = [mapRankedJobResultToChatMatchRow(top)];
        await this.conversationService.appendAssistantMessage(ref, reply, [nextItem]);
        return { reply, jobs: [nextItem], jobMatches, mode, confidenceSummary };
    };

    private pipelineRejectRunBroaderRefill = async (params: {
        ref: ConversationRef;
        userId: string;
        normalizedMessage: string;
        conversation: Conversation;
        jobContext: NonNullable<Conversation["jobContext"]>;
        userCareerProfile: UserCareerProfile;
        rejectedIds: string[];
        rec: JobRecommendationContextState;
        excluded: ReadonlySet<string>;
        userAccountContext: string;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const {
            ref,
            userId,
            normalizedMessage,
            conversation,
            jobContext,
            userCareerProfile,
            rejectedIds,
            rec,
            excluded,
            userAccountContext,
            mode,
            confidenceSummary,
        } = params;
        const broaderFilters = buildBroaderJobSearchFilters(jobContext, userCareerProfile);
        const broaderPlan = this.searchPlanService.buildBroaderPlan(userCareerProfile, broaderFilters);
        const searchedJobs = await this.externalService.searchJobsByPlan(broaderPlan);
        const filteredJobs = searchedJobs.filter((j) => !excluded.has(j.jobId));
        if (filteredJobs.length === 0) {
            const reply =
                "I do not have another stored match right now, and a broader search did not surface a new role yet. Try naming a nearby title or domain you are curious about, and I will search again.";
            const now = new Date();
            await this.conversationService.saveJobContext(ref, {
                ...jobContext,
                jobRecommendationContext: {
                    ...rec,
                    rejectedJobIds: rejectedIds,
                    awaitingPipelineDecision: false,
                    lastRecommendationAt: now,
                },
                updatedAt: now,
            });
            await this.conversationService.appendAssistantMessage(ref, reply);
            return { reply, mode, confidenceSummary };
        }
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, filteredJobs);
        const orderedPool = rankedJobs.slice(0, 15).map((item) => item.job);
        const focusJob = orderedPool[0] ?? null;
        if (!focusJob) {
            const reply = "I could not find another role to suggest yet. Tell me a role family or skill area to lean into, and I will search again.";
            await this.conversationService.appendAssistantMessage(ref, reply);
            return { reply, mode, confidenceSummary };
        }
        return await this.pipelineRejectFinalizeBroaderRefill({
            ref,
            userId,
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

    private pipelineRejectFinalizeBroaderRefill = async (params: {
        ref: ConversationRef;
        userId: string;
        normalizedMessage: string;
        conversation: Conversation;
        jobContext: NonNullable<Conversation["jobContext"]>;
        userCareerProfile: UserCareerProfile;
        rejectedIds: string[];
        rec: JobRecommendationContextState;
        userAccountContext: string;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
        filteredJobs: JobSearchResultItem[];
        orderedPool: JobSearchResultItem[];
        focusJob: JobSearchResultItem;
    }): Promise<ChatMessageResponse> => {
        const {
            ref,
            userId,
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
        } = params;
        const memories = await this.memoryService.getRelevantMemories(userId, normalizedMessage);
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversation,
            "Show another role",
            [focusJob],
            memories,
            userAccountContext
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, filteredJobs);
        const validatedAfterFallback = applyValidatedJobsFallback(
            orderedPool.filter((j) => validJobIds.includes(j.jobId)).slice(0, 10),
            this.validationService.sanitizeReply(jobAwareDecision.reply),
            focusJob
        );
        const selectedJob = validatedAfterFallback.validatedJobs[0] ?? focusJob;
        const queryLabel = jobContext.lastSearchQuery ?? "your direction";
        await this.conversationService.saveJobContext(ref, {
            ...jobContext,
            jobRecommendationContext: {
                ...rec,
                rejectedJobIds: rejectedIds,
            },
            updatedAt: new Date(),
        });
        await this.conversationService.setJobContextAfterSearch(
            ref,
            orderedPool,
            selectedJob,
            queryLabel,
            "BROADER_PIPELINE_REFILL"
        );
        const presentationJobs = [selectedJob];
        const rankedForMatches = this.rankingService.rankJobs(userCareerProfile, presentationJobs);
        const jobMatches = rankedForMatches.map((item) => mapRankedJobResultToChatMatchRow(item));
        const reply = withPipelineClosing(validatedAfterFallback.sanitizedReply);
        await this.conversationService.appendAssistantMessage(ref, reply, presentationJobs);
        return {
            reply,
            jobs: presentationJobs,
            jobMatches,
            mode,
            confidenceSummary,
        };
    };

    private handlePipelineReject = async (params: {
        ref: ConversationRef;
        userId: string;
        normalizedMessage: string;
        conversation: Conversation;
        jobContext: NonNullable<Conversation["jobContext"]>;
        userCareerProfile: UserCareerProfile;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
        userAccountContext: string;
    }): Promise<ChatMessageResponse> => {
        const { ref, userId, normalizedMessage, conversation, jobContext, userCareerProfile, mode, confidenceSummary, userAccountContext } = params;
        const job = jobContext.selectedJobSnapshot;
        const rec = jobContext.jobRecommendationContext;
        if (!job || !rec) {
            const reply = "I do not have an active job recommendation to skip. Ask me for roles and I will suggest one.";
            await this.conversationService.appendAssistantMessage(ref, reply);
            return { reply, mode, confidenceSummary };
        }
        const rejectedIds = rec.rejectedJobIds.includes(job.id) ? rec.rejectedJobIds : [...rec.rejectedJobIds, job.id];
        const excluded = new Set([...rejectedIds, ...rec.acceptedJobIds]);
        const nextJobId = rec.recommendedJobIds.find((id) => !excluded.has(id));
        const nextSanitized = nextJobId ? jobContext.lastReturnedJobs.find((j) => j.id === nextJobId) ?? null : null;

        if (nextSanitized) {
            return await this.pipelineRejectPresentNextSanitizedJob({
                ref,
                jobContext,
                nextSanitized,
                rejectedIds,
                rec,
                userCareerProfile,
                mode,
                confidenceSummary,
            });
        }

        return await this.pipelineRejectRunBroaderRefill({
            ref,
            userId,
            normalizedMessage,
            conversation,
            jobContext,
            userCareerProfile,
            rejectedIds,
            rec,
            excluded,
            userAccountContext,
            mode,
            confidenceSummary,
        });
    };

    private resolveStageFlowForSendMessage = async (params: {
        ref: ConversationRef;
        normalizedMessage: string;
        conversationAfterUserMessage: Conversation;
        currentStage: ReturnType<ConversationStageService["getCurrentStage"]>;
        shouldSkipStages: boolean;
        mode: ConversationMode;
        userAccountContext: string;
        stageProgressWithNote: Conversation["stageProgress"];
        confidenceSummary: CareerConfidenceSummary;
    }): Promise<StageFlowSendMessageResult> => {
        const {
            ref,
            normalizedMessage,
            conversationAfterUserMessage,
            currentStage,
            shouldSkipStages,
            mode,
            userAccountContext,
            stageProgressWithNote,
            confidenceSummary,
        } = params;
        const initialProgress = shouldSkipStages
            ? this.stageService.completeAllStages(stageProgressWithNote)
            : stageProgressWithNote;

        if (!currentStage || shouldSkipStages || mode === "FAST_SEARCH") {
            return { kind: "continue_main_flow", progress: initialProgress };
        }

        const stageReply = await this.llmService.generateStageReply(
            conversationAfterUserMessage,
            normalizedMessage,
            currentStage,
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
            await this.conversationService.updateStageProgress(ref, nextStageProgress);
            await this.conversationService.appendAssistantMessage(ref, stageReply.reply);
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
        ref: ConversationRef;
        normalizedMessage: string;
        conversationAfterUserMessage: Conversation;
        userCareerProfile: UserCareerProfile;
        normalizedQuery: string;
        jobs: JobSearchResultItem[];
        memories: Awaited<ReturnType<ConversationMemoryService["getRelevantMemories"]>>;
        userAccountContext: string;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const {
            ref,
            normalizedMessage,
            conversationAfterUserMessage,
            userCareerProfile,
            normalizedQuery,
            jobs,
            memories,
            userAccountContext,
            mode,
            confidenceSummary,
        } = params;
        const rejectedIds = new Set(conversationAfterUserMessage.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
        const acceptedIds = new Set(conversationAfterUserMessage.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs);
        const eligibleRanked = rankedJobs.filter(
            (item) => !rejectedIds.has(item.job.jobId) && !acceptedIds.has(item.job.jobId)
        );
        const orderedRankedPool = eligibleRanked.slice(0, 15);
        if (orderedRankedPool.length === 0) {
            const exhaustedReply =
                "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";
            await this.conversationService.appendAssistantMessage(ref, exhaustedReply);
            return { reply: exhaustedReply, mode, confidenceSummary };
        }
        const topRankedJobs = orderedRankedPool.map((item) => item.job);
        const focusJob = topRankedJobs[0] ?? null;
        const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversationAfterUserMessage,
            normalizedMessage,
            jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
            memories,
            userAccountContext
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        const fallbackPack = applyValidatedJobsFallback(
            topRankedJobs.filter((jobItem) => validJobIds.includes(jobItem.jobId)).slice(0, 10),
            this.validationService.sanitizeReply(jobAwareDecision.reply),
            focusJob,
            normalizedQuery
        );
        const sanitizedReply = withPipelineClosing(fallbackPack.sanitizedReply);
        const selectedJob = resolveSelectedJobFromRecommendations(fallbackPack.validatedJobs, validJobIds) ?? focusJob;
        await this.conversationService.setJobContextAfterSearch(
            ref,
            topRankedJobs,
            selectedJob,
            normalizedQuery,
            "WORK_DIRECTION_INTENT"
        );
        const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
        const primaryJobId = presentationJobs[0]?.jobId;
        const jobMatches = rankedJobs
            .filter((item) => item.jobId === primaryJobId)
            .map((item) => mapRankedJobResultToChatMatchRow(item));
        await this.conversationService.appendAssistantMessage(ref, sanitizedReply, presentationJobs);
        return {
            reply: sanitizedReply,
            jobs: presentationJobs.length > 0 ? presentationJobs : fallbackPack.validatedJobs,
            jobMatches,
            mode,
            confidenceSummary,
        };
    };

    private respondAfterSearchPlan = async (params: {
        ref: ConversationRef;
        normalizedMessage: string;
        conversationForDecision: Conversation;
        userCareerProfile: UserCareerProfile;
        jobs: JobSearchResultItem[];
        memories: Awaited<ReturnType<ConversationMemoryService["getRelevantMemories"]>>;
        userAccountContext: string;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
        domainExplorationTarget: ReturnType<typeof detectDomainExplorationTarget>;
    }): Promise<ChatMessageResponse> => {
        const {
            ref,
            normalizedMessage,
            conversationForDecision,
            userCareerProfile,
            jobs,
            memories,
            userAccountContext,
            mode,
            confidenceSummary,
            domainExplorationTarget,
        } = params;
        const rejectedIds = new Set(conversationForDecision.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
        const acceptedIds = new Set(conversationForDecision.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs);
        const eligibleRanked = rankedJobs.filter(
            (item) => !rejectedIds.has(item.job.jobId) && !acceptedIds.has(item.job.jobId)
        );
        const orderedRankedPool = eligibleRanked.slice(0, 15);
        if (orderedRankedPool.length === 0) {
            const exhaustedReply =
                "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";
            await this.conversationService.appendAssistantMessage(ref, exhaustedReply);
            return { reply: exhaustedReply, mode, confidenceSummary };
        }
        const topRankedJobs = orderedRankedPool.map((item) => item.job);
        const focusJob = topRankedJobs[0] ?? null;
        const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversationForDecision,
            normalizedMessage,
            jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
            memories,
            userAccountContext
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        const recommendedDirections = await this.knowledgeService.suggestDirections(userCareerProfile);
        const fallbackPack = applyValidatedJobsFallback(
            topRankedJobs.filter((jobItem) => validJobIds.includes(jobItem.jobId)).slice(0, 10),
            this.validationService.sanitizeReply(jobAwareDecision.reply),
            focusJob
        );
        const sanitizedReply = withPipelineClosing(fallbackPack.sanitizedReply);
        const selectedJob = resolveSelectedJobFromRecommendations(fallbackPack.validatedJobs, validJobIds) ?? focusJob;
        await this.conversationService.setJobContextAfterSearch(
            ref,
            topRankedJobs,
            selectedJob,
            normalizedMessage,
            domainExplorationTarget ? "DOMAIN_EXPLORATION" : "SEARCH_PLAN"
        );
        const replyWithDomainContext = domainExplorationTarget
            ? `${domainExplorationTarget.intro}\n${sanitizedReply}`
            : sanitizedReply;
        const presentationJobs = fallbackPack.validatedJobs.slice(0, 1);
        const primaryJobId = presentationJobs[0]?.jobId;
        const jobMatches = rankedJobs
            .filter((item) => item.jobId === primaryJobId)
            .map((item) => mapRankedJobResultToChatMatchRow(item));

        await this.conversationService.appendAssistantMessage(ref, replyWithDomainContext, presentationJobs);

        return {
            reply: replyWithDomainContext,
            jobs: presentationJobs.length > 0 ? presentationJobs : fallbackPack.validatedJobs,
            jobMatches,
            recommendedDirections,
            mode,
            confidenceSummary,
        };
    };

    private prepareSendMessageContext = async (params: {
        userId: string;
        normalizedMessage: string;
        profile: ProfileInput | undefined;
        requestedConversationId: string | undefined;
    }): Promise<SendMessagePreparedContext> => {
        const { userId, normalizedMessage, profile, requestedConversationId } = params;
        const profileAchievements = this.conversationService.getProfileAchievements(profile);
        const { conversationId: resolvedConversationId } = await this.conversationService.ensureConversationExists(
            userId,
            profileAchievements,
            requestedConversationId
        );
        const ref: ConversationRef = { userId, conversationId: resolvedConversationId };
        await this.profileService.updateProfileFromInput(userId, profile);
        await this.conversationService.appendUserMessage(ref, normalizedMessage);

        const serverUser = await this.externalService.readUserPublicProfile(userId).catch(() => null);
        const userAccountContext = buildUserAccountContext({ serverUser, profile });

        const conversationAfterUserMessage = await this.conversationService.getConversationOrThrow(ref);
        const memories = await this.memoryService.getRelevantMemories(userId, normalizedMessage);
        const baseCareerProfile = await this.profileService.getOrCreateProfile(userId);
        const achievementInference = this.achievementInferenceService.inferFromMessage(normalizedMessage);
        const workStyleInference = this.workStyleInferenceService.inferFromMessage(normalizedMessage);
        const aggregatedExplicitSkills = [...new Set(achievementInference.achievements.flatMap((item) => item.skills))];
        const aggregatedInferredSkills = [...new Set(achievementInference.achievements.flatMap((item) => item.inferredSkills))];
        const inferredSignalUpdate = this.toSignalUpdateFromInferences(
            normalizedMessage,
            aggregatedExplicitSkills,
            aggregatedInferredSkills,
            workStyleInference.signals
        );
        const userCareerProfile = await this.profileService.mergeProfileSignals(baseCareerProfile, inferredSignalUpdate);
        await this.memoryService.saveSignalsAsMemories(userId, conversationAfterUserMessage, inferredSignalUpdate);
        await this.externalService.upsertKnownSkills(userId, aggregatedExplicitSkills).catch(() => null);
        const confidenceSummary = this.confidenceService.calculateConfidence(userCareerProfile);
        const mode = this.modeService.detectMode(normalizedMessage, userCareerProfile, confidenceSummary);
        const followUpIntent = this.followUpIntentService.detect(normalizedMessage);
        const jobContext = conversationAfterUserMessage.jobContext;
        return {
            ref,
            userId,
            normalizedMessage,
            profile,
            userAccountContext,
            conversationAfterUserMessage,
            memories,
            userCareerProfile,
            confidenceSummary,
            mode,
            followUpIntent,
            jobContext,
        };
    };

    private tryPipelineShortcutResponse = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse | null> => {
        const awaitingPipelineDecision =
            ctx.jobContext?.jobRecommendationContext?.awaitingPipelineDecision === true
            && Boolean(ctx.jobContext.selectedJobSnapshot && ctx.jobContext.jobRecommendationContext);
        const pipelineIntent = awaitingPipelineDecision ? this.pipelineIntentService.detect(ctx.normalizedMessage) : null;
        if (pipelineIntent === "PIPELINE_ACCEPT" && ctx.jobContext) {
            return await this.handlePipelineAccept({
                ref: ctx.ref,
                userId: ctx.userId,
                jobContext: ctx.jobContext,
                mode: ctx.mode,
                confidenceSummary: ctx.confidenceSummary,
            });
        }
        if (pipelineIntent === "PIPELINE_REJECT" && ctx.jobContext) {
            return await this.handlePipelineReject({
                ref: ctx.ref,
                userId: ctx.userId,
                normalizedMessage: ctx.normalizedMessage,
                conversation: ctx.conversationAfterUserMessage,
                jobContext: ctx.jobContext,
                userCareerProfile: ctx.userCareerProfile,
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
        const resolution = this.selectionResolverService.resolve(
            ctx.normalizedMessage,
            ctx.jobContext.selectedJobSnapshot,
            ctx.jobContext.lastReturnedJobs
        );
        if (resolution.status === "missing") {
            const missingMessage = "I do not have stored jobs in context yet. Ask me for jobs first, and I will keep them for follow-up questions.";
            await this.conversationService.appendAssistantMessage(ctx.ref, missingMessage);
            return { reply: missingMessage, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }
        if (resolution.status === "ambiguous") {
            const question = this.followUpAnswerService.buildDisambiguationQuestion(resolution.options);
            await this.conversationService.appendAssistantMessage(ctx.ref, question);
            return { reply: question, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        const followUpReply = this.followUpAnswerService.buildAnswer(
            ctx.followUpIntent.requestedField,
            resolution.job,
            ctx.normalizedMessage,
            ctx.userCareerProfile
        );
        await this.conversationService.setSelectedJob(ctx.ref, resolution.job);
        await this.conversationService.appendAssistantMessage(ctx.ref, followUpReply);
        return { reply: followUpReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
    };

    private tryWorkDirectionShortcutResponse = async (
        ctx: SendMessagePreparedContext,
        extractedWorkDirection: string | null,
        domainExplorationTarget: ReturnType<typeof detectDomainExplorationTarget>
    ): Promise<ChatMessageResponse | null> => {
        if (!isWorkDirectionIntent(ctx.normalizedMessage)) {
            return null;
        }
        const normalizedQuery = extractedWorkDirection ?? domainExplorationTarget?.domain ?? ctx.normalizedMessage;
        const workDirectionFilters = buildWorkDirectionFilters(normalizedQuery);
        const searchPlan = this.searchPlanService.buildPlan(ctx.userCareerProfile, workDirectionFilters);
        console.info(
            `[CHAT][SEARCH] userId=${ctx.userId} trigger=WORK_DIRECTION_INTENT query="${normalizedQuery}" filters=${JSON.stringify(workDirectionFilters)} planSearches=${searchPlan.searches.length}`
        );
        const jobs = await this.externalService.searchJobsByPlan(searchPlan);
        console.info(`[CHAT][SEARCH] userId=${ctx.userId} trigger=WORK_DIRECTION_INTENT results=${jobs.length}`);
        if (jobs.length === 0) {
            const fallback = normalizedQuery.toLowerCase().includes("cyber")
                ? `I searched for ${normalizedQuery} roles but didn’t find exact matches. I can broaden it to beginner-friendly cybersecurity roles like SOC Analyst, Cybersecurity Analyst, Security QA, or Vulnerability Analyst.`
                : `I searched for ${normalizedQuery} roles but didn’t find exact matches. I can broaden this to related beginner-friendly roles and adjacent directions.`;
            await this.conversationService.appendAssistantMessage(ctx.ref, fallback);
            return { reply: fallback, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        return await this.respondAfterWorkDirectionSearch({
            ref: ctx.ref,
            normalizedMessage: ctx.normalizedMessage,
            conversationAfterUserMessage: ctx.conversationAfterUserMessage,
            userCareerProfile: ctx.userCareerProfile,
            normalizedQuery,
            jobs,
            memories: ctx.memories,
            userAccountContext: ctx.userAccountContext,
            mode: ctx.mode,
            confidenceSummary: ctx.confidenceSummary,
        });
    };

    private finalizeSendMessageFromLlmDecision = async (params: {
        ctx: SendMessagePreparedContext;
        conversationForDecision: Conversation;
        domainExplorationTarget: ReturnType<typeof detectDomainExplorationTarget>;
        forceDomainExplorationSearch: boolean;
    }): Promise<ChatMessageResponse> => {
        const { ctx, conversationForDecision, domainExplorationTarget, forceDomainExplorationSearch } = params;
        const llmDecision = await this.llmService.decideNextStep(
            conversationForDecision,
            ctx.normalizedMessage,
            ctx.memories,
            ctx.mode,
            ctx.userAccountContext
        );
        const effectiveSearchFilters = domainExplorationTarget
            ? buildDomainExplorationFilters(domainExplorationTarget, llmDecision.searchFilters, ctx.userCareerProfile.technologies)
            : llmDecision.searchFilters;
        const shouldSearchJobs = shouldRunJobSearch(
            ctx.mode,
            llmDecision.shouldSearchJobs,
            ctx.confidenceSummary.searchReadinessConfidence,
            ctx.confidenceSummary.discoveryConfidence,
            forceDomainExplorationSearch
        );
        console.info(
            `[CHAT][SEARCH] userId=${ctx.userId} trigger=LLM_OR_RULE shouldSearchJobs=${shouldSearchJobs} llmShouldSearch=${llmDecision.shouldSearchJobs} mode=${ctx.mode} filters=${JSON.stringify(effectiveSearchFilters)}`
        );

        if (ctx.mode === "DEEP_DISCOVERY" && !shouldSearchJobs && ctx.confidenceSummary.discoveryConfidence < JOB_SEARCH_DEEP_DISCOVERY_DISCOVERY_MIN) {
            const question = buildDiscoveryQuestion(ctx.normalizedMessage);
            await this.conversationService.appendAssistantMessage(ctx.ref, question);
            return { reply: question, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        if (!shouldSearchJobs) {
            const sanitizedReply = this.validationService.sanitizeReply(llmDecision.reply);
            await this.conversationService.appendAssistantMessage(ctx.ref, sanitizedReply);
            return { reply: sanitizedReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        const searchPlan = this.searchPlanService.buildPlan(ctx.userCareerProfile, effectiveSearchFilters);
        console.info(
            `[CHAT][SEARCH] userId=${ctx.userId} trigger=SEARCH_PLAN planSearches=${searchPlan.searches.length} plan=${JSON.stringify(searchPlan.searches.map((item) => ({ type: item.type, query: item.query })))}`
        );
        const jobs = await this.externalService.searchJobsByPlan(searchPlan);
        console.info(`[CHAT][SEARCH] userId=${ctx.userId} trigger=SEARCH_PLAN results=${jobs.length}`);
        if (jobs.length === 0) {
            const noJobsReply = "I could not find matching jobs yet. Want me to broaden the search toward adjacent roles based on what you enjoy?";
            await this.conversationService.appendAssistantMessage(ctx.ref, noJobsReply);
            return { reply: noJobsReply, mode: ctx.mode, confidenceSummary: ctx.confidenceSummary };
        }

        return await this.respondAfterSearchPlan({
            ref: ctx.ref,
            normalizedMessage: ctx.normalizedMessage,
            conversationForDecision,
            userCareerProfile: ctx.userCareerProfile,
            jobs,
            memories: ctx.memories,
            userAccountContext: ctx.userAccountContext,
            mode: ctx.mode,
            confidenceSummary: ctx.confidenceSummary,
            domainExplorationTarget,
        });
    };

    private runLlmStageAndSearchFlow = async (ctx: SendMessagePreparedContext): Promise<ChatMessageResponse> => {
        const extractedWorkDirection = extractWorkDirectionQuery(ctx.normalizedMessage);
        const domainExplorationTarget = detectDomainExplorationTarget(ctx.normalizedMessage);
        const workDirectionIntent = isWorkDirectionIntent(ctx.normalizedMessage);
        const forceDomainExplorationSearch = domainExplorationTarget !== null || workDirectionIntent;
        console.info(
            `[CHAT][INTENT] userId=${ctx.userId} mode=${ctx.mode} workDirectionIntent=${workDirectionIntent} domainExploration=${domainExplorationTarget?.domain ?? "none"} extractedWorkDirection=${extractedWorkDirection ?? "none"} forceSearch=${forceDomainExplorationSearch}`
        );

        const workDirectionResponse = await this.tryWorkDirectionShortcutResponse(ctx, extractedWorkDirection, domainExplorationTarget);
        if (workDirectionResponse) {
            return workDirectionResponse;
        }

        const currentStage = this.stageService.getCurrentStage(ctx.conversationAfterUserMessage, ctx.normalizedMessage);
        const stageProgressWithNote = currentStage
            ? this.stageService.recordStageMessage(ctx.conversationAfterUserMessage, ctx.normalizedMessage, currentStage.id)
            : ctx.conversationAfterUserMessage.stageProgress;
        const shouldSkipStages = isStageSkipRequested(ctx.normalizedMessage) || forceDomainExplorationSearch;
        const stageFlow = await this.resolveStageFlowForSendMessage({
            ref: ctx.ref,
            normalizedMessage: ctx.normalizedMessage,
            conversationAfterUserMessage: ctx.conversationAfterUserMessage,
            currentStage,
            shouldSkipStages,
            mode: ctx.mode,
            userAccountContext: ctx.userAccountContext,
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

        await this.conversationService.updateStageProgress(ctx.ref, stageFlow.progress);

        const conversationForDecision = {
            ...ctx.conversationAfterUserMessage,
            stageProgress: stageFlow.progress,
        };

        const updatedAchievements = await this.externalService
            .upsertAchievementFromUserMessage(ctx.userId, ctx.normalizedMessage, conversationForDecision.achievements)
            .catch(() => null);

        if (updatedAchievements) {
            await this.conversationService.updateAchievements(ctx.ref, updatedAchievements);
        }

        return await this.finalizeSendMessageFromLlmDecision({
            ctx,
            conversationForDecision,
            domainExplorationTarget,
            forceDomainExplorationSearch,
        });
    };

    sendMessage = async (userId: string, message: string, profile?: ProfileInput, conversationId?: string): Promise<ChatMessageResponse> => {
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
        });
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
