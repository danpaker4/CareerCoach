import type { FastifyRequest, FastifySchema } from "fastify";
import type { SchematicRequest } from "../../types/fastify";
import type { UserRole } from "../users/user.model";

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

export type AdminAuthenticatedRequest<Schema extends FastifySchema> =
    SchematicRequest<Schema> & Pick<FastifyRequest, "authUser">;
