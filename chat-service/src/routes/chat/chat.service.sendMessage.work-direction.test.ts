import { describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { Conversation } from "./conversation/conversation.model";
import type { JobSearchPlan } from "./search/job-search-plan.types";
import type { JobSearchResultItem, LlmDecision, JobSearchRequest } from "./chat.types";
import type { UserCareerProfile } from "../career-profile/career-profile.types";
import { createEmptyProfileSignals } from "../career-profile/career-profile.utils";
import { ChatService } from "./chat.service";
import type { ChatConversationService } from "./conversation/conversation.service";
import type { ChatExternalService } from "../external-chat/chat.external.service";
import type { CareerProfileService } from "../career-profile/career-profile.service";
import type { ConversationMemoryService } from "./memory/conversation-memory.service";
import type { ChatLlmService } from "./llm/chat.llm.service";
import type { PipelineService } from "./pipeline/pipeline.service";
import type { CareerKnowledgeService } from "./knowledge/career-knowledge.service";
import { ConversationStageService } from "./conversation/conversation.stage.service";
import { JobSearchPlanService } from "./search/job-search-plan.service";
import { JobRankingService } from "./ranking/job-ranking.service";
import { ChatValidationService } from "./llm/chat.validation.service";
import { CareerConfidenceService } from "./coach/career-confidence.service";
import { ConversationModeService } from "./coach/conversation-mode.service";
import { AchievementInferenceService } from "./inference/achievement-inference.service";
import { WorkStyleInferenceService } from "./inference/work-style-inference.service";
import { JobFollowUpIntentService } from "./job-context/job-follow-up-intent.service";
import { JobSelectionResolverService } from "./job-context/job-selection-resolver.service";
import { JobFollowUpAnswerService } from "./job-context/job-follow-up-answer.service";
import { PipelineIntentService } from "./pipeline/pipeline-intent.service";

const EMPTY_JOB_SEARCH_FILTERS: JobSearchRequest = { skills: [], interests: [], experienceLevel: "", keywords: [] };

const buildTestProfile = (userId: string): UserCareerProfile => {
    const now = new Date();
    return {
        userId,
        ...createEmptyProfileSignals(),
        salaryExpectation: null,
        locationPreference: null,
        remotePreference: null,
        senioritySignal: null,
        uncertaintyLevel: 0.5,
        profileSummaryText: "",
        profileSummaryEmbedding: [],
        createdAt: now,
        updatedAt: now,
    };
};

const TEST_CONVERSATION_ID = "507f1f77bcf86cd799439011";

const buildConversation = (userId: string): Conversation => {
    const now = new Date();
    return {
        _id: new ObjectId(TEST_CONVERSATION_ID),
        userId,
        achievements: [],
        messages: [
            { role: "assistant", content: "Welcome.", timestamp: now },
        ],
        stageProgress: {
            currentStageIndex: 0,
            currentStageId: "achievements",
            completedStageIds: [],
            awaitingConfirmation: false,
            stageNotes: {},
        },
        createdAt: now,
        updatedAt: now,
    };
};

const sampleJob = (): JobSearchResultItem => ({
    jobId: "job-mock-1",
    jobTitle: "Junior React Developer",
    company: "Mock Corp",
    seniority: "Junior",
    description: "Build user interfaces with React and TypeScript.",
    url: "https://example.com/jobs/1",
});

const jobAwareLlmDecision = (job: JobSearchResultItem): LlmDecision => ({
    reply: `${job.jobTitle} is a strong next step to explore.`,
    shouldSearchJobs: false,
    recommendedJobIds: [job.jobId],
    searchFilters: { ...EMPTY_JOB_SEARCH_FILTERS },
});

const createChatServiceWithWorkDirectionMocks = (params: {
    searchJobsByPlan: (plan: JobSearchPlan) => Promise<JobSearchResultItem[]>;
}) => {
    const userId = "test-user-work-direction";
    const profile = buildTestProfile(userId);
    const conversation = buildConversation(userId);

    const searchJobsByPlan = vi.fn(params.searchJobsByPlan);

    const conversationService = {
        getProfileAchievements: vi.fn(() => []),
        ensureConversationExists: vi.fn(async () => ({ conversationId: "507f1f77bcf86cd799439011" })),
        appendUserMessage: vi.fn(async () => undefined),
        getConversationOrThrow: vi.fn(async () => conversation),
        appendAssistantMessage: vi.fn(async () => undefined),
        updateStageProgress: vi.fn(async () => undefined),
        setJobContextAfterSearch: vi.fn(async () => undefined),
        saveJobContext: vi.fn(async () => undefined),
        setSelectedJob: vi.fn(async () => undefined),
    } as unknown as ChatConversationService;

    const externalService = {
        readUserPublicProfile: vi.fn(async () => null),
        searchJobsByPlan,
        upsertKnownSkills: vi.fn(async () => null),
        upsertAchievementFromUserMessage: vi.fn(async () => null),
    } as unknown as ChatExternalService;

    const profileService = {
        updateProfileFromInput: vi.fn(async () => undefined),
        getOrCreateProfile: vi.fn(async () => profile),
        mergeProfileSignals: vi.fn(async (existing: UserCareerProfile) => existing),
    } as unknown as CareerProfileService;

    const memoryService = {
        getRelevantMemories: vi.fn(async () => []),
        saveSignalsAsMemories: vi.fn(async () => undefined),
    } as unknown as ConversationMemoryService;

    const llmService = {
        generateJobAwareReply: vi.fn(async (_c, _m, jobs: readonly JobSearchResultItem[]) => {
            const first = jobs[0] ?? sampleJob();
            return jobAwareLlmDecision(first);
        }),
        decideNextStep: vi.fn(),
        generateStageReply: vi.fn(),
    } as unknown as ChatLlmService;

    const pipelineService = {
        addJobToPipeline: vi.fn(),
    } as unknown as PipelineService;

    const knowledgeService = {
        suggestDirections: vi.fn(),
    } as unknown as CareerKnowledgeService;

    const service = new ChatService(
        conversationService,
        new ConversationStageService(),
        externalService,
        llmService,
        new ChatValidationService(),
        profileService,
        memoryService,
        new CareerConfidenceService(),
        new ConversationModeService(),
        new AchievementInferenceService(),
        new WorkStyleInferenceService(),
        new JobSearchPlanService(),
        new JobRankingService(),
        knowledgeService,
        new JobFollowUpIntentService(),
        new JobSelectionResolverService(),
        new JobFollowUpAnswerService(),
        new PipelineIntentService(),
        pipelineService
    );

    return { service, userId, searchJobsByPlan, conversationService, llmService };
};

describe("ChatService.sendMessage — work direction triggers job search", () => {
    it("calls searchJobsByPlan when the user states what job they want", async () => {
        const job = sampleJob();
        const { service, userId, searchJobsByPlan } = createChatServiceWithWorkDirectionMocks({
            searchJobsByPlan: vi.fn(async () => [job]),
        });

        const response = await service.sendMessage(userId, "I want to be a React developer");

        expect(searchJobsByPlan).toHaveBeenCalledTimes(1);
        const [plan] = searchJobsByPlan.mock.calls[0] ?? [];
        expect(plan?.searches.length).toBeGreaterThan(0);
        const planPayload = JSON.stringify(plan);
        expect(planPayload).toMatch(/React/i);

        expect(response.jobs?.some((j) => j.jobId === job.jobId)).toBe(true);
        expect(response.reply.length).toBeGreaterThan(0);
    });

    it("returns a no-results reply when the job service returns an empty list", async () => {
        const { service, userId, searchJobsByPlan, conversationService } = createChatServiceWithWorkDirectionMocks({
            searchJobsByPlan: vi.fn(async () => []),
        });

        const response = await service.sendMessage(userId, "I want a job in platform engineering");

        expect(searchJobsByPlan).toHaveBeenCalled();
        expect(response.jobs).toBeUndefined();
        expect(response.reply.toLowerCase()).toContain("search");
        expect(conversationService.appendAssistantMessage).toHaveBeenCalled();
    });
});
