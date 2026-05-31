import { apiFetch } from '../../lib/apiClient';
import {
  ADMIN_BENCHMARKS_PATH,
  ADMIN_DELETE_USER_PATH,
  ADMIN_DEMOTE_PATH,
  ADMIN_LLM_TOKEN_USAGE_PATH,
  ADMIN_RATE_LIMITS_PATH,
  ADMIN_USERS_PATH,
  buildEvaluationCaseRunUrl,
  EVALUATION_CASES_PATH,
  MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE,
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
  BenchmarkCandidateRunResult,
  BenchmarkCaseResult,
  BenchmarkCaseSummary,
  BenchmarkConfig,
  BenchmarkMetricBreakdown,
  BenchmarkParseEvent,
  BenchmarkRubricItem,
  BenchmarkRunSummary,
  ChatRateLimitConfig,
  ChatRateLimitRuleConfig,
  ChatRateLimitRuleKey,
  ChatRateLimitRules,
  EvaluationCaseSummary,
  EvaluationCheckResult,
  EvaluationExpected,
  EvaluationMessage,
  EvaluationMessageRole,
  EvaluationRunResult,
  LlmProvider,
  TokenUsageDays,
} from './management.types';

export const CHAT_RATE_LIMIT_RULE_KEYS = [
  'perUserPerMinute',
  'perUserPerDay',
  'perIpPerMinute',
  'activeRequestsPerUser',
  'dailyTokensPerUser',
  'dailyTokensGlobal',
  'maxMessageCharacters',
] as const satisfies readonly ChatRateLimitRuleKey[];

export const CHAT_RATE_LIMIT_RULE_LABELS: Record<ChatRateLimitRuleKey, string> = {
  perUserPerMinute: 'Per user per minute',
  perUserPerDay: 'Per user per day',
  perIpPerMinute: 'Per IP per minute',
  activeRequestsPerUser: 'Active requests per user',
  dailyTokensPerUser: 'Daily tokens per user',
  dailyTokensGlobal: 'Daily tokens global',
  maxMessageCharacters: 'Max message characters',
};

export const CHAT_RATE_LIMIT_RULE_DESCRIPTIONS: Record<ChatRateLimitRuleKey, string> = {
  perUserPerMinute: 'Chat requests allowed for one user in a fixed 60-second window.',
  perUserPerDay: 'Chat requests allowed for one user in the current UTC day.',
  perIpPerMinute: 'Chat requests allowed from one IP address in a fixed 60-second window.',
  activeRequestsPerUser: 'Chat responses that can be generated at the same time for one user.',
  dailyTokensPerUser: 'Known LLM tokens allowed for one user in the current UTC day.',
  dailyTokensGlobal: 'Known LLM tokens allowed globally for chat in the current UTC day.',
  maxMessageCharacters: 'Maximum characters accepted in one chat message.',
};

export const CHAT_RATE_LIMIT_RULE_MEANINGS: Record<ChatRateLimitRuleKey, string> = {
  perUserPerMinute: 'requests per user per minute',
  perUserPerDay: 'requests per user per UTC day',
  perIpPerMinute: 'requests per IP per minute',
  activeRequestsPerUser: 'running requests per user',
  dailyTokensPerUser: 'tokens per user per UTC day',
  dailyTokensGlobal: 'global chat tokens per UTC day',
  maxMessageCharacters: 'characters per chat message',
};

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

const isChatRateLimitRuleConfig = (value: unknown): value is ChatRateLimitRuleConfig => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const rule = value as Record<string, unknown>;
  return typeof rule.enabled === 'boolean' && isNumber(rule.limit);
};

const parseChatRateLimitRules = (value: unknown): ChatRateLimitRules | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const rules = value as Record<string, unknown>;
  const perUserPerMinute = rules.perUserPerMinute;
  const perUserPerDay = rules.perUserPerDay;
  const perIpPerMinute = rules.perIpPerMinute;
  const activeRequestsPerUser = rules.activeRequestsPerUser;
  const dailyTokensPerUser = rules.dailyTokensPerUser;
  const dailyTokensGlobal = rules.dailyTokensGlobal;
  const maxMessageCharacters = rules.maxMessageCharacters;
  if (
    !isChatRateLimitRuleConfig(perUserPerMinute) ||
    !isChatRateLimitRuleConfig(perUserPerDay) ||
    !isChatRateLimitRuleConfig(perIpPerMinute) ||
    !isChatRateLimitRuleConfig(activeRequestsPerUser) ||
    !isChatRateLimitRuleConfig(dailyTokensPerUser) ||
    !isChatRateLimitRuleConfig(dailyTokensGlobal) ||
    !isChatRateLimitRuleConfig(maxMessageCharacters)
  ) {
    return null;
  }

  return {
    perUserPerMinute,
    perUserPerDay,
    perIpPerMinute,
    activeRequestsPerUser,
    dailyTokensPerUser,
    dailyTokensGlobal,
    maxMessageCharacters,
  };
};

