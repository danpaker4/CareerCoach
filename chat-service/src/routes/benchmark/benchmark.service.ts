import { randomUUID } from "crypto";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import type { ResolvedLlmConfig } from "../../ai/llm-config.types";
import { createTextCompletionPortFromChain } from "../../ai/text-completion.utils";
import { ConversationRepository } from "../conversation/conversation.repository";
import { ChatConversationService } from "../conversation/conversation.service";
import { ConversationStageService } from "../conversation/conversation.stage.service";
import { ChatLlmService } from "../chat/llm/chat.llm.service";
import { ChatValidationService } from "../chat/llm/chat.validation.service";
import { ChatService } from "../chat/chat.service";
import { CareerProfileRepository } from "../career-profile/career-profile.repository";
import { CareerProfileService } from "../career-profile/career-profile.service";
import { ConfidenceService } from "../chat/confidence/confidence.service";

import { AchievementInferenceService } from "../chat/inference/achievement-inference/achievement-inference.service";
import { SeniorityInferenceService } from "../chat/inference/seniority-inference/seniority-inference.service";
import { JobSearchPlanService } from "../chat/search/job-search-plan.service";
import { JobRankingService } from "../chat/ranking/job-ranking.service";
import { JobFollowUpAnswerService } from "../chat/job-follow-up-answer/job-follow-up-answer.service";
import { PipelineIntentService } from "../chat/pipeline/pipeline-intent.service";
import { PipelineService } from "../chat/pipeline/pipeline.service";
import type { DreamJobRoadmapCreator } from "../chat/dream-job/chat.dream-job-roadmap.types";
import { BenchmarkFixtureExternalService } from "./benchmark-fixture.external-service";
import { BenchmarkNoopCareerKnowledgeService, BenchmarkNoopEmbeddingPort } from "./benchmark-noop.services";
import { BenchmarkRunRepository } from "./benchmark.repository";
import {
    BENCHMARK_CASES,
    BENCHMARK_GEMINI_MODEL_FALLBACK,
    BENCHMARK_OLLAMA_BASE_URL_FALLBACK,
    BENCHMARK_OLLAMA_MODEL_FALLBACK,
    BENCHMARK_RANDOM_CASE_COUNT,
    BENCHMARK_RUBRIC,
    BENCHMARK_USER_ID_PREFIX,
} from "./benchmark.consts";
import type {
    BenchmarkCandidate,
    BenchmarkCandidateId,
    BenchmarkCandidateRunResult,
    BenchmarkCase,
    BenchmarkCaseResult,
    BenchmarkConfigResponse,
    BenchmarkRunDocument,
    BenchmarkRunRequest,
    BenchmarkRunSummary,
} from "./benchmark.types";
import {
    BenchmarkLlmObserver,
    BenchmarkTokenUsageRecorder,
    calculateCaseResult,
    normalizeCandidateScores,
    toBenchmarkRunSummary,
} from "./benchmark.utils";

const isBenchmarkCandidateId = (value: string): value is BenchmarkCandidateId =>
    value === "ollama-llama" || value === "gemini";

const average = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const resolveCandidateConfig = (candidateId: BenchmarkCandidateId, chatConfig: ServerConfig["chatConfig"]): ResolvedLlmConfig | null => {
    if (candidateId === "ollama-llama") {
        const configured = chatConfig.llmTextCompletionChain.find((item) => item.provider === "ollama");
        if (configured?.provider === "ollama") {
            return configured;
        }
        return {
            provider: "ollama",
            endpointUrl: BENCHMARK_OLLAMA_BASE_URL_FALLBACK,
            model: BENCHMARK_OLLAMA_MODEL_FALLBACK,
        };
    }

    const configured = chatConfig.llmTextCompletionChain.find((item) => item.provider === "gemini");
    return configured?.provider === "gemini" ? configured : null;
};

const toCandidate = (candidateId: BenchmarkCandidateId, chatConfig: ServerConfig["chatConfig"]): BenchmarkCandidate => {
    const config = resolveCandidateConfig(candidateId, chatConfig);
    if (candidateId === "ollama-llama") {
        return {
            id: candidateId,
            label: "Llama via Ollama",
            provider: "ollama",
            model: config?.provider === "ollama" ? config.model : BENCHMARK_OLLAMA_MODEL_FALLBACK,
            available: Boolean(config),
            ...(config ? {} : { unavailableReason: "Ollama configuration is unavailable." }),
        };
    }

    return {
        id: candidateId,
        label: "Gemini",
        provider: "gemini",
        model: config?.provider === "gemini" ? config.model : BENCHMARK_GEMINI_MODEL_FALLBACK,
        available: Boolean(config),
        ...(config ? {} : { unavailableReason: "GEMINI_API_KEY is not configured for chat-service." }),
    };
};

