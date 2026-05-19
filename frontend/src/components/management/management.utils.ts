import {
  ADMIN_BENCHMARKS_PATH,
  ADMIN_DELETE_USER_PATH,
  ADMIN_DEMOTE_PATH,
  ADMIN_LLM_TOKEN_USAGE_PATH,
  ADMIN_USERS_PATH,
  MANAGEMENT_USERS_PAGE_SIZE,
} from './management.consts';
import type {
  AdminLlmTokenUsageOperationItem,
  AdminLlmTokenUsageOperationSeriesItem,
  AdminLlmTokenUsageResult,
  AdminLlmTokenUsageSeriesItem,
  AdminLlmTokenUsageUserAverageSeriesItem,
  AdminUsersPagination,
  AdminUsersResult,
  AdminUserSummary,
  BenchmarkCandidate,
  BenchmarkCandidateId,
  BenchmarkCaseResult,
  BenchmarkCaseSummary,
  BenchmarkConfig,
  BenchmarkMetricBreakdown,
  BenchmarkParseEvent,
  BenchmarkRubricItem,
  BenchmarkRunSummary,
  BenchmarkCandidateRunResult,
  BenchmarkManualScore,
  LlmProvider,
  TokenUsageDays,
} from './management.types';

export const isAdminUserSummary = (value: unknown): value is AdminUserSummary => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string' &&
    typeof user.email === 'string' &&
    (user.role === 'user' || user.role === 'admin')
  );
};

const isAdminUsersPagination = (value: unknown): value is AdminUsersPagination => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const pagination = value as Record<string, unknown>;
  return (
    isNumber(pagination.page) &&
    isNumber(pagination.pageSize) &&
    isNumber(pagination.total) &&
    isNumber(pagination.totalPages) &&
    typeof pagination.hasNextPage === 'boolean' &&
    typeof pagination.hasPreviousPage === 'boolean'
  );
};

export const parseAdminUsersResult = (value: unknown): AdminUsersResult | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.users) || !isAdminUsersPagination(payload.pagination)) {
    return null;
  }

  return {
    users: payload.users.filter(isAdminUserSummary),
    pagination: payload.pagination,
  };
};

export const readManagementErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
};

export const buildAdminUsersUrl = (searchQuery: string, page: number, pageSize = MANAGEMENT_USERS_PAGE_SIZE): string => {
  const trimmedQuery = searchQuery.trim();
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (trimmedQuery.length > 0) {
    params.set('query', trimmedQuery);
  }

  return `${ADMIN_USERS_PATH}?${params.toString()}`;
};

export const buildDemoteAdminUrl = (userId: string): string => `${ADMIN_DEMOTE_PATH}/${encodeURIComponent(userId)}`;

export const buildDeleteUserUrl = (userId: string): string => `${ADMIN_DELETE_USER_PATH}/${encodeURIComponent(userId)}`;

export const getAdminUserDisplayName = (user: AdminUserSummary): string =>
  `${user.firstName} ${user.lastName}`.trim();

const isLlmProvider = (value: unknown): value is LlmProvider =>
  value === 'gemini' || value === 'openai' || value === 'custom' || value === 'ollama';

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isTokenUsageSeriesItem = (value: unknown): value is AdminLlmTokenUsageSeriesItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.date === 'string' &&
    isLlmProvider(item.provider) &&
    typeof item.model === 'string' &&
    isNumber(item.promptTokens) &&
    isNumber(item.completionTokens) &&
    isNumber(item.totalTokens) &&
    isNumber(item.requestCount) &&
    isNumber(item.unknownRequestCount) &&
    isNumber(item.errorCount)
  );
};

const isTokenUsageOperationItem = (value: unknown): value is AdminLlmTokenUsageOperationItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.sourceService === 'string' &&
    typeof item.operation === 'string' &&
    isNumber(item.promptTokens) &&
    isNumber(item.completionTokens) &&
    isNumber(item.totalTokens) &&
    isNumber(item.requestCount) &&
    isNumber(item.unknownRequestCount)
  );
};

