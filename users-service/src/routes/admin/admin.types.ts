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

export type PromoteAdminResult = {
    user: AdminUserSummary;
};

export type DemoteAdminResult = {
    user: AdminUserSummary;
};

export type DeleteAdminUserResult = {
    deletedUserId: string;
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
};

export type AdminLlmTokenUsageResult = {
    range: {
        from: string;
        to: string;
        days: number;
    };
    series: AdminLlmTokenUsageSeriesItem[];
};

export type AdminAuthenticatedRequest<Schema extends FastifySchema> =
    SchematicRequest<Schema> & Pick<FastifyRequest, "authUser">;
