import { randomUUID } from "crypto";
import type { ServerConfig } from "../../server.types";
import type { MongoClient } from "../../mongo/mongo";
import type { ResolvedLlmConfig } from "../../litellm/config/litellm-config.types";
import { createTextCompletionPort } from "../../litellm/text-completion/text-completion.utils";
import { ConversationDal } from "../conversation/conversation.dal";
import { ChatConversationService } from "../conversation/conversation.service";
import { createChatFlow } from "../../chat-flow/chat-flow.factory";
import type { ChatFlow } from "../../chat-flow/chat-flow.types";
import { CareerProfileDal } from "../career-profile/dal/career-profile.dal";
import { CareerProfileService } from "../career-profile/career-profile.service";
import type { DreamJobRoadmapCreator } from "../../chat-flow/stage-2-shortcuts/dream-job/chat.dream-job-roadmap.types";
import { BenchmarkFixtureExternalService } from "./benchmark-fixture.external-service";
import { BenchmarkNoopEmbeddingPort, createBenchmarkNoopSuggestDirections } from "./benchmark-noop.services";
import { BenchmarkRunDal } from "./benchmark.dal";
import {
    BENCHMARK_CASES,
    BENCHMARK_DEFAULT_MODEL,
    BENCHMARK_FALLBACK_MODEL,
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
    isBenchmarkCandidateId,
    normalizeCandidateScores,
    toBenchmarkRunSummary,
} from "./benchmark.utils";

const average = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const resolveCandidateConfig = (candidateId: BenchmarkCandidateId, chatConfig: ServerConfig["chatConfig"]): ResolvedLlmConfig => {
    const model = candidateId === "ollama-llama" ? BENCHMARK_DEFAULT_MODEL : BENCHMARK_FALLBACK_MODEL;
    return {
        provider: "litellm",
        endpointUrl: chatConfig.llm.endpointUrl,
        model,
        ...(chatConfig.llm.apiKey ? { apiKey: chatConfig.llm.apiKey } : {}),
    };
};

const toCandidate = (candidateId: BenchmarkCandidateId, chatConfig: ServerConfig["chatConfig"]): BenchmarkCandidate => {
    const config = resolveCandidateConfig(candidateId, chatConfig);
    if (candidateId === "ollama-llama") {
        return {
            id: candidateId,
            label: "Llama via LiteLLM",
            provider: "litellm",
            model: config.model,
            available: true,
        };
    }

    return {
        id: candidateId,
        label: "Gemini via LiteLLM",
        provider: "litellm",
        model: config.model,
        available: true,
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
        private readonly dal: BenchmarkRunDal
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
        (await this.dal.list(limit)).map(toBenchmarkRunSummary);

    getRun = async (runId: string): Promise<BenchmarkRunSummary | null> => {
        const run = await this.dal.findById(runId);
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
        return toBenchmarkRunSummary(await this.dal.create(run));
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
        const chatFlow = this.createChatFlow(config, benchmarkCase, tokenRecorder, observer);
        const startTime = Date.now();
        const replies: string[] = [];

        try {
            await this.cleanupBenchmarkUser(userId);
            for (const message of benchmarkCase.messages) {
                const response = await chatFlow.sendMessage(userId, message, benchmarkCase.profile);
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

    private createChatFlow = (
        config: ResolvedLlmConfig,
        benchmarkCase: BenchmarkCase,
        tokenRecorder: BenchmarkTokenUsageRecorder,
        observer: BenchmarkLlmObserver
    ): ChatFlow => {
        const conversationDal = new ConversationDal(this.dbClient.conversations);
        const externalService = new BenchmarkFixtureExternalService(benchmarkCase);
        const conversationService = new ChatConversationService(conversationDal, externalService);
        const textCompletion = createTextCompletionPort(config, tokenRecorder);
        const profileDal = new CareerProfileDal(this.dbClient.careerProfiles);
        const profileService = new CareerProfileService(profileDal, new BenchmarkNoopEmbeddingPort(), textCompletion, null);
        const suggestDirections = createBenchmarkNoopSuggestDirections(this.dbClient.careerDirectionExamples);
        const dreamJobRoadmapCreator: DreamJobRoadmapCreator = {
            create: async () => ({ created: true }),
        };

        return createChatFlow({
            conversationService,
            externalService,
            profileService,
            textCompletion,
            jobServiceBaseUrl: this.chatConfig.jobServiceBaseUrl,
            dreamJobRoadmapCreator,
            suggestDirections,
            llmObserver: observer,
        });
    };

    private cleanupBenchmarkUser = async (userId: string): Promise<void> => {
        await Promise.all([
            this.dbClient.conversations.deleteMany({ userId }),
            this.dbClient.careerProfiles.deleteMany({ userId }),
        ]);
    };
}
