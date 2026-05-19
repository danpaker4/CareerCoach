import { ObjectId } from "mongodb";
import type { LlmTokenUsageRecordInput, LlmTokenUsageRecorder } from "../../ai/token-usage.types";
import type { ChatLlmParseEvent, ChatLlmObserver } from "../chat/llm/chat.llm.types";
import type {
    BenchmarkCase,
    BenchmarkCaseResult,
    BenchmarkCandidateRunResult,
    BenchmarkMetricBreakdown,
    BenchmarkRunDocument,
    BenchmarkRunSummary,
} from "./benchmark.types";

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const normalizeText = (value: string): string => value.trim().toLowerCase();

const includesTerm = (value: string, term: string): boolean => normalizeText(value).includes(normalizeText(term));

export class BenchmarkTokenUsageRecorder implements LlmTokenUsageRecorder {
    private readonly records: LlmTokenUsageRecordInput[] = [];

    readonly record = async (input: LlmTokenUsageRecordInput): Promise<void> => {
        this.records.push(input);
    };

    readonly readRecords = (): readonly LlmTokenUsageRecordInput[] => this.records;
}

export class BenchmarkLlmObserver implements ChatLlmObserver {
    private readonly events: ChatLlmParseEvent[] = [];

    readonly recordParseEvent = (event: ChatLlmParseEvent): void => {
        this.events.push(event);
    };

    readonly readEvents = (): readonly ChatLlmParseEvent[] => this.events;
}

export const toBenchmarkRunSummary = (run: BenchmarkRunDocument): BenchmarkRunSummary => ({
    id: run._id instanceof ObjectId ? run._id.toHexString() : "",
    createdAt: run.createdAt.toISOString(),
    status: run.status,
    selectedCaseIds: run.selectedCaseIds,
    candidateResults: run.candidateResults,
});

