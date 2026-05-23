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

const RESPONSE_COVERAGE_SUCCESS_THRESHOLD = 70;
const RESPONSE_PRESENCE_SCORE = 20;
const LATEST_REQUEST_SCORE = 25;
const REQUIRED_TERMS_SCORE = 20;
const GUARDRAIL_SCORE = 35;

const TERM_MATCH_LIMIT = 3;
const SHORT_SIGNAL_TERMS = new Set(["ai", "api", "ci", "it", "qa", "ui"]);
const STOP_WORDS = new Set([
    "a",
    "about",
    "after",
    "am",
    "and",
    "are",
    "as",
    "at",
    "be",
    "before",
    "between",
    "can",
    "did",
    "do",
    "for",
    "from",
    "get",
    "help",
    "how",
    "i",
    "in",
    "is",
    "it",
    "know",
    "me",
    "my",
    "of",
    "on",
    "or",
    "some",
    "that",
    "the",
    "to",
    "what",
    "which",
    "with",
]);

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const calculateEqualMetricScore = (metricBreakdown: BenchmarkMetricBreakdown): number =>
    clampScore((metricBreakdown.responseCoverageScore + metricBreakdown.latencyScore + metricBreakdown.tokenEfficiencyScore) / 3);

const extractSignificantTerms = (value: string): readonly string[] =>
    normalizeText(value)
        .split(/[^a-z0-9+#.]+/)
        .filter((term) => term.length > 0)
        .filter((term) => (term.length > 2 || SHORT_SIGNAL_TERMS.has(term)) && !STOP_WORDS.has(term));

const calculateTermCoverageScore = (reply: string, terms: readonly string[], maxScore: number): number => {
    if (terms.length === 0) {
        return maxScore;
    }

    const matchedCount = terms.filter((term) => includesTerm(reply, term)).length;
    const denominator = Math.min(TERM_MATCH_LIMIT, terms.length);
    return clampScore((Math.min(matchedCount, denominator) / denominator) * maxScore);
};

const readForbiddenFailures = (benchmarkCase: BenchmarkCase, reply: string): readonly string[] => [
    ...benchmarkCase.assertions.forbiddenPhrases
        .filter((phrase) => includesTerm(reply, phrase))
        .map((phrase) => `Forbidden phrase appeared in reply: ${phrase}`),
    ...benchmarkCase.assertions.forbiddenJobIds
        .filter((jobId) => includesTerm(reply, jobId))
        .map((jobId) => `Internal fixture job id leaked: ${jobId}`),
];

const calculateResponseCoverageScore = (benchmarkCase: BenchmarkCase, reply: string, forbiddenFailures: readonly string[]): number => {
    if (reply.trim().length === 0) {
        return 0;
    }

    const latestMessageTerms = extractSignificantTerms(benchmarkCase.messages.at(-1) ?? "");
    const requiredTermsScore = calculateTermCoverageScore(reply, benchmarkCase.assertions.requiredReplyTerms, REQUIRED_TERMS_SCORE);
    const latestMessageScore = calculateTermCoverageScore(reply, latestMessageTerms, LATEST_REQUEST_SCORE);
    const guardrailScore = forbiddenFailures.length === 0 ? GUARDRAIL_SCORE : 0;
    return clampScore(RESPONSE_PRESENCE_SCORE + latestMessageScore + requiredTermsScore + guardrailScore);
};

const normalizeMetricBreakdown = (metricBreakdown: BenchmarkMetricBreakdown): BenchmarkMetricBreakdown => {
    const metricRecord = metricBreakdown as unknown as Record<string, unknown>;
    if (
        isNumber(metricRecord.responseCoverageScore) &&
        isNumber(metricRecord.latencyScore) &&
        isNumber(metricRecord.tokenEfficiencyScore)
    ) {
        return metricBreakdown;
    }

    const workflowScore = isNumber(metricRecord.workflowScore) ? metricRecord.workflowScore : 0;
    const structuredOutputScore = isNumber(metricRecord.structuredOutputScore) ? metricRecord.structuredOutputScore : 0;
    const guardrailScore = isNumber(metricRecord.guardrailScore) ? metricRecord.guardrailScore : 0;
    const reliabilityScore = isNumber(metricRecord.reliabilityScore) ? metricRecord.reliabilityScore : 0;
    const tokenEfficiencyScore = isNumber(metricRecord.tokenEfficiencyScore) ? metricRecord.tokenEfficiencyScore : 0;
    return {
        responseCoverageScore: clampScore((workflowScore + structuredOutputScore + guardrailScore) / 3),
        latencyScore: clampScore(reliabilityScore),
        tokenEfficiencyScore: clampScore(tokenEfficiencyScore),
    };
};

const normalizeCaseResultForSummary = (caseResult: BenchmarkCaseResult): BenchmarkCaseResult => {
    const metricBreakdown = normalizeMetricBreakdown(caseResult.metricBreakdown);
    const automaticScore = calculateEqualMetricScore(metricBreakdown);
    const caseRecord = caseResult as unknown as Record<string, unknown>;
    const caseDescription = typeof caseRecord.caseDescription === "string" ? caseRecord.caseDescription : caseResult.caseTitle;
    return {
        ...caseResult,
        caseDescription,
        success: caseResult.errorMessage ? false : metricBreakdown.responseCoverageScore >= RESPONSE_COVERAGE_SUCCESS_THRESHOLD,
        metricBreakdown,
        automaticScore,
    };
};

const readRelativeBaseline = (
    candidateResults: readonly BenchmarkCandidateRunResult[],
    caseId: string,
    readValue: (caseResult: BenchmarkCaseResult) => number
): number => {
    const values = candidateResults
        .flatMap((candidateResult) => candidateResult.caseResults)
        .filter((caseResult) => caseResult.caseId === caseId && !caseResult.errorMessage)
        .map(readValue)
        .filter((value) => value > 0);

    return values.length > 0 ? Math.min(...values) : 0;
};

const calculateRelativeScore = (baseline: number, value: number): number =>
    baseline > 0 && value > 0 ? clampScore((baseline / value) * 100) : 0;

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
    candidateResults: run.candidateResults.map((candidateResult) => {
        const caseResults = candidateResult.caseResults.map(normalizeCaseResultForSummary);
        const automaticScore = caseResults.length > 0
            ? clampScore(caseResults.reduce((sum, result) => sum + result.automaticScore, 0) / caseResults.length)
            : candidateResult.automaticScore;
        return {
            candidateId: candidateResult.candidateId,
            provider: candidateResult.provider,
            model: candidateResult.model,
            available: candidateResult.available,
            ...(candidateResult.unavailableReason ? { unavailableReason: candidateResult.unavailableReason } : {}),
            caseResults,
            successRate: caseResults.length > 0
                ? caseResults.filter((caseResult) => caseResult.success).length / caseResults.length
                : candidateResult.successRate,
            averageLatencyMs: candidateResult.averageLatencyMs,
            totalTokens: candidateResult.totalTokens,
            errorCount: candidateResult.errorCount,
            automaticScore,
            overallScore: automaticScore,
            scoreStatus: "automatic",
        };
    }),
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
    const forbiddenFailures = readForbiddenFailures(benchmarkCase, combinedReply);
    const responseCoverageScore = errorMessage ? 0 : calculateResponseCoverageScore(benchmarkCase, finalReply, forbiddenFailures);
    const failedAssertions = [
        ...(finalReply.trim().length === 0 ? ["Reply was empty."] : []),
        ...(responseCoverageScore < RESPONSE_COVERAGE_SUCCESS_THRESHOLD && finalReply.trim().length > 0
            ? ["Reply did not cover enough of the latest user request."]
            : []),
        ...benchmarkCase.assertions.requiredReplyTerms
            .filter((term) => !includesTerm(finalReply, term))
            .map((term) => `Broad required term missing from final reply: ${term}`),
        ...forbiddenFailures,
        ...(errorMessage ? [`Model error: ${errorMessage}`] : []),
    ];
    const metricBreakdown: BenchmarkMetricBreakdown = {
        responseCoverageScore,
        latencyScore: errorMessage ? 0 : 100,
        tokenEfficiencyScore: errorMessage ? 0 : 100,
    };
    const automaticScore = calculateEqualMetricScore(metricBreakdown);

    return {
        caseId: benchmarkCase.id,
        caseTitle: benchmarkCase.title,
        caseDescription: benchmarkCase.description,
        success: !errorMessage && responseCoverageScore >= RESPONSE_COVERAGE_SUCCESS_THRESHOLD,
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
    return candidateResults.map((candidateResult) => {
        const caseResults = candidateResult.caseResults.map((caseResult) => {
            const fastestLatencyMs = readRelativeBaseline(candidateResults, caseResult.caseId, (result) => result.latencyMs);
            const lowestTokenCount = readRelativeBaseline(candidateResults, caseResult.caseId, (result) => result.totalTokens);
            const metricBreakdown = {
                ...caseResult.metricBreakdown,
                latencyScore: caseResult.errorMessage
                    ? 0
                    : calculateRelativeScore(fastestLatencyMs, caseResult.latencyMs),
                tokenEfficiencyScore: caseResult.errorMessage
                    ? 0
                    : calculateRelativeScore(lowestTokenCount, caseResult.totalTokens),
            };
            const automaticScore = calculateEqualMetricScore(metricBreakdown);
            return { ...caseResult, metricBreakdown, automaticScore };
        });
        const automaticScore = caseResults.length > 0
            ? clampScore(caseResults.reduce((sum, result) => sum + result.automaticScore, 0) / caseResults.length)
            : 0;
        return {
            ...candidateResult,
            caseResults,
            automaticScore,
            overallScore: automaticScore,
            scoreStatus: "automatic",
        };
    });
};
