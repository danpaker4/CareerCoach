import type { ProfileInput } from "../conversation/conversation.types";
import type { Conversation } from "../conversation/conversation.model";
import type { ChatMessageResponse, UnifiedUserProfileResponse } from "../chat.types";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { ChatLlmService } from "../llm/chat.llm.service";
import { ChatValidationService } from "../llm/chat.validation.service";
import { ChatExternalService } from "./external-route/chat.external.service";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ConversationMemoryService } from "../memory/conversation-memory.service";
import { CareerConfidenceService } from "../coach/career-confidence.service";
import { ConversationModeService } from "../coach/conversation-mode.service";
import { AchievementInferenceService } from "../inference/achievement-inference.service";
import { WorkStyleInferenceService } from "../inference/work-style-inference.service";
import { JobSearchPlanService } from "../search/job-search-plan.service";
import { JobRankingService } from "../ranking/job-ranking.service";
import { toPublicCareerProfileView } from "../career-profile/career-profile.utils";
import { CareerKnowledgeService } from "../knowledge/career-knowledge.service";
import type { CareerProfileSignalUpdate, CareerSignal, UserCareerProfile } from "../career-profile/career-profile.types";
import type { CareerConfidenceSummary } from "../coach/career-confidence.types";
import type { ConversationMode } from "../coach/conversation-mode.types";
import type { JobSearchRequest, JobSearchResultItem } from "../chat.types";
import { JobFollowUpIntentService } from "../job-context/job-follow-up-intent.service";
import { JobSelectionResolverService } from "../job-context/job-selection-resolver.service";
import { JobFollowUpAnswerService } from "../job-context/job-follow-up-answer.service";
import { PipelineIntentService } from "../pipeline/pipeline-intent.service";
import { PipelineService } from "../pipeline/pipeline.service";
import type { SanitizedJob } from "../job-context/job-context.types";
import { CareerPlanningModeService } from "../career-planning/career-planning-mode.service";
import type { CareerPlanningMode, CareerPlanningModeResolution } from "../career-planning/career-planning.types";
import { dreamJobConfidenceThreshold } from "../dream-job/dream-job.consts";
import { DreamJobService, type DreamJobPersistResult } from "../dream-job/dream-job.service";
import { ChatSearchIntentService } from "../intent/chat-search-intent.service";
import type { DomainExplorationTarget } from "../intent/chat-search-intent.service";
import type { FuturePlanningUserSnapshot } from "../llm/chat.future-planning.prompt.utils";
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
        private readonly pipelineService: PipelineService,
        private readonly careerPlanningModeService: CareerPlanningModeService,
        private readonly dreamJobService: DreamJobService,
        private readonly searchIntentService: ChatSearchIntentService
    ) { }

    private readonly readDreamJobTitleFromUserSnapshot = (user: Record<string, unknown> | null): string | null => {
        if (!user || typeof user.dreamJob !== "string") {
            return null;
        }
        const trimmed = user.dreamJob.trim();
        return trimmed.length > 0 ? trimmed : null;
    };

    private readonly readFuturePlanningUserSnapshot = (user: Record<string, unknown> | null): FuturePlanningUserSnapshot => {
        const savedDreamJobLabel = this.readDreamJobTitleFromUserSnapshot(user);
        if (!user || typeof user.dreamJobConfidence !== "number" || !Number.isFinite(user.dreamJobConfidence)) {
            return { savedDreamJobLabel, savedDreamJobConfidence: null };
        }
        return { savedDreamJobLabel, savedDreamJobConfidence: user.dreamJobConfidence };
    };

    private readonly persistCareerPlanningResolution = async (
        userId: string,
        resolution: CareerPlanningModeResolution
    ): Promise<void> => {
        const payload: { careerPlanningMode?: CareerPlanningMode; careerPlanningDistinctionAskedAt?: Date } = {};
        if (resolution.nextStoredMode !== null) {
            payload.careerPlanningMode = resolution.nextStoredMode;
        }
        if (resolution.shouldSetDistinctionAskedAt) {
            payload.careerPlanningDistinctionAskedAt = new Date();
        }
        if (payload.careerPlanningMode === undefined && payload.careerPlanningDistinctionAskedAt === undefined) {
            return;
        }
        await this.conversationService.updateCareerPlanningState(userId, payload);
    };

    getConversation = async (userId: string) => this.conversationService.getConversationResponse(userId);

    getUnifiedUserProfile = async (
        userId: string,
        usersAuthHeader?: string | null
    ): Promise<UnifiedUserProfileResponse> => {
        const [user, careerProfile] = await Promise.all([
            this.externalService.readUserPublicProfile(userId, usersAuthHeader),
            this.profileService.findByUserId(userId),
        ]);
        return {
            userId,
            user,
            careerProfile: careerProfile ? toPublicCareerProfileView(careerProfile) : null,
        };
    };

    private isStageSkipRequested = (message: string): boolean => {
        const normalized = message.toLowerCase();
        const skipSignals = [
            "skip stage",
            "skip to jobs",
            "jump to jobs",
            "show me jobs",
            "find jobs now",
            "go to final stage",
        ];
        return skipSignals.some((signal) => normalized.includes(signal));
    };

    private buildDiscoveryQuestion = (message: string): string => {
        const normalized = message.toLowerCase();
        if (normalized.includes("don't know") || normalized.includes("not sure") || normalized.includes("no idea")) {
            return "No problem. Which sounds more interesting now: building apps, solving technical bugs, analyzing data, helping customers, or managing projects?";
        }
        return "Would you rather build something, investigate systems, explain things to people, or improve team processes?";
    };

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

    private shouldRunJobSearch = (
        allowsMongoJobSearch: boolean,
        mode: ConversationMode,
        llmShouldSearch: boolean,
        searchReadinessConfidence: number,
        discoveryConfidence: number,
        forceDomainExplorationSearch: boolean
    ): boolean => {
        if (!allowsMongoJobSearch) {
            return false;
        }
        if (forceDomainExplorationSearch) {
            return true;
        }
        if (mode === "FAST_SEARCH" && searchReadinessConfidence >= 55) {
            return true;
        }
        return llmShouldSearch;
    };

    private buildWorkDirectionFilters = (direction: string): JobSearchRequest => {
        const normalized = direction.toLowerCase();
        const isCyber = normalized.includes("cyber") || normalized.includes("penetration") || normalized.includes("soc") || normalized.includes("security");
        const cyberKeywords = [
            "Junior Penetration Tester",
            "Penetration Tester",
            "Cybersecurity",
            "Security Testing",
            "Vulnerability Assessment",
            "Ethical Hacking",
            "Application Security",
        ];
        const commonKeywords = [direction, ...direction.split(" ").filter((part) => part.length > 2)];
        const keywords = isCyber ? [...new Set([...commonKeywords, ...cyberKeywords])] : [...new Set(commonKeywords)];
        const interests = isCyber ? ["cybersecurity", "security analyst", direction] : [direction];

        return {
            skills: [],
            interests,
            experienceLevel: "",
            keywords,
        };
    };

    private buildDeterministicJobsReply = (
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

    private buildDomainExplorationFilters = (
        target: DomainExplorationTarget,
        llmFilters: JobSearchRequest,
        profileTechnologies: readonly { value: string }[]
    ): JobSearchRequest => {
        const skills = [...new Set([...llmFilters.skills, ...profileTechnologies.map((item) => item.value)])];
        const interests = [...new Set([...llmFilters.interests, target.domain, ...target.roleHints])];
        const keywords = [...new Set([...llmFilters.keywords, ...target.keywords, ...target.roleHints])];
        return {
            skills,
            interests,
            experienceLevel: llmFilters.experienceLevel,
            keywords,
        };
    };

    private resolveSelectedJobFromRecommendations = (
        validatedJobs: readonly JobSearchResultItem[],
        validJobIds: readonly string[]
    ): JobSearchResultItem | null => {
        if (validatedJobs.length === 1) {
            return validatedJobs[0] ?? null;
        }
        if (validJobIds.length === 1) {
            const selectedById = validatedJobs.find((job) => job.jobId === validJobIds[0]);
            return selectedById ?? null;
        }
        return null;
    };

    private withPipelineClosing = (reply: string, includePipelinePrompt: boolean): string => {
        const trimmed = reply.trim();
        if (!includePipelinePrompt) {
            return trimmed;
        }
        const lowered = trimmed.toLowerCase();
        if (lowered.includes("pipeline") && lowered.includes("?")) {
            return trimmed;
        }
        return `${trimmed}\n\nWould you like to move forward with this role and add it to your pipeline?`;
    };

    private sanitizedJobToSearchItem = (job: SanitizedJob): JobSearchResultItem => ({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        seniority: job.seniority,
        description: job.description,
        url: job.url,
        salary: typeof job.salary === "number" ? job.salary : undefined,
        requirements: job.requirements,
        mustKnowSkills: job.mustKnowSkills,
        niceToHaveSkills: job.niceToHaveSkills,
        benefits: job.benefits,
        location: job.location,
    });

    private buildFocusedDeterministicJobReply = (
        job: { jobTitle: string; company?: string; seniority: string },
        directionHint?: string
    ): string => {
        const companyPart = job.company && job.company.trim().length > 0 ? ` at ${job.company.trim()}` : "";
        const direction = directionHint ? `For ${directionHint}, ` : "";
        return `${direction}here is a strong match:\n${job.jobTitle}${companyPart}\nSeniority: ${job.seniority}`;
    };

    private buildBroaderJobSearchFilters = (jobContext: Conversation["jobContext"], profile: UserCareerProfile): JobSearchRequest => {
        const query = jobContext?.lastSearchQuery?.trim();
        if (query && query.length > 0) {
            const base = this.buildWorkDirectionFilters(query);
            return {
                ...base,
                keywords: [...new Set([...base.keywords, "entry level", "junior", "associate", "related"])],
                interests: [...new Set([...base.interests, "adjacent roles"])],
            };
        }
        const tech = profile.technologies.slice(0, 6).map((item) => item.value);
        const interests = profile.interests.slice(0, 4).map((item) => item.value);
        const roles = profile.preferredRoles.slice(0, 3).map((item) => item.value);
        return {
            skills: tech,
            interests: interests.length > 0 ? interests : ["career exploration"],
            experienceLevel: "",
            keywords: [...new Set([...roles, "junior", "entry level", "related"])],
        };
    };

    private handlePipelineAccept = async (params: {
        userId: string;
        jobContext: NonNullable<Conversation["jobContext"]>;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
    }): Promise<ChatMessageResponse> => {
        const { userId, jobContext, mode, confidenceSummary } = params;
        const job = jobContext.selectedJobSnapshot;
        const rec = jobContext.jobRecommendationContext;
        if (!job || !rec) {
            const reply = "I do not have an active job recommendation to add yet. Ask me for roles and I will suggest one.";
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode, confidenceSummary };
        }
        const result = await this.pipelineService.addJobToPipeline(userId, job);
        if (result.status === "error") {
            const reply =
                "I could not add that role to your pipeline from here. You can add it from the Jobs page, or tell me if you want to keep exploring other roles.";
            await this.conversationService.appendAssistantMessage(userId, reply);
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
        await this.conversationService.saveJobContext(userId, nextContext);
        await this.conversationService.appendAssistantMessage(userId, reply);
        return { reply, mode, confidenceSummary };
    };

    private handlePipelineReject = async (params: {
        userId: string;
        normalizedMessage: string;
        conversation: Conversation;
        jobContext: NonNullable<Conversation["jobContext"]>;
        userCareerProfile: UserCareerProfile;
        mode: ConversationMode;
        confidenceSummary: CareerConfidenceSummary;
        isFuturePlanning: boolean;
        dreamJobTitleForRank: string | null;
        allowPipelineClosing: boolean;
    }): Promise<ChatMessageResponse> => {
        const {
            userId,
            normalizedMessage,
            conversation,
            jobContext,
            userCareerProfile,
            mode,
            confidenceSummary,
            isFuturePlanning,
            dreamJobTitleForRank,
            allowPipelineClosing,
        } = params;
        const memories = await this.memoryService.getRelevantMemories(userId, normalizedMessage);
        const job = jobContext.selectedJobSnapshot;
        const rec = jobContext.jobRecommendationContext;
        if (!job || !rec) {
            const reply = "I do not have an active job recommendation to skip. Ask me for roles and I will suggest one.";
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode, confidenceSummary };
        }
        const rejectedIds = rec.rejectedJobIds.includes(job.id) ? rec.rejectedJobIds : [...rec.rejectedJobIds, job.id];
        const excluded = new Set([...rejectedIds, ...rec.acceptedJobIds]);
        const nextJobId = rec.recommendedJobIds.find((id) => !excluded.has(id));
        const nextSanitized = nextJobId ? jobContext.lastReturnedJobs.find((j) => j.id === nextJobId) ?? null : null;

        if (nextSanitized) {
            const nextItem = this.sanitizedJobToSearchItem(nextSanitized);
            const ranked = this.rankingService.rankJobs(userCareerProfile, [nextItem], dreamJobTitleForRank);
            const top = ranked[0];
            const reasonsText = top.reasons.join(" ");
            const reply = this.withPipelineClosing(
                `No problem. Another role that may fit is:\n${nextSanitized.title} — ${nextSanitized.company}\n\n${reasonsText}`,
                allowPipelineClosing
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
            await this.conversationService.saveJobContext(userId, nextContext);
            const jobMatches = [
                {
                    jobId: top.jobId,
                    title: top.job.jobTitle,
                    matchScore: top.finalScore,
                    matchReasons: top.reasons,
                    possibleConcerns: top.concerns,
                    missingSkills: top.missingSkills,
                    growthPotential:
                        top.scoreBreakdown.growthPotentialScore >= 60
                            ? "Good growth potential based on role trajectory."
                            : "Moderate growth potential. Might require clearer progression steps.",
                    whyThisFitsUser: top.reasons.join(" "),
                    nextStepSuggestion:
                        top.missingSkills.length > 0
                            ? `Strengthen ${top.missingSkills[0]} and then apply.`
                            : "Apply and tailor your resume to the highlighted responsibilities.",
                },
            ];
            await this.conversationService.appendAssistantMessage(userId, reply, [nextItem]);
            return { reply, jobs: [nextItem], jobMatches, mode, confidenceSummary };
        }

        if (isFuturePlanning) {
            const reply =
                "If you want to stay in long-term exploration without pulling new job listings, tell me what felt closer last time: building products, deep technical problems, helping people, or researching how things work.";
            const now = new Date();
            await this.conversationService.saveJobContext(userId, {
                ...jobContext,
                jobRecommendationContext: {
                    ...rec,
                    rejectedJobIds: rejectedIds,
                    awaitingPipelineDecision: false,
                    lastRecommendationAt: now,
                },
                updatedAt: now,
            });
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode, confidenceSummary };
        }

        const broaderFilters = this.buildBroaderJobSearchFilters(jobContext, userCareerProfile);
        const broaderPlan = this.searchPlanService.buildBroaderPlan(userCareerProfile, broaderFilters);
        const searchedJobs = await this.externalService.searchJobsByPlan(broaderPlan);
        const filteredJobs = searchedJobs.filter((j) => !excluded.has(j.jobId));
        if (filteredJobs.length === 0) {
            const reply =
                "I do not have another stored match right now, and a broader search did not surface a new role yet. Try naming a nearby title or domain you are curious about, and I will search again.";
            const now = new Date();
            const nextContext = {
                ...jobContext,
                jobRecommendationContext: {
                    ...rec,
                    rejectedJobIds: rejectedIds,
                    awaitingPipelineDecision: false,
                    lastRecommendationAt: now,
                },
                updatedAt: now,
            };
            await this.conversationService.saveJobContext(userId, nextContext);
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode, confidenceSummary };
        }
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, filteredJobs, dreamJobTitleForRank);
        const orderedPool = rankedJobs.slice(0, 15).map((item) => item.job);
        const focusJob = orderedPool[0] ?? null;
        if (!focusJob) {
            const reply = "I could not find another role to suggest yet. Tell me a role family or skill area to lean into, and I will search again.";
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode, confidenceSummary };
        }
        const jobAwareDecision = await this.llmService.generateJobAwareReply(conversation, "Show another role", [focusJob], memories);
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, filteredJobs);
        let validatedJobs = orderedPool.filter((j) => validJobIds.includes(j.jobId)).slice(0, 10);
        let sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);
        if (validatedJobs.length === 0) {
            validatedJobs = [focusJob];
            sanitizedReply = this.buildFocusedDeterministicJobReply(focusJob);
        }
        const selectedJob = validatedJobs[0] ?? focusJob;
        const queryLabel = jobContext.lastSearchQuery ?? "your direction";
        await this.conversationService.saveJobContext(userId, {
            ...jobContext,
            jobRecommendationContext: {
                ...rec,
                rejectedJobIds: rejectedIds,
            },
            updatedAt: new Date(),
        });
        await this.conversationService.setJobContextAfterSearch(
            userId,
            orderedPool,
            selectedJob,
            queryLabel,
            "BROADER_PIPELINE_REFILL"
        );
        const presentationJobs = [selectedJob];
        const rankedForMatches = this.rankingService.rankJobs(userCareerProfile, presentationJobs, dreamJobTitleForRank);
        const jobMatches = rankedForMatches.map((item) => ({
            jobId: item.jobId,
            title: item.job.jobTitle,
            matchScore: item.finalScore,
            matchReasons: item.reasons,
            possibleConcerns: item.concerns,
            missingSkills: item.missingSkills,
            growthPotential:
                item.scoreBreakdown.growthPotentialScore >= 60
                    ? "Good growth potential based on role trajectory."
                    : "Moderate growth potential. Might require clearer progression steps.",
            whyThisFitsUser: item.reasons.join(" "),
            nextStepSuggestion:
                item.missingSkills.length > 0
                    ? `Strengthen ${item.missingSkills[0]} and then apply.`
                    : "Apply and tailor your resume to the highlighted responsibilities.",
        }));
        const reply = this.withPipelineClosing(sanitizedReply, allowPipelineClosing);
        await this.conversationService.appendAssistantMessage(userId, reply, presentationJobs);
        return {
            reply,
            jobs: presentationJobs,
            jobMatches,
            mode,
            confidenceSummary,
        };
    };

    sendMessage = async (
        userId: string,
        message: string,
        profile?: ProfileInput,
        usersAuthHeader?: string | null
    ): Promise<ChatMessageResponse> => {
        const normalizedMessage = message.trim();
        if (normalizedMessage.length === 0) {
            throw new Error("Message is required");
        }
        console.info(`[CHAT][INTENT] userId=${userId} incoming="${normalizedMessage}"`);

        // get profile achievements
        const profileAchievements = this.conversationService.getProfileAchievements(profile);
        // ensure conversation exists
        await this.conversationService.ensureConversationExists(userId, profileAchievements);
        await this.profileService.updateProfileFromInput(userId, profile);
        await this.conversationService.appendUserMessage(userId, normalizedMessage);

        // get conversation after user message
        const conversationAfterUserMessage = await this.conversationService.getConversationOrThrow(userId);
        const memories = await this.memoryService.getRelevantMemories(userId, normalizedMessage);
        let userCareerProfile = await this.profileService.getOrCreateProfile(userId);
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
        userCareerProfile = await this.profileService.mergeProfileSignals(userCareerProfile, inferredSignalUpdate);
        await this.memoryService.saveSignalsAsMemories(userId, conversationAfterUserMessage, inferredSignalUpdate);
        await this.externalService.upsertKnownSkills(userId, aggregatedExplicitSkills, usersAuthHeader).catch(() => null);
        const confidenceSummary = this.confidenceService.calculateConfidence(userCareerProfile);
        const isBackgroundOnly = this.searchIntentService.isBackgroundInformationIntent(normalizedMessage.toLowerCase());
        const careerPlanningResolution = this.careerPlanningModeService.resolve(
            conversationAfterUserMessage,
            normalizedMessage,
            { isBackgroundOnlyMessage: isBackgroundOnly }
        );
        await this.persistCareerPlanningResolution(userId, careerPlanningResolution);
        if (careerPlanningResolution.shouldAskDistinctionQuestion) {
            const reply = careerPlanningResolution.useBackgroundAckDistinction
                ? this.careerPlanningModeService.buildBackgroundAckAndTimelineQuestion(normalizedMessage)
                : this.careerPlanningModeService.distinctionQuestionTemplate;
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode: "GUIDED", confidenceSummary };
        }

        const mode = this.modeService.detectMode(normalizedMessage, userCareerProfile, confidenceSummary);
        const careerMode = careerPlanningResolution.effectiveMode;
        const isFuturePlanning = careerMode === "FUTURE_PLANNING";
        const isImmediatePlanning = careerMode === "IMMEDIATE";
        const shouldLoadUserProfileSnapshot = isImmediatePlanning || isFuturePlanning;
        const userProfileSnapshot = shouldLoadUserProfileSnapshot
            ? await this.externalService.readUserPublicProfile(userId, usersAuthHeader)
            : null;
        const dreamJobTitleForRank = this.readDreamJobTitleFromUserSnapshot(
            isImmediatePlanning ? userProfileSnapshot : null
        );
        const followUpIntent = this.followUpIntentService.detect(normalizedMessage);
        const jobContext = conversationAfterUserMessage.jobContext;
        const hasStoredJobs = (jobContext?.lastReturnedJobs.length ?? 0) > 0;
        const awaitingPipelineDecision =
            jobContext?.jobRecommendationContext?.awaitingPipelineDecision === true &&
            Boolean(jobContext.selectedJobSnapshot && jobContext.jobRecommendationContext);
        const pipelineIntent = awaitingPipelineDecision ? this.pipelineIntentService.detect(normalizedMessage) : null;
        if (pipelineIntent === "PIPELINE_ACCEPT" && jobContext && !isFuturePlanning) {
            return await this.handlePipelineAccept({ userId, jobContext, mode, confidenceSummary });
        }
        if (pipelineIntent === "PIPELINE_REJECT" && jobContext && !isFuturePlanning) {
            const intentForPipelineReject = this.searchIntentService.detectSearchIntent(
                normalizedMessage,
                pipelineIntent,
                followUpIntent.isFollowUp && hasStoredJobs
            );
            const allowPipelineClosingForReject = this.searchIntentService.allowsPipelineClosingQuestion({
                careerPlanningMode: careerMode,
                intent: intentForPipelineReject,
            });
            return await this.handlePipelineReject({
                userId,
                normalizedMessage,
                conversation: conversationAfterUserMessage,
                jobContext,
                userCareerProfile,
                mode,
                confidenceSummary,
                isFuturePlanning,
                dreamJobTitleForRank,
                allowPipelineClosing: allowPipelineClosingForReject,
            });
        }
        if (!isFuturePlanning && hasStoredJobs && followUpIntent.isFollowUp && !followUpIntent.isExplicitNewSearch && jobContext) {
            const resolution = this.selectionResolverService.resolve(
                normalizedMessage,
                jobContext.selectedJobSnapshot,
                jobContext.lastReturnedJobs
            );
            if (resolution.status === "missing") {
                const missingMessage = "I do not have stored jobs in context yet. Ask me for jobs first, and I will keep them for follow-up questions.";
                await this.conversationService.appendAssistantMessage(userId, missingMessage);
                return { reply: missingMessage, mode, confidenceSummary };
            }
            if (resolution.status === "ambiguous") {
                const question = this.followUpAnswerService.buildDisambiguationQuestion(resolution.options);
                await this.conversationService.appendAssistantMessage(userId, question);
                return { reply: question, mode, confidenceSummary };
            }

            const followUpReply = this.followUpAnswerService.buildAnswer(
                followUpIntent.requestedField,
                resolution.job,
                normalizedMessage,
                userCareerProfile
            );
            await this.conversationService.setSelectedJob(userId, resolution.job);
            await this.conversationService.appendAssistantMessage(userId, followUpReply);
            return { reply: followUpReply, mode, confidenceSummary };
        }

        const messageSearchIntent = this.searchIntentService.detectSearchIntent(
            normalizedMessage,
            pipelineIntent,
            followUpIntent.isFollowUp && hasStoredJobs
        );
        const allowsMongoJobSearch = this.searchIntentService.allowsMongoJobSearch({
            careerPlanningMode: careerMode,
            intent: messageSearchIntent,
        });
        const allowPipelineClosing = this.searchIntentService.allowsPipelineClosingQuestion({
            careerPlanningMode: careerMode,
            intent: messageSearchIntent,
        });

        const workDirectionIntent = this.searchIntentService.isWorkDirectionIntent(normalizedMessage);
        const extractedWorkDirection = this.searchIntentService.extractWorkDirectionQuery(normalizedMessage);
        const domainExplorationTarget = this.searchIntentService.detectDomainExplorationTarget(normalizedMessage);
        const forceDomainExplorationSearch =
            allowsMongoJobSearch && (domainExplorationTarget !== null || workDirectionIntent);
        console.info(
            `[CHAT][INTENT] userId=${userId} mode=${mode} careerMode=${careerMode} workDirectionIntent=${workDirectionIntent} domainExploration=${domainExplorationTarget?.domain ?? "none"} extractedWorkDirection=${extractedWorkDirection ?? "none"} allowsMongo=${allowsMongoJobSearch} forceSearch=${forceDomainExplorationSearch} searchIntent=${messageSearchIntent}`
        );

        if (
            careerMode === "UNKNOWN"
            && workDirectionIntent
            && !this.searchIntentService.isExplicitJobSearchIntent(normalizedMessage.toLowerCase())
        ) {
            const reply =
                "Before I search for roles: are you looking to land something soon, or still figuring out longer-term direction? Once I know that, I can suggest a focused next step.";
            await this.conversationService.appendAssistantMessage(userId, reply);
            return { reply, mode, confidenceSummary };
        }

        if (workDirectionIntent && !isFuturePlanning && allowsMongoJobSearch) {
            const normalizedQuery = extractedWorkDirection ?? domainExplorationTarget?.domain ?? normalizedMessage;
            const workDirectionFilters = this.buildWorkDirectionFilters(normalizedQuery);
            const searchPlan = this.searchPlanService.buildPlan(userCareerProfile, workDirectionFilters);
            console.info(
                `[CHAT][SEARCH] userId=${userId} trigger=WORK_DIRECTION_INTENT query="${normalizedQuery}" filters=${JSON.stringify(workDirectionFilters)} planSearches=${searchPlan.searches.length}`
            );
            const jobs = await this.externalService.searchJobsByPlan(searchPlan);
            console.info(`[CHAT][SEARCH] userId=${userId} trigger=WORK_DIRECTION_INTENT results=${jobs.length}`);
            if (jobs.length === 0) {
                const fallback = normalizedQuery.toLowerCase().includes("cyber")
                    ? `I searched for ${normalizedQuery} roles but didn’t find exact matches. I can broaden it to beginner-friendly cybersecurity roles like SOC Analyst, Cybersecurity Analyst, Security QA, or Vulnerability Analyst.`
                    : `I searched for ${normalizedQuery} roles but didn’t find exact matches. I can broaden this to related beginner-friendly roles and adjacent directions.`;
                await this.conversationService.appendAssistantMessage(userId, fallback);
                return { reply: fallback, mode, confidenceSummary };
            }

            const rejectedIds = new Set(conversationAfterUserMessage.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
            const acceptedIds = new Set(conversationAfterUserMessage.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
            const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs, dreamJobTitleForRank);
            const eligibleRanked = rankedJobs.filter(
                (item) => !rejectedIds.has(item.job.jobId) && !acceptedIds.has(item.job.jobId)
            );
            const orderedRankedPool = eligibleRanked.slice(0, 15);
            if (orderedRankedPool.length === 0) {
                const exhaustedReply =
                    "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";
                await this.conversationService.appendAssistantMessage(userId, exhaustedReply);
                return { reply: exhaustedReply, mode, confidenceSummary };
            }
            const topRankedJobs = orderedRankedPool.map((item) => item.job);
            const focusJob = topRankedJobs[0] ?? null;
            const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
            const jobAwareDecision = await this.llmService.generateJobAwareReply(
                conversationAfterUserMessage,
                normalizedMessage,
                jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
                memories
            );
            const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
            let validatedJobs = topRankedJobs.filter((job) => validJobIds.includes(job.jobId)).slice(0, 10);
            let sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);
            if (validatedJobs.length === 0 && focusJob) {
                validatedJobs = [focusJob];
                sanitizedReply = this.buildFocusedDeterministicJobReply(focusJob, normalizedQuery);
            }
            sanitizedReply = this.withPipelineClosing(sanitizedReply, allowPipelineClosing);
            const selectedJob = this.resolveSelectedJobFromRecommendations(validatedJobs, validJobIds) ?? focusJob;
            await this.conversationService.setJobContextAfterSearch(
                userId,
                topRankedJobs,
                selectedJob,
                normalizedQuery,
                "WORK_DIRECTION_INTENT"
            );
            const presentationJobs = validatedJobs.slice(0, 1);
            const primaryJobId = presentationJobs[0]?.jobId;
            const jobMatches = rankedJobs
                .filter((item) => item.jobId === primaryJobId)
                .map((item) => ({
                    jobId: item.jobId,
                    title: item.job.jobTitle,
                    matchScore: item.finalScore,
                    matchReasons: item.reasons,
                    possibleConcerns: item.concerns,
                    missingSkills: item.missingSkills,
                    growthPotential:
                        item.scoreBreakdown.growthPotentialScore >= 60
                            ? "Good growth potential based on role trajectory."
                            : "Moderate growth potential. Might require clearer progression steps.",
                    whyThisFitsUser: item.reasons.join(" "),
                    nextStepSuggestion:
                        item.missingSkills.length > 0
                            ? `Strengthen ${item.missingSkills[0]} and then apply.`
                            : "Apply and tailor your resume to the highlighted responsibilities.",
                }));
            await this.conversationService.appendAssistantMessage(userId, sanitizedReply, presentationJobs);
            return {
                reply: sanitizedReply,
                jobs: presentationJobs.length > 0 ? presentationJobs : validatedJobs,
                jobMatches,
                mode,
                confidenceSummary,
            };
        }

        const currentStage = this.stageService.getCurrentStage(conversationAfterUserMessage, normalizedMessage);
        const stageProgressWithNote = currentStage
            ? this.stageService.recordStageMessage(conversationAfterUserMessage, normalizedMessage, currentStage.id)
            : conversationAfterUserMessage.stageProgress;
        const shouldSkipStages =
            this.isStageSkipRequested(normalizedMessage) || (forceDomainExplorationSearch && !isFuturePlanning);
        let stageProgressForNextFlow = shouldSkipStages
            ? this.stageService.completeAllStages(stageProgressWithNote)
            : stageProgressWithNote;

        if (currentStage && !shouldSkipStages && mode !== "FAST_SEARCH" && !isFuturePlanning && careerMode !== "UNKNOWN") {
            const stageReply = await this.llmService.generateStageReply(conversationAfterUserMessage, normalizedMessage, currentStage, mode);
            const nextStageProgress = this.stageService.applyStageAdvance(stageProgressWithNote, currentStage.id, stageReply.shouldAdvanceStage);
            await this.conversationService.updateStageProgress(userId, nextStageProgress);
            stageProgressForNextFlow = nextStageProgress;

            const conversationAfterStageAdvance = {
                ...conversationAfterUserMessage,
                stageProgress: nextStageProgress,
            };
            const nextStage = this.stageService.getCurrentStage(conversationAfterStageAdvance, normalizedMessage);
            if (nextStage) {
                await this.conversationService.appendAssistantMessage(userId, stageReply.reply);
                return { reply: stageReply.reply, mode, confidenceSummary };
            }
        }

        await this.conversationService.updateStageProgress(userId, stageProgressForNextFlow);

        const conversationForDecision = {
            ...conversationAfterUserMessage,
            stageProgress: stageProgressForNextFlow,
        };

        // upsert achievement from user message
        const updatedAchievements = await this.externalService.upsertAchievementFromUserMessage(
            userId,
            normalizedMessage,
            conversationForDecision.achievements,
            usersAuthHeader
        ).catch(() => null);

        if (updatedAchievements) {
            await this.conversationService.updateAchievements(userId, updatedAchievements);
        }

        if (careerMode === "UNKNOWN") {
            const llmDecisionUnknown = await this.llmService.decideNextStep(
                conversationForDecision,
                normalizedMessage,
                memories,
                mode
            );
            const sanitizedUnknown = this.validationService.sanitizeReply(llmDecisionUnknown.reply);
            await this.conversationService.appendAssistantMessage(userId, sanitizedUnknown);
            return { reply: sanitizedUnknown, mode, confidenceSummary };
        }

        if (isFuturePlanning) {
            const futureUserSnapshot = this.readFuturePlanningUserSnapshot(userProfileSnapshot);
            const priorSavedDreamLabel = this.readDreamJobTitleFromUserSnapshot(userProfileSnapshot);
            const inferred = await this.dreamJobService
                .inferDreamJob({
                    conversation: conversationForDecision,
                    profile: userCareerProfile,
                    userSnapshot: userProfileSnapshot,
                    latestUserMessage: normalizedMessage,
                })
                .catch(() => null);

            if (inferred !== null && inferred.confidence >= dreamJobConfidenceThreshold) {
                const persistResult = await this.dreamJobService
                    .persistDreamJobIfEligible(userId, userProfileSnapshot, inferred, usersAuthHeader)
                    .catch((): DreamJobPersistResult => ({
                        persisted: false,
                        dreamJob: inferred.dreamJob,
                        profileUpdateFailed: true,
                    }));

                const profileHintLine = [
                    ...userCareerProfile.technologies.slice(0, 4).map((t) => t.value),
                    ...userCareerProfile.interests.slice(0, 2).map((i) => i.value),
                ]
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                    .join(", ") || "their background signals";

                const closing = await this.llmService.generateFuturePlanningClosingReply({
                    normalizedDreamJob: persistResult.dreamJob,
                    latestUserMessage: normalizedMessage,
                    profileHintLine,
                    persistedToProfile: persistResult.persisted,
                    profileUpdateFailed: persistResult.profileUpdateFailed ?? false,
                    priorSavedDreamJob: persistResult.persisted ? null : priorSavedDreamLabel,
                });

                const sanitizedClosing = this.validationService.sanitizeReply(closing.reply);
                await this.conversationService.appendAssistantMessage(userId, sanitizedClosing);
                return { reply: sanitizedClosing, mode, confidenceSummary };
            }

            const futureReply = await this.llmService.generateFuturePlanningReply(
                conversationForDecision,
                normalizedMessage,
                memories,
                userCareerProfile,
                futureUserSnapshot
            );
            const sanitizedFuture = this.validationService.sanitizeReply(futureReply.reply);
            await this.conversationService.appendAssistantMessage(userId, sanitizedFuture);
            await this.dreamJobService
                .evaluateAndPersist({
                    userId,
                    conversation: conversationForDecision,
                    profile: userCareerProfile,
                    userSnapshot: userProfileSnapshot,
                    latestUserMessage: normalizedMessage,
                    usersAuthHeader,
                })
                .catch(() => null);
            return { reply: sanitizedFuture, mode, confidenceSummary };
        }

        const llmDecision = await this.llmService.decideNextStep(conversationForDecision, normalizedMessage, memories, mode);
        const effectiveSearchFilters = domainExplorationTarget
            ? this.buildDomainExplorationFilters(domainExplorationTarget, llmDecision.searchFilters, userCareerProfile.technologies)
            : llmDecision.searchFilters;
        const shouldSearchJobs = this.shouldRunJobSearch(
            allowsMongoJobSearch,
            mode,
            llmDecision.shouldSearchJobs,
            confidenceSummary.searchReadinessConfidence,
            confidenceSummary.discoveryConfidence,
            forceDomainExplorationSearch
        );
        console.info(
            `[CHAT][SEARCH] userId=${userId} trigger=LLM_OR_RULE shouldSearchJobs=${shouldSearchJobs} llmShouldSearch=${llmDecision.shouldSearchJobs} mode=${mode} filters=${JSON.stringify(effectiveSearchFilters)}`
        );

        if (
            mode === "DEEP_DISCOVERY"
            && !shouldSearchJobs
            && confidenceSummary.discoveryConfidence < 65
            && !isFuturePlanning
        ) {
            const question = this.buildDiscoveryQuestion(normalizedMessage);
            await this.conversationService.appendAssistantMessage(userId, question);
            return { reply: question, mode, confidenceSummary };
        }

        if (!shouldSearchJobs) {
            const sanitizedReply = this.validationService.sanitizeReply(llmDecision.reply);
            await this.conversationService.appendAssistantMessage(userId, sanitizedReply);
            return { reply: sanitizedReply, mode, confidenceSummary };
        }

        const searchPlan = this.searchPlanService.buildPlan(userCareerProfile, effectiveSearchFilters);
        console.info(
            `[CHAT][SEARCH] userId=${userId} trigger=SEARCH_PLAN planSearches=${searchPlan.searches.length} plan=${JSON.stringify(searchPlan.searches.map((item) => ({ type: item.type, query: item.query })))}`
        );
        const jobs = await this.externalService.searchJobsByPlan(searchPlan);
        console.info(`[CHAT][SEARCH] userId=${userId} trigger=SEARCH_PLAN results=${jobs.length}`);
        if (jobs.length === 0) {
            const noJobsReply = "I could not find matching jobs yet. Want me to broaden the search toward adjacent roles based on what you enjoy?";
            await this.conversationService.appendAssistantMessage(userId, noJobsReply);
            return { reply: noJobsReply, mode, confidenceSummary };
        }
        const rejectedIds = new Set(conversationForDecision.jobContext?.jobRecommendationContext?.rejectedJobIds ?? []);
        const acceptedIds = new Set(conversationForDecision.jobContext?.jobRecommendationContext?.acceptedJobIds ?? []);
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs, dreamJobTitleForRank);
        const eligibleRanked = rankedJobs.filter(
            (item) => !rejectedIds.has(item.job.jobId) && !acceptedIds.has(item.job.jobId)
        );
        const orderedRankedPool = eligibleRanked.slice(0, 15);
        if (orderedRankedPool.length === 0) {
            const exhaustedReply =
                "Every match in the current list was already skipped or saved. Tell me a nearby title, skill, or domain to lean into and I will run a broader search.";
            await this.conversationService.appendAssistantMessage(userId, exhaustedReply);
            return { reply: exhaustedReply, mode, confidenceSummary };
        }
        const topRankedJobs = orderedRankedPool.map((item) => item.job);
        const focusJob = topRankedJobs[0] ?? null;
        const jobsForLlm = focusJob ? [focusJob] : topRankedJobs;
        const jobAwareDecision = await this.llmService.generateJobAwareReply(
            conversationForDecision,
            normalizedMessage,
            jobsForLlm.length > 0 ? jobsForLlm : topRankedJobs,
            memories
        );
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        let validatedJobs = topRankedJobs.filter((job) => validJobIds.includes(job.jobId)).slice(0, 10);
        const recommendedDirections = await this.knowledgeService.suggestDirections(userCareerProfile);
        let sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);
        if (validatedJobs.length === 0 && focusJob) {
            validatedJobs = [focusJob];
            sanitizedReply = this.buildFocusedDeterministicJobReply(focusJob);
        }
        sanitizedReply = this.withPipelineClosing(sanitizedReply, allowPipelineClosing);
        const selectedJob = this.resolveSelectedJobFromRecommendations(validatedJobs, validJobIds) ?? focusJob;
        await this.conversationService.setJobContextAfterSearch(
            userId,
            topRankedJobs,
            selectedJob,
            normalizedMessage,
            domainExplorationTarget ? "DOMAIN_EXPLORATION" : "SEARCH_PLAN"
        );
        const replyWithDomainContext = domainExplorationTarget
            ? `${domainExplorationTarget.intro}\n${sanitizedReply}`
            : sanitizedReply;
        const presentationJobs = validatedJobs.slice(0, 1);
        const primaryJobId = presentationJobs[0]?.jobId;
        const jobMatches = rankedJobs
            .filter((item) => item.jobId === primaryJobId)
            .map((item) => ({
                jobId: item.jobId,
                title: item.job.jobTitle,
                matchScore: item.finalScore,
                matchReasons: item.reasons,
                possibleConcerns: item.concerns,
                missingSkills: item.missingSkills,
                growthPotential:
                    item.scoreBreakdown.growthPotentialScore >= 60
                        ? "Good growth potential based on role trajectory."
                        : "Moderate growth potential. Might require clearer progression steps.",
                whyThisFitsUser: item.reasons.join(" "),
                nextStepSuggestion:
                    item.missingSkills.length > 0
                        ? `Strengthen ${item.missingSkills[0]} and then apply.`
                        : "Apply and tailor your resume to the highlighted responsibilities.",
            }));

        await this.conversationService.appendAssistantMessage(userId, replyWithDomainContext, presentationJobs);

        return {
            reply: replyWithDomainContext,
            jobs: presentationJobs.length > 0 ? presentationJobs : validatedJobs,
            jobMatches,
            recommendedDirections,
            mode,
            confidenceSummary,
        };
    };
}