export const parseChatRateLimitConfig = (value: unknown): ChatRateLimitConfig | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const rules = parseChatRateLimitRules(payload.rules);
  if (!rules || typeof payload.updatedAt !== 'string') {
    return null;
  }

  return {
    rules,
    updatedAt: payload.updatedAt,
    ...(typeof payload.updatedByAdminUserId === 'string' ? { updatedByAdminUserId: payload.updatedByAdminUserId } : {}),
    ...(typeof payload.updatedByAdminUserName === 'string' ? { updatedByAdminUserName: payload.updatedByAdminUserName } : {}),
    ...(typeof payload.updatedByAdminUserEmail === 'string' ? { updatedByAdminUserEmail: payload.updatedByAdminUserEmail } : {}),
  };
};

export const buildRateLimitConfigPayload = (config: ChatRateLimitConfig): { rules: ChatRateLimitRules } => ({
  rules: config.rules,
});

export const rateLimitConfigUrl = (): string => ADMIN_RATE_LIMITS_PATH;

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
  if (typeof rangeRecord.from !== 'string' || typeof rangeRecord.to !== 'string' || !isNumber(rangeRecord.days)) {
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
  const hasCurrentMetricShape =
    isNumber(metric.responseCoverageScore) &&
    isNumber(metric.latencyScore) &&
    isNumber(metric.tokenEfficiencyScore);
  const hasLegacyMetricShape =
    isNumber(metric.workflowScore) &&
    isNumber(metric.structuredOutputScore) &&
    isNumber(metric.guardrailScore) &&
    isNumber(metric.reliabilityScore) &&
    isNumber(metric.tokenEfficiencyScore);

  return hasCurrentMetricShape || hasLegacyMetricShape;
};

const clampBenchmarkScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const normalizeBenchmarkMetricBreakdown = (metricBreakdown: BenchmarkMetricBreakdown): BenchmarkMetricBreakdown => {
  const metric = metricBreakdown as unknown as Record<string, unknown>;
  if (
    isNumber(metric.responseCoverageScore) &&
    isNumber(metric.latencyScore) &&
    isNumber(metric.tokenEfficiencyScore)
  ) {
    return metricBreakdown;
  }

  const workflowScore = isNumber(metric.workflowScore) ? metric.workflowScore : 0;
  const structuredOutputScore = isNumber(metric.structuredOutputScore) ? metric.structuredOutputScore : 0;
  const guardrailScore = isNumber(metric.guardrailScore) ? metric.guardrailScore : 0;
  const reliabilityScore = isNumber(metric.reliabilityScore) ? metric.reliabilityScore : 0;
  const tokenEfficiencyScore = isNumber(metric.tokenEfficiencyScore) ? metric.tokenEfficiencyScore : 0;
  return {
    responseCoverageScore: clampBenchmarkScore((workflowScore + structuredOutputScore + guardrailScore) / 3),
    latencyScore: clampBenchmarkScore(reliabilityScore),
    tokenEfficiencyScore: clampBenchmarkScore(tokenEfficiencyScore),
  };
};

const calculateBenchmarkAutomaticScore = (metricBreakdown: BenchmarkMetricBreakdown): number =>
  clampBenchmarkScore(
    (metricBreakdown.responseCoverageScore + metricBreakdown.latencyScore + metricBreakdown.tokenEfficiencyScore) / 3,
  );

const normalizeBenchmarkCaseResult = (result: BenchmarkCaseResult): BenchmarkCaseResult => {
  const metricBreakdown = normalizeBenchmarkMetricBreakdown(result.metricBreakdown);
  const resultRecord = result as unknown as Record<string, unknown>;
  const caseDescription = typeof resultRecord.caseDescription === 'string' ? resultRecord.caseDescription : result.caseTitle;
  return {
    ...result,
    caseDescription,
    metricBreakdown,
    automaticScore: calculateBenchmarkAutomaticScore(metricBreakdown),
  };
};

