import type { Collection } from "mongodb";
import { CHAT_ACTIVE_REQUEST_TTL_MS, CHAT_RATE_LIMIT_CONFIG_ID } from "./chat-rate-limit.consts";
import type { LlmTokenUsageDocument } from "../../../ai/token-usage/token-usage.types";
import type { AdminSession } from "../../../routes/admin/admin-auth.types";
import type {
    ChatActiveRequestDocument,
    ChatRateLimitConfigDocument,
    ChatRateLimitConfigHistoryDocument,
    ChatRateLimitCounterDocument,
    ChatRateLimitRuleKey,
    ChatRateLimitRules,
} from "./chat-rate-limit.types";
import { buildDefaultChatRateLimitConfig, mergeChatRateLimitRulesWithDefaults } from "./chat-rate-limit.utils";

type DuplicateKeyError = {
    readonly code?: unknown;
};

const isDuplicateKeyError = (error: unknown): error is DuplicateKeyError =>
    typeof error === "object" && error !== null && "code" in error && (error as DuplicateKeyError).code === 11000;

const buildCounterKey = (rule: ChatRateLimitRuleKey, identity: string, windowStart: Date): string =>
    `${rule}:${identity}:${windowStart.toISOString()}`;

const buildActiveRequestKey = (userId: string): string => `user:${userId}`;

const readTokenTotal = (documents: readonly { readonly totalTokens: number }[]): number =>
    documents[0]?.totalTokens ?? 0;

export class ChatRateLimitDal {
    constructor(
        private readonly configCollection: Collection<ChatRateLimitConfigDocument>,
        private readonly configHistoryCollection: Collection<ChatRateLimitConfigHistoryDocument>,
        private readonly countersCollection: Collection<ChatRateLimitCounterDocument>,
        private readonly activeRequestsCollection: Collection<ChatActiveRequestDocument>,
        private readonly tokenUsageCollection: Collection<LlmTokenUsageDocument>
    ) { }

    getConfig = async (): Promise<ChatRateLimitConfigDocument> => {
        const config = await this.configCollection.findOne({ _id: CHAT_RATE_LIMIT_CONFIG_ID });
        if (config) {
            return {
                ...config,
                rules: mergeChatRateLimitRulesWithDefaults(config.rules),
            };
        }

        const defaultConfig = buildDefaultChatRateLimitConfig();
        await this.configCollection.updateOne(
            { _id: CHAT_RATE_LIMIT_CONFIG_ID },
            { $setOnInsert: defaultConfig },
            { upsert: true }
        );
        return defaultConfig;
    };

    updateConfig = async (rules: ChatRateLimitRules, updatedByAdmin: AdminSession): Promise<ChatRateLimitConfigDocument> => {
        const updatedAt = new Date();
        const config: ChatRateLimitConfigDocument = {
            _id: CHAT_RATE_LIMIT_CONFIG_ID,
            rules,
            updatedAt,
            updatedByAdminUserId: updatedByAdmin.adminUserId,
            ...(updatedByAdmin.adminUserName ? { updatedByAdminUserName: updatedByAdmin.adminUserName } : {}),
            ...(updatedByAdmin.adminUserEmail ? { updatedByAdminUserEmail: updatedByAdmin.adminUserEmail } : {}),
        };
        await this.configCollection.updateOne(
            { _id: CHAT_RATE_LIMIT_CONFIG_ID },
            {
                $set: {
                    rules,
                    updatedAt,
                    updatedByAdminUserId: updatedByAdmin.adminUserId,
                    ...(updatedByAdmin.adminUserName ? { updatedByAdminUserName: updatedByAdmin.adminUserName } : {}),
                    ...(updatedByAdmin.adminUserEmail ? { updatedByAdminUserEmail: updatedByAdmin.adminUserEmail } : {}),
                },
                $setOnInsert: { _id: CHAT_RATE_LIMIT_CONFIG_ID },
            },
            { upsert: true }
        );
        await this.configHistoryCollection.insertOne({
            configId: CHAT_RATE_LIMIT_CONFIG_ID,
            rules,
            updatedAt,
            updatedByAdminUserId: updatedByAdmin.adminUserId,
            ...(updatedByAdmin.adminUserName ? { updatedByAdminUserName: updatedByAdmin.adminUserName } : {}),
            ...(updatedByAdmin.adminUserEmail ? { updatedByAdminUserEmail: updatedByAdmin.adminUserEmail } : {}),
        });
        return config;
    };