const isTokenUsageOperationSeriesItem = (value: unknown): value is AdminLlmTokenUsageOperationSeriesItem => {
  if (!isTokenUsageOperationItem(value)) {
    return false;
  }

  return typeof (value as unknown as Record<string, unknown>).date === 'string';
};

const isTokenUsageUserAverageSeriesItem = (value: unknown): value is AdminLlmTokenUsageUserAverageSeriesItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.date === 'string' &&
    isNumber(item.totalTokens) &&
    isNumber(item.requestCount) &&
    isNumber(item.activeUserCount) &&
    isNumber(item.averageTokensPerUser) &&
    isNumber(item.averageRequestsPerUser)
  );
};

export const parseTokenUsage = (value: unknown): AdminLlmTokenUsageResult | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const range = payload.range;
  if (typeof range !== 'object' || range === null || !Array.isArray(payload.series)) {
    return null;
  }

  const rangeRecord = range as Record<string, unknown>;
  if (
    typeof rangeRecord.from !== 'string' ||
    typeof rangeRecord.to !== 'string' ||
    !isNumber(rangeRecord.days)
  ) {
    return null;
  }

  return {
    range: {
      from: rangeRecord.from,
      to: rangeRecord.to,
      days: rangeRecord.days,
    },
    series: payload.series.filter(isTokenUsageSeriesItem),
    operationBreakdown: Array.isArray(payload.operationBreakdown)
      ? payload.operationBreakdown.filter(isTokenUsageOperationItem)
      : [],
    operationSeries: Array.isArray(payload.operationSeries)
      ? payload.operationSeries.filter(isTokenUsageOperationSeriesItem)
      : [],
    userAverageSeries: Array.isArray(payload.userAverageSeries)
      ? payload.userAverageSeries.filter(isTokenUsageUserAverageSeriesItem)
      : [],
  };
};

export const buildAdminLlmTokenUsageUrl = (days: TokenUsageDays): string => {
  const params = new URLSearchParams({ days: String(days) });
  return `${ADMIN_LLM_TOKEN_USAGE_PATH}?${params.toString()}`;
};

const isBenchmarkCandidateId = (value: unknown): value is BenchmarkCandidateId =>
  value === 'ollama-llama' || value === 'gemini';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isBenchmarkCandidate = (value: unknown): value is BenchmarkCandidate => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isBenchmarkCandidateId(candidate.id) &&
    typeof candidate.label === 'string' &&
    isLlmProvider(candidate.provider) &&
    typeof candidate.model === 'string' &&
    typeof candidate.available === 'boolean' &&
    (candidate.unavailableReason === undefined || typeof candidate.unavailableReason === 'string')
  );
};

const isBenchmarkCaseSummary = (value: unknown): value is BenchmarkCaseSummary => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const benchmarkCase = value as Record<string, unknown>;
  return (
    typeof benchmarkCase.id === 'string' &&
    typeof benchmarkCase.title === 'string' &&
    typeof benchmarkCase.description === 'string'
  );
};

const isBenchmarkRubricItem = (value: unknown): value is BenchmarkRubricItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return typeof item.label === 'string' && isNumber(item.weight) && typeof item.description === 'string';
};

export const parseBenchmarkConfig = (value: unknown): BenchmarkConfig | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.candidates) || !Array.isArray(payload.cases) || !Array.isArray(payload.rubric)) {
    return null;
  }

  return {
    candidates: payload.candidates.filter(isBenchmarkCandidate),
    cases: payload.cases.filter(isBenchmarkCaseSummary),
    rubric: payload.rubric.filter(isBenchmarkRubricItem),
  };
};