const normalizeBenchmarkCandidateRunResult = (result: BenchmarkCandidateRunResult): BenchmarkCandidateRunResult => {
  const caseResults = result.caseResults.map(normalizeBenchmarkCaseResult);
  const automaticScore = caseResults.length > 0
    ? clampBenchmarkScore(caseResults.reduce((sum, caseResult) => sum + caseResult.automaticScore, 0) / caseResults.length)
    : result.automaticScore;

  return {
    ...result,
    caseResults,
    successRate: caseResults.length > 0
      ? caseResults.filter((caseResult) => caseResult.success).length / caseResults.length
      : result.successRate,
    automaticScore,
    overallScore: automaticScore,
  };
};

const normalizeBenchmarkRunSummary = (run: BenchmarkRunSummary): BenchmarkRunSummary => ({
  ...run,
  candidateResults: run.candidateResults.map(normalizeBenchmarkCandidateRunResult),
});

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
    (result.caseDescription === undefined || typeof result.caseDescription === 'string') &&
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
    isNumber(result.overallScore) &&
    result.scoreStatus === 'automatic'
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
  isBenchmarkRunSummary(value) ? normalizeBenchmarkRunSummary(value) : null;

export const parseBenchmarkRuns = (value: unknown): BenchmarkRunSummary[] | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.runs) ? payload.runs.filter(isBenchmarkRunSummary).map(normalizeBenchmarkRunSummary) : null;
};

export const buildBenchmarksRunsUrl = (limit: number): string => {
  const params = new URLSearchParams({ limit: String(limit) });
  return `${ADMIN_BENCHMARKS_PATH}/runs?${params.toString()}`;
};

const isEvaluationMessageRole = (value: unknown): value is EvaluationMessageRole =>
  value === 'user' || value === 'assistant' || value === 'system';

const isEvaluationMode = (value: unknown): value is EvaluationExpected['mode'] =>
  value === 'FAST_SEARCH' || value === 'GUIDED' || value === 'DEEP_DISCOVERY';

const isEvaluationMessage = (value: unknown): value is EvaluationMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as Record<string, unknown>;
  return isEvaluationMessageRole(message.role) && typeof message.content === 'string' && message.content.length > 0;
};

const hasAtLeastOneExpectedCheck = (expected: Record<string, unknown>): boolean =>
  expected.mode !== undefined ||
  expected.maxLines !== undefined ||
  expected.mustAskQuestion !== undefined ||
  (Array.isArray(expected.forbiddenWords) && expected.forbiddenWords.length > 0);

const isEvaluationExpected = (value: unknown): value is EvaluationExpected => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const expected = value as Record<string, unknown>;
  const optionalFieldsValid =
    (expected.mode === undefined || isEvaluationMode(expected.mode)) &&
    (expected.maxLines === undefined || isNumber(expected.maxLines)) &&
    (expected.mustAskQuestion === undefined || typeof expected.mustAskQuestion === 'boolean') &&
    (expected.forbiddenWords === undefined ||
      (Array.isArray(expected.forbiddenWords) && expected.forbiddenWords.every((word) => typeof word === 'string')));

  return optionalFieldsValid && hasAtLeastOneExpectedCheck(expected);
};

export const isEvaluationCaseSummary = (value: unknown): value is EvaluationCaseSummary => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const evaluationCase = value as Record<string, unknown>;
  return (
    typeof evaluationCase.id === 'string' &&
    Array.isArray(evaluationCase.messages) &&
    evaluationCase.messages.every(isEvaluationMessage) &&
    isEvaluationExpected(evaluationCase.expected) &&
    typeof evaluationCase.createdAt === 'string' &&
    typeof evaluationCase.updatedAt === 'string'
  );
};

export const parseEvaluationCases = (value: unknown): EvaluationCaseSummary[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isEvaluationCaseSummary);
};

export const buildEvaluationCaseUrl = (caseId: string): string =>
  `${EVALUATION_CASES_PATH}/${encodeURIComponent(caseId)}`;

export const fetchEvaluationRunResult = async (caseId: string): Promise<EvaluationRunResult> => {
  const response = await apiFetch(buildEvaluationCaseRunUrl(caseId), { method: 'POST' });
  if (!response.ok) {
    throw new Error(await readManagementErrorMessage(response, MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE));
  }

  const payload: unknown = await response.json().catch(() => null);
  const parsed = parseEvaluationRunResult(payload);
  if (!parsed) {
    throw new Error(MANAGEMENT_EVALUATION_RUN_ERROR_MESSAGE);
  }

  return parsed;
};

