import type { AttachedJobSnapshot } from "../chat/chat.model";
import type { Conversation } from "./conversation.model";
import type { ConversationResponse, ProfileInput } from "./conversation.types";
import { ChatExternalService } from "../chat/external-route/chat.external.service";
import { ConversationRepository } from "./conversation.repository";
import { profileToSeedAchievements, toConversationResponse } from "./conversation.utils";
import { ConversationStageService } from "./conversation.stage.service";
import type { JobSearchResultItem } from "../chat.types";
import type { ConversationJobContext, JobRecommendationContextState, SanitizedJob } from "../job-context/job-context.types";

const toAttachedJobSnapshots = (jobs: readonly JobSearchResultItem[]): AttachedJobSnapshot[] =>
    jobs.map((job) => ({
        jobId: job.jobId,
        jobTitle: job.jobTitle,
        url: job.url,
        seniority: job.seniority,
        description: job.description,
        company: job.company ?? "",
        salary: typeof job.salary === "number" ? job.salary : 0,
    }));

const toSanitizedJob = (job: JobSearchResultItem): SanitizedJob => ({
    id: job.jobId,
    title: job.jobTitle,
    company: job.company ?? "",
    seniority: job.seniority,
    description: job.description,
    requirements: job.requirements ?? [],
    mustKnowSkills: job.mustKnowSkills ?? [],
    niceToHaveSkills: job.niceToHaveSkills ?? [],
    benefits: job.benefits ?? [],
    salary: typeof job.salary === "number" ? job.salary : null,
    location: job.location ?? null,
    url: job.url,
});

export class ChatConversationService {
    constructor(
        private readonly repository: ConversationRepository,
        private readonly chatExternalService: ChatExternalService,
        private readonly stageService: ConversationStageService
    ) { }

    getProfileAchievements = (profile?: ProfileInput): { id: string; name: string; grade: number }[] =>
        profileToSeedAchievements(profile);

    ensureConversationExists = async (userId: string, profileAchievements?: readonly { id: string; name: string; grade: number }[]): Promise<void> => {
        const existingConversation = await this.repository.findConversationByUserId(userId);
        
        if (existingConversation) {
            
            if (existingConversation.achievements.length === 0 && profileAchievements && profileAchievements.length > 0) {
                await this.repository.updateAchievements(userId, [...profileAchievements]);
            }
            return;
        }

        const achievements = profileAchievements && profileAchievements.length > 0
            ? [...profileAchievements]
            : await this.chatExternalService.readUserAchievements(userId);
        const firstAssistantMessage = this.stageService.getInitialAssistantMessage();
        
        await this.repository.createConversation(
            userId,
            achievements,
            firstAssistantMessage,
            {
                currentStageIndex: 0,
                currentStageId: "achievements",
                completedStageIds: [],
                awaitingConfirmation: false,
                stageNotes: {},
                surfacedAchievementIds: []
            }
        );
    };

    getConversationOrThrow = async (userId: string): Promise<Conversation> => {
        const conversation = await this.repository.findConversationByUserId(userId);
        if (!conversation) {
            throw new Error(`Conversation ${userId} was expected to exist but was not found`);
        }
        return conversation;
    };

    getConversationResponse = async (userId: string): Promise<ConversationResponse> => {
        await this.ensureConversationExists(userId);
        const conversation = await this.getConversationOrThrow(userId);
        return toConversationResponse(conversation);
    };

    appendUserMessage = async (userId: string, content: string): Promise<void> => {
        await this.repository.appendMessage(userId, {
            role: "user",
            content,
            timestamp: new Date(),
        });
    };

    appendAssistantMessage = async (
        userId: string,
        content: string,
        attachedJobs?: readonly JobSearchResultItem[]
    ): Promise<void> => {
        const snapshots =
            attachedJobs && attachedJobs.length > 0 ? toAttachedJobSnapshots(attachedJobs) : undefined;
        await this.repository.appendMessage(userId, {
            role: "assistant",
            content,
            timestamp: new Date(),
            ...(snapshots ? { attachedJobs: snapshots } : {}),
        });
    };

    updateAchievements = async (
        userId: string,
        achievements: readonly { id: string; name: string; grade: number }[]
    ): Promise<void> => {
        await this.repository.updateAchievements(userId, [...achievements]);
    };

    updateStageProgress = async (
        userId: string,
        stageProgress: Conversation["stageProgress"]
    ): Promise<void> => {
        await this.repository.updateStageProgress(userId, stageProgress);
    };

    saveJobContext = async (userId: string, jobContext: ConversationJobContext): Promise<void> => {
        await this.repository.updateJobContext(userId, jobContext);
    };

    setJobContextAfterSearch = async (
        userId: string,
        jobs: readonly JobSearchResultItem[],
        selection: JobSearchResultItem | null,
        lastSearchQuery: string | null,
        lastSearchIntent: string | null
    ): Promise<void> => {
        const now = new Date();
        const conversation = await this.getConversationOrThrow(userId);
        const prevRec = conversation.jobContext?.jobRecommendationContext;
        const mergedRejected = [...new Set([...(prevRec?.rejectedJobIds ?? [])])];
        const mergedAccepted = [...new Set([...(prevRec?.acceptedJobIds ?? [])])];
        const excluded = new Set([...mergedRejected, ...mergedAccepted]);
        const jobPoolForPersist = jobs.filter((job) => !excluded.has(job.jobId));
        const poolToUse = jobPoolForPersist.length > 0 ? jobPoolForPersist : [];
        const resolveSelected = (): JobSearchResultItem | null => {
            if (poolToUse.length === 0) {
                return null;
            }
            if (selection && poolToUse.some((job) => job.jobId === selection.jobId)) {
                return selection;
            }
            return poolToUse[0] ?? null;
        };
        const resolved = resolveSelected();
        const sanitizedJobs = poolToUse.map(toSanitizedJob);
        const selectedJobSnapshot = resolved ? toSanitizedJob(resolved) : null;
        const selectedJobId = selectedJobSnapshot?.id ?? null;
        const jobRecommendationContext: JobRecommendationContextState | null =
            selectedJobSnapshot && poolToUse.length > 0
                ? {
                      selectedJobId,
                      selectedJob: selectedJobSnapshot,
                      recommendedJobIds: poolToUse.map((job) => job.jobId),
                      rejectedJobIds: mergedRejected,
                      acceptedJobIds: mergedAccepted,
                      lastRecommendationAt: now,
                      awaitingPipelineDecision: true,
                  }
                : null;
        const jobContext: ConversationJobContext = {
            lastReturnedJobs: sanitizedJobs,
            selectedJobId,
            selectedJobSnapshot,
            lastSearchQuery,
            lastSearchIntent,
            lastSearchAt: now,
            updatedAt: now,
            jobRecommendationContext,
        };
        await this.repository.updateJobContext(userId, jobContext);
    };

    setSelectedJob = async (userId: string, selectedJob: SanitizedJob): Promise<void> => {
        const conversation = await this.getConversationOrThrow(userId);
        const existingJobContext = conversation.jobContext;
        if (!existingJobContext) {
            return;
        }
        const now = new Date();
        const rec = existingJobContext.jobRecommendationContext;
        const updatedContext: ConversationJobContext = {
            ...existingJobContext,
            selectedJobId: selectedJob.id,
            selectedJobSnapshot: selectedJob,
            updatedAt: now,
            ...(rec
                ? {
                      jobRecommendationContext: {
                          ...rec,
                          selectedJobId: selectedJob.id,
                          selectedJob: selectedJob,
                      },
                  }
                : {}),
        };
        await this.repository.updateJobContext(userId, updatedContext);
    };
}
