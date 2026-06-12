import { z } from "zod";
import {
    CHAT_RATE_LIMIT_DAY_MS,
    CHAT_RATE_LIMIT_MAX_LIMIT,
    CHAT_RATE_LIMIT_MIN_LIMIT,
    CHAT_RATE_LIMIT_MINUTE_MS,
    CHAT_RATE_LIMIT_RULE_KEYS,
    DEFAULT_CHAT_RATE_LIMIT_RULES,
} from "./chat-rate-limit.consts";
import type {
    ChatRateLimitConfigDocument,
    ChatRateLimitConfigResponse,
    ChatRateLimitConfigUpdateInput,
    ChatRateLimitRuleKey,
    ChatRateLimitRules,
} from "./chat-rate-limit.types";

const ChatRateLimitRuleConfigSchema = z
    .object({
        enabled: z.boolean(),
        limit: z.number().int().min(CHAT_RATE_LIMIT_MIN_LIMIT).max(CHAT_RATE_LIMIT_MAX_LIMIT),
    })
    .strict();

const ChatRateLimitRulesSchema = z
    .object({
        perUserPerMinute: ChatRateLimitRuleConfigSchema,
        perUserPerDay: ChatRateLimitRuleConfigSchema,
        perIpPerMinute: ChatRateLimitRuleConfigSchema,
        activeRequestsPerUser: ChatRateLimitRuleConfigSchema,
        dailyTokensPerUser: ChatRateLimitRuleConfigSchema,
        dailyTokensGlobal: ChatRateLimitRuleConfigSchema,
        maxMessageCharacters: ChatRateLimitRuleConfigSchema,
        queuedRequestsPerUser: ChatRateLimitRuleConfigSchema,
        queuedRequestsGlobal: ChatRateLimitRuleConfigSchema,
        workerConcurrency: ChatRateLimitRuleConfigSchema,
    })
    .strict();

const ChatRateLimitUpdateSchema = z
    .object({
        rules: ChatRateLimitRulesSchema,
    })
    .strict();

export const parseChatRateLimitUpdateInput = (value: unknown): ChatRateLimitConfigUpdateInput =>
    ChatRateLimitUpdateSchema.parse(value);

export const toChatRateLimitConfigResponse = (config: ChatRateLimitConfigDocument): ChatRateLimitConfigResponse => ({
    rules: config.rules,
    updatedAt: config.updatedAt.toISOString(),
    ...(config.updatedByAdminUserId ? { updatedByAdminUserId: config.updatedByAdminUserId } : {}),
    ...(config.updatedByAdminUserName ? { updatedByAdminUserName: config.updatedByAdminUserName } : {}),
    ...(config.updatedByAdminUserEmail ? { updatedByAdminUserEmail: config.updatedByAdminUserEmail } : {}),
});

export const buildDefaultChatRateLimitConfig = (updatedAt = new Date()): ChatRateLimitConfigDocument => ({
    _id: "default",
    rules: DEFAULT_CHAT_RATE_LIMIT_RULES,
    updatedAt,
});

export const mergeChatRateLimitRulesWithDefaults = (rules: Partial<ChatRateLimitRules> | undefined): ChatRateLimitRules =>
    CHAT_RATE_LIMIT_RULE_KEYS.reduce<ChatRateLimitRules>(
        (mergedRules, ruleKey) => ({
            ...mergedRules,
            [ruleKey]: rules?.[ruleKey] ?? DEFAULT_CHAT_RATE_LIMIT_RULES[ruleKey],
        }),
        DEFAULT_CHAT_RATE_LIMIT_RULES
    );

export const isChatRateLimitRuleKey = (value: unknown): value is ChatRateLimitRuleKey =>
    typeof value === "string" && CHAT_RATE_LIMIT_RULE_KEYS.includes(value as ChatRateLimitRuleKey);

export const startOfUtcMinute = (date: Date): Date =>
    new Date(Math.floor(date.getTime() / CHAT_RATE_LIMIT_MINUTE_MS) * CHAT_RATE_LIMIT_MINUTE_MS);

export const startOfUtcDay = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const endOfFixedWindow = (windowStart: Date, windowMs: number): Date =>
    new Date(windowStart.getTime() + windowMs);

export const millisecondsUntil = (date: Date, now = new Date()): number =>
    Math.max(0, date.getTime() - now.getTime());

export const endOfUtcDay = (date: Date): Date =>
    new Date(startOfUtcDay(date).getTime() + CHAT_RATE_LIMIT_DAY_MS);
