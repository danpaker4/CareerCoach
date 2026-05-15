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