export const calculateCaseResult = (params: {
    readonly benchmarkCase: BenchmarkCase;
    readonly replies: readonly string[];
    readonly parseEvents: readonly ChatLlmParseEvent[];
    readonly tokenUsage: readonly LlmTokenUsageRecordInput[];
    readonly latencyMs: number;
    readonly errorMessage?: string;
}): BenchmarkCaseResult => {
    const { benchmarkCase, replies, parseEvents, tokenUsage, latencyMs, errorMessage } = params;
    const finalReply = replies.at(-1) ?? "";
    const combinedReply = replies.join("\n");
    const totalTokens = tokenUsage.reduce((sum, record) => sum + (record.usage?.totalTokens ?? 0), 0);
    const successfulTokenRecords = tokenUsage.filter((record) => (record.requestStatus ?? "success") === "success").length;
    const errorTokenRecords = tokenUsage.filter((record) => record.requestStatus === "error").length;
    const parseFallbackCount = parseEvents.filter((event) => event.parseStatus === "fallback").length;
    const jobSearchHappened = replies.some((reply) => benchmarkCase.jobs.some((job) => includesTerm(reply, job.title) || includesTerm(reply, job.company)));
    const recommendedExpectedJob = benchmarkCase.assertions.expectedRecommendedJobId
        ? replies.some((reply) => {
            const expectedJob = benchmarkCase.jobs.find((job) => job.id === benchmarkCase.assertions.expectedRecommendedJobId);
            return expectedJob ? includesTerm(reply, expectedJob.title) || includesTerm(reply, expectedJob.company) : false;
        })
        : true;
    const failedAssertions = [
        ...(benchmarkCase.assertions.expectsJobSearch && !jobSearchHappened ? ["Expected a job recommendation/search result, but no fixture job appeared in the replies."] : []),
        ...(!benchmarkCase.assertions.expectsJobSearch && jobSearchHappened ? ["Did not expect job search yet, but a fixture job appeared in the replies."] : []),
        ...(!recommendedExpectedJob ? ["Expected recommendation did not match the fixture target job."] : []),
        ...benchmarkCase.assertions.requiredReplyTerms
            .filter((term) => !includesTerm(combinedReply, term))
            .map((term) => `Required term missing from replies: ${term}`),
        ...benchmarkCase.assertions.forbiddenPhrases
            .filter((phrase) => includesTerm(combinedReply, phrase))
            .map((phrase) => `Forbidden phrase appeared in replies: ${phrase}`),
        ...benchmarkCase.assertions.forbiddenJobIds
            .filter((jobId) => includesTerm(combinedReply, jobId))
            .map((jobId) => `Internal fixture job id leaked: ${jobId}`),
        ...(errorMessage ? [`Model error: ${errorMessage}`] : []),
    ];
    const workflowScore = (() => {
        const searchScore = benchmarkCase.assertions.expectsJobSearch === jobSearchHappened ? 55 : 0;
        const recommendationScore = recommendedExpectedJob ? 30 : 0;
        const responseScore = finalReply.trim().length > 0 ? 15 : 0;
        return searchScore + recommendationScore + responseScore;
    })();
    const structuredOutputScore = parseEvents.length === 0
        ? 75
        : clampScore(((parseEvents.length - parseFallbackCount) / parseEvents.length) * 100);
    const guardrailPenalty = failedAssertions.filter((failure) =>
        failure.includes("Forbidden") || failure.includes("leaked")
    ).length * 35;
    const guardrailScore = clampScore(100 - guardrailPenalty);
    const reliabilityScore = errorMessage || errorTokenRecords > 0
        ? 0
        : clampScore(100 - Math.max(0, latencyMs - 15000) / 500);
    const tokenEfficiencyScore = successfulTokenRecords > 0 ? 100 : 0;
    const metricBreakdown: BenchmarkMetricBreakdown = {
        workflowScore: clampScore(workflowScore),
        structuredOutputScore,
        guardrailScore,
        reliabilityScore,
        tokenEfficiencyScore,
    };
    const automaticScore = clampScore(
        metricBreakdown.workflowScore * 0.4 +
        metricBreakdown.structuredOutputScore * 0.2 +
        metricBreakdown.guardrailScore * 0.15 +
        metricBreakdown.reliabilityScore * 0.15 +
        metricBreakdown.tokenEfficiencyScore * 0.1
    );

    return {
        caseId: benchmarkCase.id,
        caseTitle: benchmarkCase.title,
        success: failedAssertions.length === 0,
        responseCount: replies.length,
        finalReply,
        replies,
        failedAssertions,
        parseEvents,
        tokenUsage,
        latencyMs,
        totalTokens,
        ...(errorMessage ? { errorMessage } : {}),
        metricBreakdown,
        automaticScore,
    };
};

export const normalizeCandidateScores = (
    candidateResults: readonly BenchmarkCandidateRunResult[]
): readonly BenchmarkCandidateRunResult[] => {
    const successfulTotals = candidateResults
        .filter((candidateResult) => candidateResult.errorCount === 0 && candidateResult.totalTokens > 0)
        .map((candidateResult) => candidateResult.totalTokens);
    const minTokens = successfulTotals.length > 0 ? Math.min(...successfulTotals) : 0;

    return candidateResults.map((candidateResult) => {
        const tokenEfficiencyScore = minTokens > 0 && candidateResult.totalTokens > 0
            ? clampScore((minTokens / candidateResult.totalTokens) * 100)
            : candidateResult.errorCount === 0 ? 100 : 0;
        const caseResults = candidateResult.caseResults.map((caseResult) => {
            const metricBreakdown = {
                ...caseResult.metricBreakdown,
                tokenEfficiencyScore,
            };
            const automaticScore = clampScore(
                metricBreakdown.workflowScore * 0.4 +
                metricBreakdown.structuredOutputScore * 0.2 +
                metricBreakdown.guardrailScore * 0.15 +
                metricBreakdown.reliabilityScore * 0.15 +
                metricBreakdown.tokenEfficiencyScore * 0.1
            );
            return { ...caseResult, metricBreakdown, automaticScore };
        });
        const automaticScore = caseResults.length > 0
            ? clampScore(caseResults.reduce((sum, result) => sum + result.automaticScore, 0) / caseResults.length)
            : 0;
        return {
            ...candidateResult,
            caseResults,
            automaticScore,
            overallScore: candidateResult.scoreStatus === "manual" ? candidateResult.overallScore : automaticScore,
        };
    });
};
