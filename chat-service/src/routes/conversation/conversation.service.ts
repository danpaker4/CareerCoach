import type {
    ConversationResponse,
    ConversationSummaryResponse,
    ResolvedConversation,
} from "./conversation.types";
import { ChatExternalService } from "../external-chat-tools/chat.external.service";
import { ConversationDal } from "./conversation.dal";
import {
    ConversationNotFoundError,
    defaultStageProgress,
    InvalidConversationIdError,
    toAttachedJobSnapshots,
    toConversationResponse,
    parseConversationObjectIdOrThrow,
    tryParseConversationObjectId,
} from "./conversation.utils";
import { getCurrentStage, getInitialAssistantMessage } from "./conversation.stage.utils";
import type { Conversation, ConversationStageProgress, DreamJobFlow } from "./conversation.model";
import type { JobSearchResultItem } from "../../chat-flow/api/shared/chat.types";
import type { ConversationJobContext, JobRecommendationContextState, SanitizedJob } from "./job-in-conversation.types";

export class ChatConversationService {
    constructor(
        private readonly dal: ConversationDal,
        private readonly chatExternalService: ChatExternalService
    ) {}

    listConversationSummaries = async (userId: string): Promise<ConversationSummaryResponse[]> => {
        const rows = await this.dal.listSummariesByUserId(userId);
        return rows.map((row) => ({
            conversationId: row._id.toHexString(),
            updatedAt: row.updatedAt.toISOString(),
            previewText: row.previewText,
        }));
    };

    createAdditionalConversation = async (userId: string): Promise<ConversationResponse> => {
        const firstAssistantMessage = getInitialAssistantMessage();
        const created = await this.dal.createConversation(userId, firstAssistantMessage, defaultStageProgress());
        const achievements = await this.chatExternalService.readUserAchievements(userId);
        const currentStage = getCurrentStage(created);
        return toConversationResponse(created, achievements, currentStage?.id ?? null);
    };

    getConversation = async (
        userId: string,
        requestedConversationId: string | undefined
    ): Promise<ResolvedConversation> => {
        if (requestedConversationId) {
            const objectId = tryParseConversationObjectId(requestedConversationId);
            if (!objectId) {
                throw new InvalidConversationIdError();
            }
            const existingConversation = await this.dal.findByIdAndUserId(objectId, userId);
            if (!existingConversation) {
                throw new ConversationNotFoundError();
            }
            return {
                conversationId: requestedConversationId,
                conversation: existingConversation,
            };
        }

        const existingConversation = await this.dal.findMostRecentlyUpdatedByUserId(userId);
        if (existingConversation?._id) {
            return {
                conversationId: existingConversation._id.toHexString(),
                conversation: existingConversation,
            };
        }

        const firstAssistantMessage = getInitialAssistantMessage();
        const created = await this.dal.createConversation(userId, firstAssistantMessage, defaultStageProgress());
        return {
            conversationId: created._id!.toHexString(),
            conversation: created,
        };
    };

    getConversationId = async (
        userId: string,
        requestedConversationId: string | undefined
    ): Promise<string> => {
        const { conversationId } = await this.getConversation(userId, requestedConversationId);
        return conversationId;
    };

    getConversationByConversationIdAndUserId = async (userId: string, conversationId: string): Promise<Conversation> => {
        const conversation = await this.dal.findByIdAndUserId(parseConversationObjectIdOrThrow(conversationId), userId);
        if (!conversation) {
            throw new ConversationNotFoundError();
        }
        return conversation;
    };

    getConversationResponse = async (userId: string, requestedConversationId?: string): Promise<ConversationResponse> => {
        const { conversation } = await this.getConversation(userId, requestedConversationId);
        const achievements = await this.chatExternalService.readUserAchievements(userId);
        const lastUserMessage = [...conversation.messages].reverse().find((message) => message.role === "user")?.content;
        const currentStage = getCurrentStage(conversation, lastUserMessage);
        return toConversationResponse(conversation, achievements, currentStage?.id ?? null);
    };

    deleteConversation = async (userId: string, conversationIdRaw: string): Promise<void> => {
        const objectId = tryParseConversationObjectId(conversationIdRaw);
        if (!objectId) {
            throw new InvalidConversationIdError();
        }
        await this.dal.deleteByIdAndUserId(objectId, userId);
    };

    saveUserMessage = async (
        userId: string,
        conversation: Conversation,
        content: string
    ): Promise<Conversation> => {
        const conversationId = conversation._id;
        if (!conversationId) {
            throw new ConversationNotFoundError();
        }
        const message = {
            role: "user" as const,
            content,
            timestamp: new Date(),
        };
        await this.dal.appendMessage(userId, conversationId, message);
        return {
            ...conversation,
            messages: [...conversation.messages, message],
            updatedAt: message.timestamp,
        };
    };

    appendAssistantMessage = async (
        userId: string,
        conversationId: string,
        content: string,
        attachedJobs?: readonly JobSearchResultItem[]
    ): Promise<void> => {
        const snapshots = attachedJobs && attachedJobs.length > 0 ? toAttachedJobSnapshots(attachedJobs) : undefined;
        await this.dal.appendMessage(userId, parseConversationObjectIdOrThrow(conversationId), {
            role: "assistant",
            content,
            timestamp: new Date(),
            ...(snapshots ? { attachedJobs: snapshots } : {}),
        });
    };

    updateStageProgress = async (userId: string, conversationId: string, stageProgress: ConversationStageProgress): Promise<void> => {
        await this.dal.updateStageProgress(userId, parseConversationObjectIdOrThrow(conversationId), stageProgress);
    };

    saveJobContext = async (userId: string, conversationId: string, jobContext: ConversationJobContext): Promise<void> => {
        await this.dal.updateJobContext(userId, parseConversationObjectIdOrThrow(conversationId), jobContext);
    };

    updateDreamJobFlow = async (userId: string, conversationId: string, dreamJobFlow: DreamJobFlow | undefined): Promise<void> => {
        await this.dal.updateDreamJobFlow(userId, parseConversationObjectIdOrThrow(conversationId), dreamJobFlow);
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
        const conversation = await this.getConversationByConversationIdAndUserId(userId, conversationId);
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
        await this.dal.updateJobContext(userId, parseConversationObjectIdOrThrow(conversationId), jobContext);
    };

    setSelectedJob = async (userId: string, conversationId: string, selectedJob: SanitizedJob): Promise<void> => {
        const conversation = await this.getConversationByConversationIdAndUserId(userId, conversationId);
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
        await this.dal.updateJobContext(userId, parseConversationObjectIdOrThrow(conversationId), updatedContext);
    };
}
