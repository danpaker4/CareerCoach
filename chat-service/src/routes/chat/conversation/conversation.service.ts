import type { AttachedJobSnapshot } from "../chat.model";
import type { Conversation } from "./conversation.model";
import type { ConversationRef, ConversationResponse, ConversationSummaryResponse, ProfileInput } from "./conversation.types";
import { ChatExternalService } from "../../external-chat/chat.external.service";
import { ConversationRepository } from "./conversation.repository";
import { profileToSeedAchievements, toConversationResponse } from "./conversation.utils";
import { ConversationStageService } from "./conversation.stage.service";
import type { JobSearchResultItem } from "../chat.types";
import type { ConversationJobContext, JobRecommendationContextState, SanitizedJob } from "../job-context/job-context.types";
import { tryParseConversationObjectId } from "./conversation.id.utils";
import type { ObjectId } from "mongodb";

export class ConversationNotFoundError extends Error {
    constructor() {
        super("CONVERSATION_NOT_FOUND");
        this.name = "ConversationNotFoundError";
    }
}

export class InvalidConversationIdError extends Error {
    constructor() {
        super("INVALID_CONVERSATION_ID");
        this.name = "InvalidConversationIdError";
    }
}

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

const initialStageProgress = (): Conversation["stageProgress"] => ({
    currentStageIndex: 0,
    currentStageId: "achievements",
    completedStageIds: [],
    awaitingConfirmation: false,
    stageNotes: {},
    surfacedAchievementIds: [],
});

const toRefObjectId = (ref: ConversationRef): ObjectId => {
    const parsed = tryParseConversationObjectId(ref.conversationId);
    if (!parsed) {
        throw new InvalidConversationIdError();
    }
    return parsed;
};

export class ChatConversationService {
    constructor(
        private readonly repository: ConversationRepository,
        private readonly chatExternalService: ChatExternalService,
        private readonly stageService: ConversationStageService
    ) {}

    getProfileAchievements = (profile?: ProfileInput): { id: string; name: string; grade: number }[] =>
        profileToSeedAchievements(profile);

    listConversationSummaries = async (userId: string): Promise<ConversationSummaryResponse[]> => {
        const rows = await this.repository.listSummariesByUserId(userId);
        return rows.map((row) => ({
            conversationId: row._id.toHexString(),
            updatedAt: row.updatedAt.toISOString(),
            previewText: row.previewText,
        }));
    };

    createAdditionalConversation = async (
        userId: string,
        profileAchievements?: readonly { id: string; name: string; grade: number }[]
    ): Promise<ConversationResponse> => {
        const achievements =
            profileAchievements && profileAchievements.length > 0
                ? [...profileAchievements]
                : await this.chatExternalService.readUserAchievements(userId);
        const firstAssistantMessage = this.stageService.getInitialAssistantMessage();
        const created = await this.repository.createConversation(userId, achievements, firstAssistantMessage, initialStageProgress());
        return toConversationResponse(created);
    };

    ensureConversationExists = async (
        userId: string,
        profileAchievements: readonly { id: string; name: string; grade: number }[] | undefined,
        requestedConversationId: string | undefined
    ): Promise<{ conversationId: string }> => {
        if (requestedConversationId) {
            const objectId = tryParseConversationObjectId(requestedConversationId);
            if (!objectId) {
                throw new InvalidConversationIdError();
            }
            const existingConversation = await this.repository.findByIdAndUserId(objectId, userId);
            if (!existingConversation) {
                throw new ConversationNotFoundError();
            }
            if (existingConversation.achievements.length === 0 && profileAchievements && profileAchievements.length > 0) {
                await this.repository.updateAchievements(userId, objectId, [...profileAchievements]);
            }
            return { conversationId: requestedConversationId };
        }

        const existingConversation = await this.repository.findMostRecentlyUpdatedByUserId(userId);
        if (existingConversation?._id) {
            if (existingConversation.achievements.length === 0 && profileAchievements && profileAchievements.length > 0) {
                await this.repository.updateAchievements(userId, existingConversation._id, [...profileAchievements]);
            }
            return { conversationId: existingConversation._id.toHexString() };
        }

        const achievements =
            profileAchievements && profileAchievements.length > 0
                ? [...profileAchievements]
                : await this.chatExternalService.readUserAchievements(userId);
        const firstAssistantMessage = this.stageService.getInitialAssistantMessage();
        const created = await this.repository.createConversation(userId, achievements, firstAssistantMessage, initialStageProgress());
        return { conversationId: created._id!.toHexString() };
    };

