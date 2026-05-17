import type {
    ConversationResponse,
    ConversationSummaryResponse,
    EnsureConversationExistsResult,
} from "./conversation.types";
import { ChatExternalService } from "../external-chat/chat.external.service";
import { ConversationRepository } from "./conversation.repository";
import {
    ConversationNotFoundError,
    defaultStageProgress,
    InvalidConversationIdError,
    toAttachedJobSnapshots,
    toConversationResponse,
    parseConversationObjectIdOrThrow,
    tryParseConversationObjectId,
} from "./conversation.utils";
import { ConversationStageService } from "./conversation.stage.service";
import type { Conversation, ConversationStageProgress } from "./conversation.model";
import type { JobSearchResultItem } from "../chat/chat.types";
import type { ConversationJobContext, JobRecommendationContextState, SanitizedJob } from "../../job-in-conversation.types";

export class ChatConversationService {
    constructor(
        private readonly repository: ConversationRepository,
        private readonly chatExternalService: ChatExternalService,
        private readonly stageService: ConversationStageService
    ) {}

    listConversationSummaries = async (userId: string): Promise<ConversationSummaryResponse[]> => {
        const rows = await this.repository.listSummariesByUserId(userId);
        return rows.map((row) => ({
            conversationId: row._id.toHexString(),
            updatedAt: row.updatedAt.toISOString(),
            previewText: row.previewText,
        }));
    };

    createAdditionalConversation = async (userId: string): Promise<ConversationResponse> => {
        const firstAssistantMessage = this.stageService.getInitialAssistantMessage();
        const created = await this.repository.createConversation(userId, firstAssistantMessage, defaultStageProgress());
        const achievements = await this.chatExternalService.readUserAchievements(userId);
        return toConversationResponse(created, achievements);
    };

    ensureConversationExists = async (
        userId: string,
        requestedConversationId: string | undefined
    ): Promise<EnsureConversationExistsResult> => {
        if (requestedConversationId) {
            const objectId = tryParseConversationObjectId(requestedConversationId);
            if (!objectId) {
                throw new InvalidConversationIdError();
            }
            const existingConversation = await this.repository.findByIdAndUserId(objectId, userId);
            if (!existingConversation) {
                throw new ConversationNotFoundError();
            }
            return { conversationId: requestedConversationId };
        }

        const existingConversation = await this.repository.findMostRecentlyUpdatedByUserId(userId);
        if (existingConversation?._id) {
            return { conversationId: existingConversation._id.toHexString() };
        }

        const firstAssistantMessage = this.stageService.getInitialAssistantMessage();
        const created = await this.repository.createConversation(userId, firstAssistantMessage, defaultStageProgress());
        return { conversationId: created._id!.toHexString() };
    };

    getConversationOrThrow = async (userId: string, conversationId: string): Promise<Conversation> => {
        const conversation = await this.repository.findByIdAndUserId(parseConversationObjectIdOrThrow(conversationId), userId);
        if (!conversation) {
            throw new ConversationNotFoundError();
        }
        return conversation;
    };

    getConversationResponse = async (userId: string, requestedConversationId?: string): Promise<ConversationResponse> => {
        const { conversationId } = await this.ensureConversationExists(userId, requestedConversationId);
        const conversation = await this.getConversationOrThrow(userId, conversationId);
        const achievements = await this.chatExternalService.readUserAchievements(userId);
        return toConversationResponse(conversation, achievements);
    };

    deleteConversation = async (userId: string, conversationIdRaw: string): Promise<void> => {
        const objectId = tryParseConversationObjectId(conversationIdRaw);
        if (!objectId) {
            throw new InvalidConversationIdError();
        }
        await this.repository.deleteByIdAndUserId(objectId, userId);
    };

    appendUserMessage = async (userId: string, conversationId: string, content: string): Promise<void> => {
        await this.repository.appendMessage(userId, parseConversationObjectIdOrThrow(conversationId), {
            role: "user",
            content,
            timestamp: new Date(),
        });
    };

    appendAssistantMessage = async (
        userId: string,
        conversationId: string,
        content: string,
        attachedJobs?: readonly JobSearchResultItem[]
    ): Promise<void> => {
        const snapshots = attachedJobs && attachedJobs.length > 0 ? toAttachedJobSnapshots(attachedJobs) : undefined;
        await this.repository.appendMessage(userId, parseConversationObjectIdOrThrow(conversationId), {
            role: "assistant",
            content,
            timestamp: new Date(),
            ...(snapshots ? { attachedJobs: snapshots } : {}),
        });
    };

    updateStageProgress = async (userId: string, conversationId: string, stageProgress: ConversationStageProgress): Promise<void> => {
        await this.repository.updateStageProgress(userId, parseConversationObjectIdOrThrow(conversationId), stageProgress);
    };

    saveJobContext = async (userId: string, conversationId: string, jobContext: ConversationJobContext): Promise<void> => {
        await this.repository.updateJobContext(userId, parseConversationObjectIdOrThrow(conversationId), jobContext);
    };

    setJobContextAfterSearch = async (
        userId: string,
        conversationId: string,
        jobs: readonly JobSearchResultItem[],
        selection: JobSearchResultItem | null,
        lastSearchQuery: string | null,
        lastSearchIntent: string | null
    ): Promise<void> => {
        const now = new Date();
        const conversation = await this.getConversationOrThrow(userId, conversationId);
        const prevRec = conversation.jobContext?.jobRecommendationContext;
        const mergedRejected = [...new Set([...(prevRec?.rejectedJobIds ?? [])])];
        const mergedAccepted = [...new Set([...(prevRec?.acceptedJobIds ?? [])])];
        const excluded = new Set([...mergedRejected, ...mergedAccepted]);
        const jobPoolForPersist = jobs.filter((job) => !excluded.has(job.id));
        const poolToUse = jobPoolForPersist.length > 0 ? jobPoolForPersist : [];
        const resolveSelected = (): JobSearchResultItem | null => {
            if (poolToUse.length === 0) {
                return null;
            }
            if (selection && poolToUse.some((job) => job.id === selection.id)) {
                return selection;
            }
            return poolToUse[0] ?? null;
        };
        const resolved = resolveSelected();
        const selectedJobSnapshot = resolved;
        const selectedJobId = selectedJobSnapshot?.id ?? null;
        const jobRecommendationContext: JobRecommendationContextState | null =
            selectedJobSnapshot && poolToUse.length > 0
                ? {
                      selectedJobId,
                      selectedJob: selectedJobSnapshot,
                      recommendedJobIds: poolToUse.map((job) => job.id),
                      rejectedJobIds: mergedRejected,
                      acceptedJobIds: mergedAccepted,
                      lastRecommendationAt: now,
                      awaitingPipelineDecision: true,
                  }
                : null;
        const jobContext: ConversationJobContext = {
            lastReturnedJobs: poolToUse,
            selectedJobId,
            selectedJobSnapshot,
            lastSearchQuery,
            lastSearchIntent,
            lastSearchAt: now,
            updatedAt: now,
            jobRecommendationContext,
        };
        await this.repository.updateJobContext(userId, parseConversationObjectIdOrThrow(conversationId), jobContext);
    };

    setSelectedJob = async (userId: string, conversationId: string, selectedJob: SanitizedJob): Promise<void> => {
        const conversation = await this.getConversationOrThrow(userId, conversationId);
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
        await this.repository.updateJobContext(userId, parseConversationObjectIdOrThrow(conversationId), updatedContext);
    };
}
