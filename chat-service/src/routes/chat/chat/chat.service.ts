import type { ProfileInput } from "../conversation/conversation.types";
import type { ChatMessageResponse } from "../chat.types";
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
import { CareerKnowledgeService } from "../knowledge/career-knowledge.service";
import type { CareerProfileSignalUpdate, CareerSignal } from "../career-profile/career-profile.types";
import type { ConversationMode } from "../coach/conversation-mode.types";
import type { JobSearchRequest, JobSearchResultItem } from "../chat.types";
import { JobFollowUpIntentService } from "../job-context/job-follow-up-intent.service";
import { JobSelectionResolverService } from "../job-context/job-selection-resolver.service";
import { JobFollowUpAnswerService } from "../job-context/job-follow-up-answer.service";

type DomainExplorationTarget = {
    domain: string;
    keywords: string[];
    roleHints: string[];
    intro: string;
};

const DOMAIN_EXPLORATION_PHRASES = [
    "what roles are there",
    "what can i do",
    "what jobs are there",
    "what can you offer me",
    "show me opportunities",
    "what exists in",
    "what can i become",
    "what are the directions",
];

const WORK_DIRECTION_PHRASES = [
    "i want to work in",
    "i'm interested in",
    "im interested in",
    "sounds interesting",
    "i want a job in",
    "i want to be",
    "can i work in",
    "what jobs are there in",
    "what can you offer in",
    "find me",
    "show me jobs in",
    "fits me",
    "maybe",
    "let's go with",
    "lets go with",
    "i choose",
    "i want to start with",
    "search to me a job as",
    "search me a job as",
    "as a",
];

