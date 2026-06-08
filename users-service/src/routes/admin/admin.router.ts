import type { Collection } from "mongodb";
import type { TypedFastify } from "../../types/fastify";
import type { LlmTokenUsageDocument } from "./admin-token-usage.model";
import type { UserDocument } from "../users/user.model";
import { ADMIN_ROUTE_PATHS } from "./admin.consts";
import { deleteAdminUser, demoteAdmin, getAdminLlmTokenUsage, getAdminSession, getAdminUsers, promoteAdmin } from "./admin.handler";
import { requireAdminRequest } from "./admin.middleware";
import {
    deleteAdminUserSchema,
    demoteAdminSchema,
    getAdminLlmTokenUsageSchema,
    getAdminSessionSchema,
    getAdminUsersSchema,
    promoteAdminSchema,
} from "./admin.schema";

type RegisterRouter = (fastify: TypedFastify) => void;

export const adminRouter = (
    usersCollection: Collection<UserDocument>,
    tokenUsageCollection: Collection<LlmTokenUsageDocument>
): RegisterRouter => (fastify: TypedFastify): void => {
    const preHandler = requireAdminRequest(usersCollection);

    fastify.get(ADMIN_ROUTE_PATHS.users, { schema: getAdminUsersSchema, preHandler }, getAdminUsers(usersCollection));
    fastify.get(ADMIN_ROUTE_PATHS.llmTokenUsage, { schema: getAdminLlmTokenUsageSchema, preHandler }, getAdminLlmTokenUsage(tokenUsageCollection));
    fastify.get(ADMIN_ROUTE_PATHS.session, { schema: getAdminSessionSchema, preHandler }, getAdminSession(usersCollection));
    fastify.post(ADMIN_ROUTE_PATHS.admins, { schema: promoteAdminSchema, preHandler }, promoteAdmin(usersCollection));
    fastify.delete(ADMIN_ROUTE_PATHS.adminById, { schema: demoteAdminSchema, preHandler }, demoteAdmin(usersCollection));
    fastify.delete(ADMIN_ROUTE_PATHS.userById, { schema: deleteAdminUserSchema, preHandler }, deleteAdminUser(usersCollection));
};