const isBenchmarkMetricBreakdown = (value: unknown): value is BenchmarkMetricBreakdown => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metric = value as Record<string, unknown>;
  return (
    isNumber(metric.workflowScore) &&
    isNumber(metric.structuredOutputScore) &&
    isNumber(metric.guardrailScore) &&
    isNumber(metric.reliabilityScore) &&
    isNumber(metric.tokenEfficiencyScore)
  );
};

const isBenchmarkParseEvent = (value: unknown): value is BenchmarkParseEvent => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    typeof event.operation === 'string' &&
    typeof event.rawText === 'string' &&
    (event.parseStatus === 'success' || event.parseStatus === 'fallback')
  );
};

const isBenchmarkCaseResult = (value: unknown): value is BenchmarkCaseResult => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (
    typeof result.caseId === 'string' &&
    typeof result.caseTitle === 'string' &&
    typeof result.success === 'boolean' &&
    isNumber(result.responseCount) &&
    typeof result.finalReply === 'string' &&
    isStringArray(result.replies) &&
    isStringArray(result.failedAssertions) &&
    Array.isArray(result.parseEvents) &&
    result.parseEvents.every(isBenchmarkParseEvent) &&
    isNumber(result.latencyMs) &&
    isNumber(result.totalTokens) &&
    (result.errorMessage === undefined || typeof result.errorMessage === 'string') &&
    isBenchmarkMetricBreakdown(result.metricBreakdown) &&
    isNumber(result.automaticScore)
  );
};

const isBenchmarkManualScore = (value: unknown): value is BenchmarkManualScore => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const score = value as Record<string, unknown>;
  return (
    isNumber(score.relevance) &&
    isNumber(score.personalization) &&
    isNumber(score.actionability) &&
    isNumber(score.clarity) &&
    isNumber(score.safety) &&
    typeof score.notes === 'string' &&
    (score.updatedAt === undefined || typeof score.updatedAt === 'string')
  );
};

const isBenchmarkCandidateRunResult = (value: unknown): value is BenchmarkCandidateRunResult => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;
  return (
    isBenchmarkCandidateId(result.candidateId) &&
    isLlmProvider(result.provider) &&
    typeof result.model === 'string' &&
    typeof result.available === 'boolean' &&
    (result.unavailableReason === undefined || typeof result.unavailableReason === 'string') &&
    Array.isArray(result.caseResults) &&
    result.caseResults.every(isBenchmarkCaseResult) &&
    isNumber(result.successRate) &&
    isNumber(result.averageLatencyMs) &&
    isNumber(result.totalTokens) &&
    isNumber(result.errorCount) &&
    isNumber(result.automaticScore) &&
    (result.manualScore === undefined || isBenchmarkManualScore(result.manualScore)) &&
    isNumber(result.overallScore) &&
    (result.scoreStatus === 'provisional' || result.scoreStatus === 'manual')
  );
};

const isBenchmarkRunSummary = (value: unknown): value is BenchmarkRunSummary => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const run = value as Record<string, unknown>;
  return (
    typeof run.id === 'string' &&
    typeof run.createdAt === 'string' &&
    (run.status === 'completed' || run.status === 'completed_with_errors') &&
    isStringArray(run.selectedCaseIds) &&
    Array.isArray(run.candidateResults) &&
    run.candidateResults.every(isBenchmarkCandidateRunResult)
  );
};

export const parseBenchmarkRun = (value: unknown): BenchmarkRunSummary | null =>
  isBenchmarkRunSummary(value) ? value : null;

export const parseBenchmarkRuns = (value: unknown): BenchmarkRunSummary[] | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.runs) ? payload.runs.filter(isBenchmarkRunSummary) : null;
};

export const buildBenchmarksRunsUrl = (limit: number): string => {
  const params = new URLSearchParams({ limit: String(limit) });
  return `${ADMIN_BENCHMARKS_PATH}/runs?${params.toString()}`;
};

export const buildBenchmarkRunScoreUrl = (runId: string): string =>
  `${ADMIN_BENCHMARKS_PATH}/runs/${encodeURIComponent(runId)}/scores`;