    incrementCounter = async (params: {
        readonly rule: ChatRateLimitRuleKey;
        readonly identity: string;
        readonly windowStart: Date;
        readonly expiresAt: Date;
    }): Promise<number> => {
        const { rule, identity, windowStart, expiresAt } = params;
        const now = new Date();
        const key = buildCounterKey(rule, identity, windowStart);
        const update = {
            $inc: { count: 1 },
            $set: { updatedAt: now, expiresAt },
            $setOnInsert: { key, rule, identity, windowStart, createdAt: now },
        };
        const updatedCounter = await this.countersCollection.findOneAndUpdate(
            { key },
            update,
            { upsert: true, returnDocument: "after" }
        ).catch(async (error: unknown) => {
            if (!isDuplicateKeyError(error)) {
                throw error;
            }

            return await this.countersCollection.findOneAndUpdate(
                { key },
                { $inc: update.$inc, $set: update.$set },
                { returnDocument: "after" }
            );
        });

        return updatedCounter?.count ?? 1;
    };

    acquireActiveRequest = async (userId: string, limit: number): Promise<boolean> => {
        const now = new Date();
        const key = buildActiveRequestKey(userId);
        const expiresAt = new Date(now.getTime() + CHAT_ACTIVE_REQUEST_TTL_MS);
        await this.activeRequestsCollection.deleteMany({ key, expiresAt: { $lte: now } });

        const incrementedExisting = await this.activeRequestsCollection.findOneAndUpdate(
            { key, count: { $lt: limit } },
            { $inc: { count: 1 }, $set: { updatedAt: now, expiresAt } },
            { returnDocument: "after" }
        );
        if (incrementedExisting) {
            return true;
        }

        const existing = await this.activeRequestsCollection.findOne({ key });
        if (existing) {
            return false;
        }

        try {
            await this.activeRequestsCollection.insertOne({
                key,
                userId,
                count: 1,
                expiresAt,
                createdAt: now,
                updatedAt: now,
            });
            return true;
        } catch (error) {
            if (!isDuplicateKeyError(error)) {
                throw error;
            }

            const incrementedAfterDuplicate = await this.activeRequestsCollection.findOneAndUpdate(
                { key, count: { $lt: limit } },
                { $inc: { count: 1 }, $set: { updatedAt: now, expiresAt } },
                { returnDocument: "after" }
            );
            return Boolean(incrementedAfterDuplicate);
        }
    };

    releaseActiveRequest = async (userId: string): Promise<void> => {
        const key = buildActiveRequestKey(userId);
        const decremented = await this.activeRequestsCollection.findOneAndUpdate(
            { key, count: { $gt: 1 } },
            { $inc: { count: -1 }, $set: { updatedAt: new Date() } },
            { returnDocument: "after" }
        );
        if (decremented) {
            return;
        }

        await this.activeRequestsCollection.deleteOne({ key });
    };

    countActiveRequests = async (userId: string): Promise<number> => {
        const key = buildActiveRequestKey(userId);
        const activeRequest = await this.activeRequestsCollection.findOne({
            key,
            expiresAt: { $gt: new Date() },
        });
        return activeRequest?.count ?? 0;
    };

    sumUserDailyTokens = async (userId: string, from: Date, to: Date): Promise<number> => {
        const result = await this.tokenUsageCollection.aggregate<{ totalTokens: number }>([
            {
                $match: {
                    sourceService: "chat-service",
                    userId,
                    createdAt: { $gte: from, $lt: to },
                },
            },
            { $group: { _id: null, totalTokens: { $sum: "$totalTokens" } } },
        ]).toArray();
        return readTokenTotal(result);
    };

    sumGlobalDailyTokens = async (from: Date, to: Date): Promise<number> => {
        const result = await this.tokenUsageCollection.aggregate<{ totalTokens: number }>([
            {
                $match: {
                    sourceService: "chat-service",
                    createdAt: { $gte: from, $lt: to },
                },
            },
            { $group: { _id: null, totalTokens: { $sum: "$totalTokens" } } },
        ]).toArray();
        return readTokenTotal(result);
    };
}
