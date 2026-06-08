import type { FastifyRequest, FastifySchema } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import type { UserRole } from "../users/user.model";
import type { LlmProvider } from "./admin-token-usage.model";

export type AdminUserSummary = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
};

export type AdminUsersPagination = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};

export type AdminUsersResult = {
    users: AdminUserSummary[];
    pagination: AdminUsersPagination;
};

export type PromoteAdminResult = {
    user: AdminUserSummary;
};

export type DemoteAdminResult = {
    user: AdminUserSummary;
};

export type DeleteAdminUserResult = {
    deletedUserId: string;
};

export type AdminSessionResult = {
    adminUserId: string;
    adminUserName: string;
    adminUserEmail: string;
};

export type AdminLlmTokenUsageSeriesItem = {
    date: string;
    provider: LlmProvider;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestCount: number;
    unknownRequestCount: number;
    errorCount: number;
};

export type AdminLlmTokenUsageOperationItem = {
    sourceService: string;
    operation: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestCount: number;
    unknownRequestCount: number;
};

export type AdminLlmTokenUsageOperationSeriesItem = AdminLlmTokenUsageOperationItem & {
    date: string;
};

export type AdminLlmTokenUsageUserAverageSeriesItem = {
    date: string;
    totalTokens: number;
    requestCount: number;
    activeUserCount: number;
    averageTokensPerUser: number;
    averageRequestsPerUser: number;
};

export type AdminLlmTokenUsageResult = {
    range: {
        from: string;
        to: string;
        days: number;
    };
    series: AdminLlmTokenUsageSeriesItem[];
    operationBreakdown: AdminLlmTokenUsageOperationItem[];
    operationSeries: AdminLlmTokenUsageOperationSeriesItem[];
    userAverageSeries: AdminLlmTokenUsageUserAverageSeriesItem[];
};

export type AdminAuthenticatedRequest<Schema extends FastifySchema> =
    SchematicRequest<Schema> & Pick<FastifyRequest, "authUser">;