    getConversationOrThrow = async (ref: ConversationRef): Promise<Conversation> => {
        const objectId = toRefObjectId(ref);
        const conversation = await this.repository.findByIdAndUserId(objectId, ref.userId);
        if (!conversation) {
            throw new ConversationNotFoundError();
        }
        return conversation;
    };

    getConversationResponse = async (userId: string, requestedConversationId?: string): Promise<ConversationResponse> => {
        const { conversationId } = await this.ensureConversationExists(userId, undefined, requestedConversationId);
        const conversation = await this.getConversationOrThrow({ userId, conversationId });
        return toConversationResponse(conversation);
    };

    deleteConversation = async (userId: string, conversationIdRaw: string): Promise<void> => {
        const objectId = tryParseConversationObjectId(conversationIdRaw);
        if (!objectId) {
            throw new InvalidConversationIdError();
        }
        const removed = await this.repository.deleteByIdAndUserId(objectId, userId);
        if (!removed) {
            throw new ConversationNotFoundError();
        }
    };

    appendUserMessage = async (ref: ConversationRef, content: string): Promise<void> => {
        const objectId = toRefObjectId(ref);
        await this.repository.appendMessage(ref.userId, objectId, {
            role: "user",
            content,
            timestamp: new Date(),
        });
    };

    appendAssistantMessage = async (
        ref: ConversationRef,
        content: string,
        attachedJobs?: readonly JobSearchResultItem[]
    ): Promise<void> => {
        const objectId = toRefObjectId(ref);
        const snapshots = attachedJobs && attachedJobs.length > 0 ? toAttachedJobSnapshots(attachedJobs) : undefined;
        await this.repository.appendMessage(ref.userId, objectId, {
            role: "assistant",
            content,
            timestamp: new Date(),
            ...(snapshots ? { attachedJobs: snapshots } : {}),
        });
    };

    updateAchievements = async (ref: ConversationRef, achievements: readonly { id: string; name: string; grade: number }[]): Promise<void> => {
        const objectId = toRefObjectId(ref);
        await this.repository.updateAchievements(ref.userId, objectId, [...achievements]);
    };

    updateStageProgress = async (ref: ConversationRef, stageProgress: Conversation["stageProgress"]): Promise<void> => {
        const objectId = toRefObjectId(ref);
        await this.repository.updateStageProgress(ref.userId, objectId, stageProgress);
    };

    saveJobContext = async (ref: ConversationRef, jobContext: ConversationJobContext): Promise<void> => {
        const objectId = toRefObjectId(ref);
        await this.repository.updateJobContext(ref.userId, objectId, jobContext);
    };

    setJobContextAfterSearch = async (
        ref: ConversationRef,
        jobs: readonly JobSearchResultItem[],
        selection: JobSearchResultItem | null,
        lastSearchQuery: string | null,
        lastSearchIntent: string | null
    ): Promise<void> => {
        const now = new Date();
        const conversation = await this.getConversationOrThrow(ref);
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
        await this.repository.updateJobContext(ref.userId, toRefObjectId(ref), jobContext);
    };

    setSelectedJob = async (ref: ConversationRef, selectedJob: SanitizedJob): Promise<void> => {
        const conversation = await this.getConversationOrThrow(ref);
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
        await this.repository.updateJobContext(ref.userId, toRefObjectId(ref), updatedContext);
    };
}