export const isJsonEvaluationFile = (file: File): boolean =>
  file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

const EXPECTED_FIELD_KEYS = ['mode', 'maxLines', 'mustAskQuestion', 'forbiddenWords'] as const;

export type ExpectedFieldKey = (typeof EXPECTED_FIELD_KEYS)[number];

export type EvaluationComparisonRow = {
  key: ExpectedFieldKey;
  expectedDisplay: string;
  gotDisplay: string;
  passed: boolean | null;
};

export const formatExpectedFieldDisplay = (value: string | number | boolean | string[]): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return String(value);
};

export const formatGotFieldDisplay = (value: string | number | boolean | string[] | undefined): string => {
  if (value === undefined) {
    return '-';
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? 'none' : value.join(', ');
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  return String(value);
};

const hasExpectedField = (expected: EvaluationExpected, key: ExpectedFieldKey): boolean => {
  if (key === 'mode') {
    return expected.mode !== undefined;
  }

  return expected[key] !== undefined;
};

const readExpectedFieldValue = (expected: EvaluationExpected, key: ExpectedFieldKey): string | number | boolean | string[] => {
  if (key === 'mode') {
    return expected.mode ?? '';
  }

  const value = expected[key];
  if (value === undefined) {
    throw new Error(`Missing expected field: ${key}`);
  }

  return value;
};

export const buildEvaluationComparisonRows = (
  expected: EvaluationExpected,
  checks: EvaluationCheckResult[],
): EvaluationComparisonRow[] => {
  const checkByName = new Map(checks.map((check) => [check.name, check]));

  return EXPECTED_FIELD_KEYS.filter((key) => hasExpectedField(expected, key)).map((key) => {
    const check = checkByName.get(key);
    const expectedValue = readExpectedFieldValue(expected, key);

    return {
      key,
      expectedDisplay: formatExpectedFieldDisplay(check?.expected ?? expectedValue),
      gotDisplay: formatGotFieldDisplay(check?.actual),
      passed: check?.passed ?? null,
    };
  });
};

export const buildEvaluationComparisonRowsFromChecks = (
  checks: EvaluationCheckResult[],
): EvaluationComparisonRow[] =>
  checks.map((check) => ({
    key: check.name as ExpectedFieldKey,
    expectedDisplay: check.expected !== undefined ? formatExpectedFieldDisplay(check.expected) : '-',
    gotDisplay: formatGotFieldDisplay(check.actual),
    passed: check.passed,
  }));

const isEvaluationRunMessage = (value: unknown): value is EvaluationMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as Record<string, unknown>;
  return isEvaluationMessageRole(message.role) && typeof message.content === 'string' && message.content.length > 0;
};

const isEvaluationCheckResult = (value: unknown): value is EvaluationCheckResult => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const check = value as Record<string, unknown>;
  return typeof check.name === 'string' && typeof check.passed === 'boolean';
};

export const parseEvaluationRunResult = (value: unknown): EvaluationRunResult | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const metadata = payload.metadata;
  const expected = payload.expected;
  if (
    typeof payload.caseId !== 'string' ||
    typeof payload.runId !== 'string' ||
    typeof payload.passed !== 'boolean' ||
    typeof payload.reply !== 'string' ||
    !Array.isArray(payload.checks) ||
    !Array.isArray(payload.conversation) ||
    !isEvaluationExpected(expected) ||
    typeof metadata !== 'object' ||
    metadata === null
  ) {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  if (
    typeof metadataRecord.userId !== 'string' ||
    typeof metadataRecord.conversationId !== 'string' ||
    !isNumber(metadataRecord.userTurnCount) ||
    !isNumber(metadataRecord.durationMs) ||
    typeof metadataRecord.ranAt !== 'string'
  ) {
    return null;
  }

  return {
    caseId: payload.caseId,
    runId: payload.runId,
    passed: payload.passed,
    reply: payload.reply,
    conversation: payload.conversation.filter(isEvaluationRunMessage),
    checks: payload.checks.filter(isEvaluationCheckResult),
    expected,
    metadata: {
      userId: metadataRecord.userId,
      conversationId: metadataRecord.conversationId,
      userTurnCount: metadataRecord.userTurnCount,
      durationMs: metadataRecord.durationMs,
      ranAt: metadataRecord.ranAt,
    },
    mode: typeof payload.mode === 'string' ? payload.mode : undefined,
  };
};
