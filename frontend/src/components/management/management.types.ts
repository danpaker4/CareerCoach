import type { User, UserRole } from '../../types/user';
import type { MANAGEMENT_TOKEN_USAGE_DAYS } from './management.consts';

export interface AdminUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface AdminUsersPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AdminUsersResult {
  users: AdminUserSummary[];
  pagination: AdminUsersPagination;
}

export type ManagementStatus = 'loading' | 'success' | 'error';

export type ManagementUserAction = 'promote' | 'demote' | 'delete';

export type LlmProvider = 'gemini' | 'openai' | 'custom' | 'ollama';

export type BenchmarkCandidateId = 'ollama-llama' | 'gemini';

export type TokenUsageDays = typeof MANAGEMENT_TOKEN_USAGE_DAYS[number];

export interface AdminLlmTokenUsageSeriesItem {
  date: string;
  provider: LlmProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  unknownRequestCount: number;
  errorCount: number;
}

export interface AdminLlmTokenUsageOperationItem {
  sourceService: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  unknownRequestCount: number;
}

export interface AdminLlmTokenUsageOperationSeriesItem extends AdminLlmTokenUsageOperationItem {
  date: string;
}

export interface AdminLlmTokenUsageUserAverageSeriesItem {
  date: string;
  totalTokens: number;
  requestCount: number;
  activeUserCount: number;
  averageTokensPerUser: number;
  averageRequestsPerUser: number;
}

export interface AdminLlmTokenUsageResult {
  range: {
    from: string;
    to: string;
    days: number;
  };
  series: AdminLlmTokenUsageSeriesItem[];
  operationBreakdown: AdminLlmTokenUsageOperationItem[];
  operationSeries: AdminLlmTokenUsageOperationSeriesItem[];
  userAverageSeries: AdminLlmTokenUsageUserAverageSeriesItem[];
}

export type TokenUsageStatus = 'loading' | 'success' | 'error';

export interface ManagementProps {
  currentUser: User;
}

export interface DeleteUserDialogProps {
  user: AdminUserSummary;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface TokenUsageGraphProps {
  usage: AdminLlmTokenUsageResult | null;
  status: TokenUsageStatus;
  error: string;
  selectedDays: TokenUsageDays;
  onSelectedDaysChange: (days: TokenUsageDays) => void;
}

export interface BenchmarkCandidate {
  id: BenchmarkCandidateId;
  label: string;
  provider: LlmProvider;
  model: string;
  available: boolean;
  unavailableReason?: string;
}

export interface BenchmarkCaseSummary {
  id: string;
  title: string;
  description: string;
}

export interface BenchmarkRubricItem {
  label: string;
  weight: number;
  description: string;
}

export interface BenchmarkConfig {
  candidates: BenchmarkCandidate[];
  cases: BenchmarkCaseSummary[];
  rubric: BenchmarkRubricItem[];
}

export interface BenchmarkMetricBreakdown {
  workflowScore: number;
  structuredOutputScore: number;
  guardrailScore: number;
  reliabilityScore: number;
  tokenEfficiencyScore: number;
}

export interface BenchmarkParseEvent {
  operation: string;
  rawText: string;
  parseStatus: 'success' | 'fallback';
}

export interface BenchmarkCaseResult {
  caseId: string;
  caseTitle: string;
  success: boolean;
  responseCount: number;
  finalReply: string;
  replies: string[];
  failedAssertions: string[];
  parseEvents: BenchmarkParseEvent[];
  latencyMs: number;
  totalTokens: number;
  errorMessage?: string;
  metricBreakdown: BenchmarkMetricBreakdown;
  automaticScore: number;
}

export interface BenchmarkManualScore {
  relevance: number;
  personalization: number;
  actionability: number;
  clarity: number;
  safety: number;
  notes: string;
  updatedAt?: string;
}

export interface BenchmarkCandidateRunResult {
  candidateId: BenchmarkCandidateId;
  provider: LlmProvider;
  model: string;
  available: boolean;
  unavailableReason?: string;
  caseResults: BenchmarkCaseResult[];
  successRate: number;
  averageLatencyMs: number;
  totalTokens: number;
  errorCount: number;
  automaticScore: number;
  manualScore?: BenchmarkManualScore;
  overallScore: number;
  scoreStatus: 'provisional' | 'manual';
}

export interface BenchmarkRunSummary {
  id: string;
  createdAt: string;
  status: 'completed' | 'completed_with_errors';
  selectedCaseIds: string[];
  candidateResults: BenchmarkCandidateRunResult[];
}

export type BenchmarkStatus = 'loading' | 'success' | 'error';
