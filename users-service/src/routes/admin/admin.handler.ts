import type { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection } from "mongodb";
import type { SchematicRequest } from "../../types/fastify";
import type { UserDocument } from "../users/user.model";
import { ADMIN_USERS_SEARCH_LIMIT } from "./admin.consts";
import { deleteAdminUserSchema, demoteAdminSchema, getAdminUsersSchema, promoteAdminSchema } from "./admin.schema";
import type { AdminAuthenticatedRequest, DeleteAdminUserResult, DemoteAdminResult, PromoteAdminResult } from "./admin.types";
import { buildExactEmailRegex, buildSearchRegex, toAdminUserSummary } from "./admin.utils";

export const getAdminUsers = (usersCollection: Collection<UserDocument>) =>
    async (request: SchematicRequest<typeof getAdminUsersSchema>, reply: FastifyReply): Promise<void> => {
        const query = request.query.query?.trim() ?? "";
        const searchRegex = query.length > 0 ? buildSearchRegex(query) : null;
        const users = await usersCollection
            .find(searchRegex
                ? {
                    $or: [
                        { email: searchRegex },
                        { firstName: searchRegex },
                        { lastName: searchRegex },
                    ],
                }
                : {})
            .sort({ email: 1 })
            .limit(ADMIN_USERS_SEARCH_LIMIT)
            .toArray();

        reply.status(StatusCodes.OK).send(users.map(toAdminUserSummary));
    };

export const promoteAdmin = (usersCollection: Collection<UserDocument>) =>
    async (request: SchematicRequest<typeof promoteAdminSchema>, reply: FastifyReply): Promise<void> => {
        const user = await usersCollection.findOne({ email: buildExactEmailRegex(request.body.email) });
        if (!user) {
            reply.status(StatusCodes.NOT_FOUND).send({
                error: "User not found",
                errorCode: "USER_NOT_FOUND",
            });
            return;
        }

        if (user.role !== "admin") {
            await usersCollection.updateOne({ _id: user._id }, { $set: { role: "admin" } });
        }

        const result: PromoteAdminResult = {
            user: toAdminUserSummary({ ...user, role: "admin" }),
        };

        reply.status(StatusCodes.OK).send(result);
    };

export const demoteAdmin = (usersCollection: Collection<UserDocument>) =>
    async (request: AdminAuthenticatedRequest<typeof demoteAdminSchema>, reply: FastifyReply): Promise<void> => {
        const { userId } = request.params;
        if (request.authUser?.userId === userId) {
            reply.status(StatusCodes.FORBIDDEN).send({
                error: "Admins cannot demote themselves",
                errorCode: "SELF_DEMOTION_FORBIDDEN",
            });
            return;
        }

        const user = await usersCollection.findOne({ _id: userId });
        if (!user) {
            reply.status(StatusCodes.NOT_FOUND).send({
                error: "User not found",
                errorCode: "USER_NOT_FOUND",
            });
            return;
        }

        if (user.role === "admin") {
            const adminCount = await usersCollection.countDocuments({ role: "admin" });
            if (adminCount <= 1) {
                reply.status(StatusCodes.FORBIDDEN).send({
                    error: "Cannot demote the last admin",
                    errorCode: "LAST_ADMIN_FORBIDDEN",
                });
                return;
            }

            await usersCollection.updateOne({ _id: user._id }, { $set: { role: "user" } });
        }

        const result: DemoteAdminResult = {
            user: toAdminUserSummary({ ...user, role: "user" }),
        };

        reply.status(StatusCodes.OK).send(result);
    };

export const deleteAdminUser = (usersCollection: Collection<UserDocument>) =>
    async (request: AdminAuthenticatedRequest<typeof deleteAdminUserSchema>, reply: FastifyReply): Promise<void> => {
        const { userId } = request.params;
        if (request.authUser?.userId === userId) {
            reply.status(StatusCodes.FORBIDDEN).send({
                error: "Admins cannot delete themselves",
                errorCode: "SELF_DELETE_FORBIDDEN",
            });
            return;
        }

        const user = await usersCollection.findOne({ _id: userId });
        if (!user) {
            reply.status(StatusCodes.NOT_FOUND).send({
                error: "User not found",
                errorCode: "USER_NOT_FOUND",
            });
            return;
        }

        if (user.role === "admin") {
            const adminCount = await usersCollection.countDocuments({ role: "admin" });
            if (adminCount <= 1) {
                reply.status(StatusCodes.FORBIDDEN).send({
                    error: "Cannot delete the last admin",
                    errorCode: "LAST_ADMIN_FORBIDDEN",
                });
                return;
            }
        }

        await usersCollection.deleteOne({ _id: userId });

        const result: DeleteAdminUserResult = {
            deletedUserId: userId,
        };

        reply.status(StatusCodes.OK).send(result);
    };
