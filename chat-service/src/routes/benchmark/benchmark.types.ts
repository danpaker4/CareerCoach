import type { LlmProvider, LlmTokenUsageRecordInput } from "../../ai/token-usage.types";
import type { ObjectId } from "mongodb";
import type { ProfileInput } from "../conversation/conversation.types";
import type { JobSearchResultItem } from "../chat/chat.types";
import type { RoleExperienceEntry } from "../external-chat/role-experience.types";
import type { ChatLlmParseEvent } from "../chat/llm/chat.llm.types";

export type BenchmarkCandidateId = "ollama-llama" | "gemini";

export type BenchmarkRunStatus = "completed" | "completed_with_errors";

export type BenchmarkCaseAssertion = {
    readonly forbiddenPhrases: readonly string[];
    readonly forbiddenJobIds: readonly string[];
    readonly requiredReplyTerms: readonly string[];
    readonly fixtureOnlyTerms?: readonly string[];
};

export type BenchmarkCase = {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly messages: readonly string[];
    readonly profile: ProfileInput;
    readonly achievements: readonly { readonly id: string; readonly name: string; readonly grade: number }[];
    readonly roleExperience: readonly RoleExperienceEntry[];
    readonly jobs: readonly JobSearchResultItem[];
    readonly assertions: BenchmarkCaseAssertion;
};

export type BenchmarkCandidate = {
    readonly id: BenchmarkCandidateId;
    readonly label: string;
    readonly provider: LlmProvider;
    readonly model: string;
    readonly available: boolean;
    readonly unavailableReason?: string;
};

export type BenchmarkMetricBreakdown = {
    readonly responseCoverageScore: number;
    readonly latencyScore: number;
    readonly tokenEfficiencyScore: number;
};

export type BenchmarkCaseResult = {
    readonly caseId: string;
    readonly caseTitle: string;
    readonly caseDescription: string;
    readonly success: boolean;
    readonly responseCount: number;
    readonly finalReply: string;
    readonly replies: readonly string[];
    readonly failedAssertions: readonly string[];
    readonly parseEvents: readonly ChatLlmParseEvent[];
    readonly tokenUsage: readonly LlmTokenUsageRecordInput[];
    readonly latencyMs: number;
    readonly totalTokens: number;
    readonly errorMessage?: string;
    readonly metricBreakdown: BenchmarkMetricBreakdown;
    readonly automaticScore: number;
};

export type BenchmarkCandidateRunResult = {
    readonly candidateId: BenchmarkCandidateId;
    readonly provider: LlmProvider;
    readonly model: string;
    readonly available: boolean;
    readonly unavailableReason?: string;
    readonly caseResults: readonly BenchmarkCaseResult[];
    readonly successRate: number;
    readonly averageLatencyMs: number;
    readonly totalTokens: number;
    readonly errorCount: number;
    readonly automaticScore: number;
    readonly overallScore: number;
    readonly scoreStatus: "automatic";
};

export type BenchmarkRunDocument = {
    readonly _id?: ObjectId;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly status: BenchmarkRunStatus;
    readonly requestedByAdminUserId: string;
    readonly selectedCaseIds: readonly string[];
    readonly selectedCandidateIds: readonly BenchmarkCandidateId[];
    readonly candidateResults: readonly BenchmarkCandidateRunResult[];
};

export type BenchmarkRunSummary = {
    readonly id: string;
    readonly createdAt: string;
    readonly status: BenchmarkRunStatus;
    readonly selectedCaseIds: readonly string[];
    readonly candidateResults: readonly BenchmarkCandidateRunResult[];
};

export type BenchmarkConfigResponse = {
    readonly candidates: readonly BenchmarkCandidate[];
    readonly cases: readonly Pick<BenchmarkCase, "id" | "title" | "description">[];
    readonly rubric: readonly { readonly label: string; readonly weight: number; readonly description: string }[];
};

export type BenchmarkRunRequest = {
    readonly caseIds?: readonly string[];
    readonly candidateIds?: readonly BenchmarkCandidateId[];
    readonly sampleCount?: number;
};