const selectCases = (caseIds: readonly string[] | undefined): readonly BenchmarkCase[] => {
    if (!caseIds || caseIds.length === 0) {
        return BENCHMARK_CASES;
    }

    const selectedIds = new Set(caseIds);
    return BENCHMARK_CASES.filter((benchmarkCase) => selectedIds.has(benchmarkCase.id));
};

const resolveSampleCount = (benchmarkCases: readonly BenchmarkCase[], requestedSampleCount: number | undefined): number => {
    const fallbackCount = Math.min(BENCHMARK_RANDOM_CASE_COUNT, benchmarkCases.length);
    if (!requestedSampleCount) {
        return fallbackCount;
    }

    return Math.max(1, Math.min(benchmarkCases.length, requestedSampleCount));
};

const sampleCases = (benchmarkCases: readonly BenchmarkCase[], requestedSampleCount: number | undefined): readonly BenchmarkCase[] => {
    const sampleCount = resolveSampleCount(benchmarkCases, requestedSampleCount);
    if (benchmarkCases.length <= sampleCount) {
        return benchmarkCases;
    }

    return [...benchmarkCases]
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleCount);
};

const selectCandidateIds = (candidateIds: readonly BenchmarkCandidateId[] | undefined): readonly BenchmarkCandidateId[] => {
    if (!candidateIds || candidateIds.length === 0) {
        return ["ollama-llama", "gemini"];
    }

    return candidateIds.filter((candidateId) => isBenchmarkCandidateId(candidateId));
};

const BENCHMARK_CANDIDATE_IDS: readonly BenchmarkCandidateId[] = ["ollama-llama", "gemini"];

export class BenchmarkService {
    constructor(
        private readonly dbClient: MongoClient,
        private readonly chatConfig: ServerConfig["chatConfig"],
        private readonly repository: BenchmarkRunRepository
    ) { }

    getConfig = (): BenchmarkConfigResponse => ({
        candidates: BENCHMARK_CANDIDATE_IDS.map((candidateId) => toCandidate(candidateId, this.chatConfig)),
        cases: BENCHMARK_CASES.map((benchmarkCase) => ({
            id: benchmarkCase.id,
            title: benchmarkCase.title,
            description: benchmarkCase.description,
        })),
        rubric: BENCHMARK_RUBRIC,
    });

    listRuns = async (limit: number): Promise<BenchmarkRunSummary[]> =>
        (await this.repository.list(limit)).map(toBenchmarkRunSummary);

    getRun = async (runId: string): Promise<BenchmarkRunSummary | null> => {
        const run = await this.repository.findById(runId);
        return run ? toBenchmarkRunSummary(run) : null;
    };

    runBenchmark = async (request: BenchmarkRunRequest, adminUserId: string): Promise<BenchmarkRunSummary> => {
        const cases = sampleCases(selectCases(request.caseIds), request.sampleCount);
        const candidateIds = selectCandidateIds(request.candidateIds);
        const candidateResults = await Promise.all(candidateIds.map((candidateId) => this.runCandidate(candidateId, cases)));
        const normalizedCandidateResults = normalizeCandidateScores(candidateResults);
        const status = normalizedCandidateResults.some((candidateResult) => candidateResult.errorCount > 0 || !candidateResult.available)
            ? "completed_with_errors"
            : "completed";
        const now = new Date();
        const run: BenchmarkRunDocument = {
            createdAt: now,
            updatedAt: now,
            status,
            requestedByAdminUserId: adminUserId,
            selectedCaseIds: cases.map((benchmarkCase) => benchmarkCase.id),
            selectedCandidateIds: candidateIds,
            candidateResults: normalizedCandidateResults,
        };
        return toBenchmarkRunSummary(await this.repository.create(run));
    };