const DOMAIN_TARGETS: DomainExplorationTarget[] = [
    {
        domain: "cybersecurity",
        keywords: ["cybersecurity", "security analyst", "soc", "application security", "qa security testing", "junior cyber"],
        roleHints: ["SOC Analyst", "Security Analyst", "Application Security", "Penetration Tester", "GRC Analyst", "IAM Engineer", "Cloud Security", "DevSecOps", "Security Automation", "Threat Intelligence", "Incident Response"],
        intro: "Based on your background, strong cybersecurity directions include SOC Analyst, Security QA, Application Security Testing, and Junior Security Analyst.",
    },
    {
        domain: "ai",
        keywords: ["ai", "machine learning", "llm", "ml engineer", "ai engineer"],
        roleHints: ["ML Engineer", "AI Engineer", "LLM Application Engineer", "Data Scientist"],
        intro: "AI directions include ML Engineer, AI Engineer, LLM Application Engineer, and Data Scientist.",
    },
    {
        domain: "backend",
        keywords: ["backend", "api", "node.js", "java", "python backend"],
        roleHints: ["Backend Engineer", "Platform Engineer", "API Engineer"],
        intro: "Backend directions include Backend Engineer, API Engineer, and Platform Engineer.",
    },
    {
        domain: "devops",
        keywords: ["devops", "platform", "sre", "infrastructure", "kubernetes"],
        roleHints: ["DevOps Engineer", "SRE", "Platform Engineer", "Cloud Engineer"],
        intro: "DevOps directions include DevOps Engineer, SRE, Platform Engineer, and Cloud Engineer.",
    },
    {
        domain: "data",
        keywords: ["data", "analytics", "data engineer", "bi", "data analyst"],
        roleHints: ["Data Analyst", "Data Engineer", "BI Developer"],
        intro: "Data directions include Data Analyst, Data Engineer, and BI Developer.",
    },
    {
        domain: "frontend",
        keywords: ["frontend", "react", "ui", "web", "javascript"],
        roleHints: ["Frontend Engineer", "UI Engineer", "Web Engineer"],
        intro: "Frontend directions include Frontend Engineer, UI Engineer, and Web Engineer.",
    },
    {
        domain: "cloud",
        keywords: ["cloud", "aws", "azure", "gcp", "cloud engineer"],
        roleHints: ["Cloud Engineer", "Cloud Security Engineer", "Platform Engineer"],
        intro: "Cloud directions include Cloud Engineer, Cloud Security Engineer, and Platform Engineer.",
    },
];

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
        private readonly followUpAnswerService: JobFollowUpAnswerService
    ) { }

    getConversation = async (userId: string) => this.conversationService.getConversationResponse(userId);

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
        mode: ConversationMode,
        llmShouldSearch: boolean,
        searchReadinessConfidence: number,
        discoveryConfidence: number,
        forceDomainExplorationSearch: boolean
    ): boolean => {
        if (forceDomainExplorationSearch) {
            return true;
        }
        if (mode === "FAST_SEARCH" && searchReadinessConfidence >= 55) {
            return true;
        }
        if (searchReadinessConfidence >= 70) {
            return true;
        }
        if (mode === "DEEP_DISCOVERY" && discoveryConfidence >= 65) {
            return true;
        }
        return llmShouldSearch;
    };

    private detectDomainExplorationTarget = (message: string): DomainExplorationTarget | null => {
        const normalized = message.toLowerCase();
        const asksDomainExploration = DOMAIN_EXPLORATION_PHRASES.some((phrase) => normalized.includes(phrase));
        const matchedDomain = DOMAIN_TARGETS.find((target) => normalized.includes(target.domain));
        if (!matchedDomain) {
            return null;
        }
        if (asksDomainExploration) {
            return matchedDomain;
        }
        const directOpportunityAsk = normalized.includes("opportunities") || normalized.includes("jobs in") || normalized.includes("what can i");
        return directOpportunityAsk ? matchedDomain : null;
    };

    private normalizeWorkDirection = (raw: string): string => {
        const normalized = raw.trim().replace(/\s+/g, " ");
        const fixLeadingJ = normalized.replace(/\bunior\b/gi, "Junior");
        const fixCyber = fixLeadingJ.replace(/\bcyber\s*security\b/gi, "cybersecurity");
        return fixCyber;
    };

    private extractWorkDirectionQuery = (message: string): string | null => {
        const normalized = message.trim();
        const lowered = normalized.toLowerCase();
        const regexMatches = [
            /i want to work in\s+(.+)/i,
            /i want a job in\s+(.+)/i,
            /i want to be\s+(.+)/i,
            /search(?:\s+to)?\s+me\s+a\s+job\s+as\s+(?:a\s+)?(.+)/i,
            /find me\s+(.+?)\s+jobs?/i,
            /show me jobs in\s+(.+)/i,
            /what jobs are there in\s+(.+)/i,
            /what can you offer(?: me)? in\s+(.+)/i,
            /i think\s+(.+)\s+fits me/i,
            /maybe\s+(.+)/i,
            /let'?s go with\s+(.+)/i,
            /i choose\s+(.+)/i,
            /i want to start with\s+(.+)/i,
            /(.+)\s+sounds?\s+(?:good|interesting|intersting)/i,
        ];
        for (const pattern of regexMatches) {
            const match = normalized.match(pattern);
            const candidate = match?.[1]?.trim();
            if (candidate) {
                return this.normalizeWorkDirection(candidate);
            }
        }
        const trigger = WORK_DIRECTION_PHRASES.find((phrase) => lowered.includes(phrase));
        if (!trigger) {
            return null;
        }

        const triggerIndex = lowered.indexOf(trigger);
        const suffix = normalized.slice(triggerIndex + trigger.length).trim().replace(/^[\s:,-]+/, "");
        if (suffix.length > 0) {
            return this.normalizeWorkDirection(suffix);
        }

        const domainTarget = DOMAIN_TARGETS.find((target) => lowered.includes(target.domain));
        if (domainTarget) {
            return this.normalizeWorkDirection(domainTarget.domain);
        }
        return null;
    };

    private isWorkDirectionIntent = (message: string): boolean => {
        const lowered = message.toLowerCase();
        const extractedDirection = this.extractWorkDirectionQuery(message);
        if (extractedDirection) {
            return true;
        }
        const interestPattern = /\b(interested|interesting|intersting|fits me|maybe|choose|start with)\b/i;
        const domainMentioned = DOMAIN_TARGETS.some((target) => lowered.includes(target.domain));
        if (interestPattern.test(lowered) && domainMentioned) {
            return true;
        }
        if (/search.*job.*as/i.test(lowered) || /i want to be\b/i.test(lowered)) {
            return true;
        }
        return DOMAIN_TARGETS.some((target) => lowered.includes(target.domain)) && (
            lowered.includes("jobs")
            || lowered.includes("work")
            || lowered.includes("offer")
            || lowered.includes("role")
            || lowered.includes("direction")
        );
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

    sendMessage = async (userId: string, message: string, profile?: ProfileInput): Promise<ChatMessageResponse> => {
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
        await this.externalService.upsertKnownSkills(userId, aggregatedExplicitSkills).catch(() => null);
        const confidenceSummary = this.confidenceService.calculateConfidence(userCareerProfile);
        const mode = this.modeService.detectMode(normalizedMessage, userCareerProfile, confidenceSummary);
        const followUpIntent = this.followUpIntentService.detect(normalizedMessage);
        const jobContext = conversationAfterUserMessage.jobContext;
        const hasStoredJobs = (jobContext?.lastReturnedJobs.length ?? 0) > 0;
        if (hasStoredJobs && followUpIntent.isFollowUp && !followUpIntent.isExplicitNewSearch && jobContext) {
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

        const workDirectionIntent = this.isWorkDirectionIntent(normalizedMessage);
        const extractedWorkDirection = this.extractWorkDirectionQuery(normalizedMessage);
        const domainExplorationTarget = this.detectDomainExplorationTarget(normalizedMessage);
        const forceDomainExplorationSearch = domainExplorationTarget !== null || workDirectionIntent;
        console.info(
            `[CHAT][INTENT] userId=${userId} mode=${mode} workDirectionIntent=${workDirectionIntent} domainExploration=${domainExplorationTarget?.domain ?? "none"} extractedWorkDirection=${extractedWorkDirection ?? "none"} forceSearch=${forceDomainExplorationSearch}`
        );

        if (workDirectionIntent) {
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

            const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs);
            const topRankedJobs = rankedJobs.slice(0, 10).map((item) => item.job);
            const jobAwareDecision = await this.llmService.generateJobAwareReply(conversationAfterUserMessage, normalizedMessage, topRankedJobs, memories);
            const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
            let validatedJobs = topRankedJobs.filter((job) => validJobIds.includes(job.jobId)).slice(0, 10);
            let sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);
            if (validatedJobs.length === 0) {
                validatedJobs = topRankedJobs.slice(0, 6);
                sanitizedReply = this.buildDeterministicJobsReply(validatedJobs, normalizedQuery);
            }
            const selectedJob = this.resolveSelectedJobFromRecommendations(validatedJobs, validJobIds);
            await this.conversationService.setJobContextAfterSearch(
                userId,
                validatedJobs,
                selectedJob,
                normalizedQuery,
                "WORK_DIRECTION_INTENT"
            );
            const jobMatches = rankedJobs
                .filter((item) => validatedJobs.some((job) => job.jobId === item.jobId))
                .slice(0, 10)
                .map((item) => ({
                    jobId: item.jobId,
                    title: item.job.jobTitle,
                    matchScore: item.finalScore,
                    matchReasons: item.reasons,
                    possibleConcerns: item.concerns,
                    missingSkills: item.missingSkills,
                    growthPotential: item.scoreBreakdown.growthPotentialScore >= 60 ? "Good growth potential based on role trajectory." : "Moderate growth potential. Might require clearer progression steps.",
                    whyThisFitsUser: item.reasons.join(" "),
                    nextStepSuggestion: item.missingSkills.length > 0 ? `Strengthen ${item.missingSkills[0]} and then apply.` : "Apply and tailor your resume to the highlighted responsibilities.",
                }));
            await this.conversationService.appendAssistantMessage(userId, sanitizedReply, validatedJobs);
            return {
                reply: sanitizedReply,
                jobs: validatedJobs,
                jobMatches,
                mode,
                confidenceSummary,
            };
        }

        const currentStage = this.stageService.getCurrentStage(conversationAfterUserMessage, normalizedMessage);
        const stageProgressWithNote = currentStage
            ? this.stageService.recordStageMessage(conversationAfterUserMessage, normalizedMessage, currentStage.id)
            : conversationAfterUserMessage.stageProgress;
        const shouldSkipStages = this.isStageSkipRequested(normalizedMessage) || forceDomainExplorationSearch;
        let stageProgressForNextFlow = shouldSkipStages
            ? this.stageService.completeAllStages(stageProgressWithNote)
            : stageProgressWithNote;

        if (currentStage && !shouldSkipStages && mode !== "FAST_SEARCH") {
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
            conversationForDecision.achievements
        ).catch(() => null);

        if (updatedAchievements) {
            await this.conversationService.updateAchievements(userId, updatedAchievements);
        }

        const llmDecision = await this.llmService.decideNextStep(conversationForDecision, normalizedMessage, memories, mode);
        const effectiveSearchFilters = domainExplorationTarget
            ? this.buildDomainExplorationFilters(domainExplorationTarget, llmDecision.searchFilters, userCareerProfile.technologies)
            : llmDecision.searchFilters;
        const shouldSearchJobs = this.shouldRunJobSearch(
            mode,
            llmDecision.shouldSearchJobs,
            confidenceSummary.searchReadinessConfidence,
            confidenceSummary.discoveryConfidence,
            forceDomainExplorationSearch
        );
        console.info(
            `[CHAT][SEARCH] userId=${userId} trigger=LLM_OR_RULE shouldSearchJobs=${shouldSearchJobs} llmShouldSearch=${llmDecision.shouldSearchJobs} mode=${mode} filters=${JSON.stringify(effectiveSearchFilters)}`
        );

        if (mode === "DEEP_DISCOVERY" && !shouldSearchJobs && confidenceSummary.discoveryConfidence < 65) {
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
        const rankedJobs = this.rankingService.rankJobs(userCareerProfile, jobs);
        const topRankedJobs = rankedJobs.slice(0, 10).map((item) => item.job);
        const jobAwareDecision = await this.llmService.generateJobAwareReply(conversationForDecision, normalizedMessage, topRankedJobs, memories);
        const validJobIds = this.validationService.validateRecommendedJobs(jobAwareDecision.reply, jobAwareDecision.recommendedJobIds, jobs);
        let validatedJobs = topRankedJobs.filter((job) => validJobIds.includes(job.jobId)).slice(0, 10);
        const recommendedDirections = await this.knowledgeService.suggestDirections(userCareerProfile);
        let sanitizedReply = this.validationService.sanitizeReply(jobAwareDecision.reply);
        if (validatedJobs.length === 0) {
            validatedJobs = topRankedJobs.slice(0, 6);
            sanitizedReply = this.buildDeterministicJobsReply(validatedJobs);
        }
        const selectedJob = this.resolveSelectedJobFromRecommendations(validatedJobs, validJobIds);
        await this.conversationService.setJobContextAfterSearch(
            userId,
            validatedJobs,
            selectedJob,
            normalizedMessage,
            domainExplorationTarget ? "DOMAIN_EXPLORATION" : "SEARCH_PLAN"
        );
        const replyWithDomainContext = domainExplorationTarget
            ? `${domainExplorationTarget.intro}\n${sanitizedReply}`
            : sanitizedReply;
        const jobMatches = rankedJobs
            .filter((item) => validatedJobs.some((job) => job.jobId === item.jobId))
            .slice(0, 10)
            .map((item) => ({
                jobId: item.jobId,
                title: item.job.jobTitle,
                matchScore: item.finalScore,
                matchReasons: item.reasons,
                possibleConcerns: item.concerns,
                missingSkills: item.missingSkills,
                growthPotential: item.scoreBreakdown.growthPotentialScore >= 60 ? "Good growth potential based on role trajectory." : "Moderate growth potential. Might require clearer progression steps.",
                whyThisFitsUser: item.reasons.join(" "),
                nextStepSuggestion: item.missingSkills.length > 0 ? `Strengthen ${item.missingSkills[0]} and then apply.` : "Apply and tailor your resume to the highlighted responsibilities.",
            }));

        await this.conversationService.appendAssistantMessage(userId, replyWithDomainContext, validatedJobs);

        return {
            reply: replyWithDomainContext,
            jobs: validatedJobs,
            jobMatches,
            recommendedDirections,
            mode,
            confidenceSummary,
        };
    };
}
