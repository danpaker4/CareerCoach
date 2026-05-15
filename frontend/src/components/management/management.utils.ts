import { ADMIN_DELETE_USER_PATH, ADMIN_DEMOTE_PATH, ADMIN_LLM_TOKEN_USAGE_PATH, ADMIN_USERS_PATH, MANAGEMENT_USERS_PAGE_SIZE } from './management.consts';
import type {
  AdminLlmTokenUsageOperationItem,
  AdminLlmTokenUsageOperationSeriesItem,
  AdminLlmTokenUsageResult,
  AdminLlmTokenUsageSeriesItem,
  AdminLlmTokenUsageUserAverageSeriesItem,
  AdminUsersPagination,
  AdminUsersResult,
  AdminUserSummary,
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