    private runCandidate = async (
        candidateId: BenchmarkCandidateId,
        benchmarkCases: readonly BenchmarkCase[]
    ): Promise<BenchmarkCandidateRunResult> => {
        const candidate = toCandidate(candidateId, this.chatConfig);
        const config = resolveCandidateConfig(candidateId, this.chatConfig);
        if (!candidate.available || !config) {
            return {
                candidateId,
                provider: candidate.provider,
                model: candidate.model,
                available: false,
                unavailableReason: candidate.unavailableReason,
                caseResults: [],
                successRate: 0,
                averageLatencyMs: 0,
                totalTokens: 0,
                errorCount: benchmarkCases.length,
                automaticScore: 0,
                overallScore: 0,
                scoreStatus: "automatic",
            };
        }

        const caseResults = await benchmarkCases.reduce<Promise<readonly BenchmarkCaseResult[]>>(async (previousResults, benchmarkCase) => {
            const results = await previousResults;
            const caseResult = await this.runCase(candidateId, config, benchmarkCase);
            return [...results, caseResult];
        }, Promise.resolve([]));
        const successCount = caseResults.filter((caseResult) => caseResult.success).length;
        const automaticScore = Math.round(average(caseResults.map((caseResult) => caseResult.automaticScore)));
        return {
            candidateId,
            provider: candidate.provider,
            model: candidate.model,
            available: true,
            caseResults,
            successRate: benchmarkCases.length > 0 ? successCount / benchmarkCases.length : 0,
            averageLatencyMs: Math.round(average(caseResults.map((caseResult) => caseResult.latencyMs))),
            totalTokens: caseResults.reduce((sum, caseResult) => sum + caseResult.totalTokens, 0),
            errorCount: caseResults.filter((caseResult) => caseResult.errorMessage).length,
            automaticScore,
            overallScore: automaticScore,
            scoreStatus: "automatic",
        };
    };

    private runCase = async (candidateId: BenchmarkCandidateId, config: ResolvedLlmConfig, benchmarkCase: BenchmarkCase) => {
        const userId = `${BENCHMARK_USER_ID_PREFIX}-${candidateId}-${benchmarkCase.id}-${randomUUID()}`;
        const tokenRecorder = new BenchmarkTokenUsageRecorder();
        const observer = new BenchmarkLlmObserver();
        const service = this.createChatService(config, benchmarkCase, tokenRecorder, observer);
        const startTime = Date.now();
        const replies: string[] = [];

        try {
            await this.cleanupBenchmarkUser(userId);
            for (const message of benchmarkCase.messages) {
                const response = await service.sendMessage(userId, message, benchmarkCase.profile);
                replies.push(response.reply);
            }
            return calculateCaseResult({
                benchmarkCase,
                replies,
                parseEvents: observer.readEvents(),
                tokenUsage: tokenRecorder.readRecords(),
                latencyMs: Date.now() - startTime,
            });
        } catch (error: unknown) {
            return calculateCaseResult({
                benchmarkCase,
                replies,
                parseEvents: observer.readEvents(),
                tokenUsage: tokenRecorder.readRecords(),
                latencyMs: Date.now() - startTime,
                errorMessage: toErrorMessage(error),
            });
        } finally {
            await this.cleanupBenchmarkUser(userId);
        }
    };

    private createChatService = (
        config: ResolvedLlmConfig,
        benchmarkCase: BenchmarkCase,
        tokenRecorder: BenchmarkTokenUsageRecorder,
        observer: BenchmarkLlmObserver
    ): ChatService => {
        const conversationRepository = new ConversationRepository(this.dbClient.conversations);
        const externalService = new BenchmarkFixtureExternalService(benchmarkCase);
        const stageService = new ConversationStageService();
        const conversationService = new ChatConversationService(conversationRepository, externalService, stageService);
        const textCompletion = createTextCompletionPortFromChain([config], tokenRecorder);
        const llmService = new ChatLlmService(textCompletion, observer);
        const profileRepository = new CareerProfileRepository(this.dbClient.careerProfiles);
        const profileService = new CareerProfileService(profileRepository, new BenchmarkNoopEmbeddingPort(), null);
        const knowledgeService = new BenchmarkNoopCareerKnowledgeService(this.dbClient.careerDirectionExamples);
        const dreamJobRoadmapCreator: DreamJobRoadmapCreator = {
            create: async () => ({ created: true }),
        };

        return new ChatService(
            conversationService,
            stageService,
            externalService,
            llmService,
            new ChatValidationService(),
            profileService,
            new ConfidenceService(),
            new AchievementInferenceService(),
            new SeniorityInferenceService(),
            new JobSearchPlanService(),
            new JobRankingService(),
            knowledgeService,
            new JobFollowUpAnswerService(),
            new PipelineIntentService(),
            new PipelineService(this.chatConfig.jobServiceBaseUrl),
            dreamJobRoadmapCreator
        );
    };

    private cleanupBenchmarkUser = async (userId: string): Promise<void> => {
        await Promise.all([
            this.dbClient.conversations.deleteMany({ userId }),
            this.dbClient.careerProfiles.deleteMany({ userId }),
        ]);
    };
}
