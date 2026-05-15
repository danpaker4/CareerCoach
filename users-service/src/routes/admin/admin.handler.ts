import type { FastifyReply } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Collection, Filter } from "mongodb";
import type { SchematicRequest } from "../../types/fastify";
import type { LlmTokenUsageDocument } from "./admin-token-usage.model";
import type { UserDocument } from "../users/user.model";
import { deleteAdminUserSchema, demoteAdminSchema, getAdminLlmTokenUsageSchema, getAdminUsersSchema, promoteAdminSchema } from "./admin.schema";
import type {
    AdminAuthenticatedRequest,
    AdminLlmTokenUsageOperationItem,
    AdminLlmTokenUsageOperationSeriesItem,
    AdminLlmTokenUsageResult,
    AdminLlmTokenUsageSeriesItem,
    AdminLlmTokenUsageUserAverageSeriesItem,
    AdminUsersResult,
    DeleteAdminUserResult,
    DemoteAdminResult,
    PromoteAdminResult,
} from "./admin.types";
import { buildExactEmailRegex, buildSearchRegex, toAdminUserSummary } from "./admin.utils";

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfUtcDay = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const getAdminUsers = (usersCollection: Collection<UserDocument>) =>
    async (request: SchematicRequest<typeof getAdminUsersSchema>, reply: FastifyReply): Promise<void> => {
        const query = request.query.query?.trim() ?? "";
        const requestedPage = request.query.page;
        const pageSize = request.query.pageSize;
        const searchRegex = query.length > 0 ? buildSearchRegex(query) : null;
        const validUserFilter: Filter<UserDocument> = {
            _id: { $type: "string" },
            email: { $type: "string" },
            firstName: { $type: "string" },
            lastName: { $type: "string" },
        };
        const userFilter: Filter<UserDocument> = searchRegex
            ? {
                ...validUserFilter,
                $or: [
                    { email: searchRegex },
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                ],
            }
            : validUserFilter;
        const total = await usersCollection.countDocuments(userFilter);
        const totalPages = Math.ceil(total / pageSize);
        const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
        const users = await usersCollection
            .find(userFilter)
            .sort({ email: 1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray();

        const result: AdminUsersResult = {
            users: users.map(toAdminUserSummary),
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1 && totalPages > 0,
            },
        };

        reply.status(StatusCodes.OK).send(result);
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

export const getAdminLlmTokenUsage = (tokenUsageCollection: Collection<LlmTokenUsageDocument>) =>
    async (request: SchematicRequest<typeof getAdminLlmTokenUsageSchema>, reply: FastifyReply): Promise<void> => {
        const days = request.query.days;
        const now = new Date();
        const from = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY_MS);
        const [series, operationBreakdown, operationSeries, userAverageSeries] = await Promise.all([
            tokenUsageCollection.aggregate<AdminLlmTokenUsageSeriesItem>([
                {
                    $match: {
                        createdAt: {
                            $gte: from,
                            $lte: now,
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                            provider: "$provider",
                            model: "$model",
                        },
                        promptTokens: { $sum: "$promptTokens" },
                        completionTokens: { $sum: "$completionTokens" },
                        totalTokens: { $sum: "$totalTokens" },
                        requestCount: { $sum: "$requestCount" },
                        unknownRequestCount: {
                            $sum: {
                                $cond: [{ $eq: ["$tokenStatus", "unknown"] }, "$requestCount", 0],
                            },
                        },
                        errorCount: {
                            $sum: {
                                $cond: [{ $eq: [{ $ifNull: ["$requestStatus", "success"] }, "error"] }, "$requestCount", 0],
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        date: "$_id.date",
                        provider: "$_id.provider",
                        model: "$_id.model",
                        promptTokens: 1,
                        completionTokens: 1,
                        totalTokens: 1,
                        requestCount: 1,
                        unknownRequestCount: 1,
                        errorCount: 1,
                    },
                },
                { $sort: { date: 1, provider: 1, model: 1 } },
            ]).toArray(),
            tokenUsageCollection.aggregate<AdminLlmTokenUsageOperationItem>([
                {
                    $match: {
                        createdAt: {
                            $gte: from,
                            $lte: now,
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            sourceService: "$sourceService",
                            operation: "$operation",
                        },
                        promptTokens: { $sum: "$promptTokens" },
                        completionTokens: { $sum: "$completionTokens" },
                        totalTokens: { $sum: "$totalTokens" },
                        requestCount: { $sum: "$requestCount" },
                        unknownRequestCount: {
                            $sum: {
                                $cond: [{ $eq: ["$tokenStatus", "unknown"] }, "$requestCount", 0],
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        sourceService: "$_id.sourceService",
                        operation: "$_id.operation",
                        promptTokens: 1,
                        completionTokens: 1,
                        totalTokens: 1,
                        requestCount: 1,
                        unknownRequestCount: 1,
                    },
                },
                { $sort: { totalTokens: -1, requestCount: -1, sourceService: 1, operation: 1 } },
            ]).toArray(),
            tokenUsageCollection.aggregate<AdminLlmTokenUsageOperationSeriesItem>([
                {
                    $match: {
                        createdAt: {
                            $gte: from,
                            $lte: now,
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                            sourceService: "$sourceService",
                            operation: "$operation",
                        },
                        promptTokens: { $sum: "$promptTokens" },
                        completionTokens: { $sum: "$completionTokens" },
                        totalTokens: { $sum: "$totalTokens" },
                        requestCount: { $sum: "$requestCount" },
                        unknownRequestCount: {
                            $sum: {
                                $cond: [{ $eq: ["$tokenStatus", "unknown"] }, "$requestCount", 0],
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        date: "$_id.date",
                        sourceService: "$_id.sourceService",
                        operation: "$_id.operation",
                        promptTokens: 1,
                        completionTokens: 1,
                        totalTokens: 1,
                        requestCount: 1,
                        unknownRequestCount: 1,
                    },
                },
                { $sort: { date: 1, sourceService: 1, operation: 1 } },
            ]).toArray(),
            tokenUsageCollection.aggregate<AdminLlmTokenUsageUserAverageSeriesItem>([
                {
                    $match: {
                        createdAt: {
                            $gte: from,
                            $lte: now,
                        },
                        userId: { $type: "string" },
                    },
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                        },
                        totalTokens: { $sum: "$totalTokens" },
                        requestCount: { $sum: "$requestCount" },
                        userIds: { $addToSet: "$userId" },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        date: "$_id.date",
                        totalTokens: 1,
                        requestCount: 1,
                        activeUserCount: { $size: "$userIds" },
                    },
                },
                {
                    $project: {
                        date: 1,
                        totalTokens: 1,
                        requestCount: 1,
                        activeUserCount: 1,
                        averageTokensPerUser: {
                            $cond: [
                                { $gt: ["$activeUserCount", 0] },
                                { $divide: ["$totalTokens", "$activeUserCount"] },
                                0,
                            ],
                        },
                        averageRequestsPerUser: {
                            $cond: [
                                { $gt: ["$activeUserCount", 0] },
                                { $divide: ["$requestCount", "$activeUserCount"] },
                                0,
                            ],
                        },
                    },
                },
                { $sort: { date: 1 } },
            ]).toArray(),
        ]);

        const result: AdminLlmTokenUsageResult = {
            range: {
                from: from.toISOString(),
                to: now.toISOString(),
                days,
            },
            series,
            operationBreakdown,
            operationSeries,
            userAverageSeries,
        };

        reply.status(StatusCodes.OK).send(result);
    };
