import { ZodError } from "zod";
import type { AdminSession } from "../../admin/admin-auth.service";
import {
    CHAT_RATE_LIMIT_CONFIG_CACHE_MS,
    CHAT_RATE_LIMIT_DAY_MS,
    CHAT_RATE_LIMIT_MINUTE_MS,
} from "./chat-rate-limit.consts";
import { ChatRateLimitRepository } from "./chat-rate-limit.repository";
import type {
    ChatRateLimitBlockedDecision,
    ChatRateLimitConfigDocument,
    ChatRateLimitConfigResponse,
    ChatRateLimitConfigUpdateInput,
    ChatRateLimitDecision,
    ChatRateLimitRuleConfig,
    ChatRateLimitRuleKey,
    ChatRateLimitRules,
} from "./chat-rate-limit.types";
import {
    endOfFixedWindow,
    endOfUtcDay,
    millisecondsUntil,
    parseChatRateLimitUpdateInput,
    startOfUtcDay,
    startOfUtcMinute,
    toChatRateLimitConfigResponse,
} from "./chat-rate-limit.utils";

type CachedRateLimitConfig = {
    readonly config: ChatRateLimitConfigDocument;
    readonly expiresAtMs: number;
};

type ChatRateLimitCheckParams = {
    readonly userId: string;
    readonly ipAddress: string;
    readonly message: string;
};

type ChatRateLimitQueueState = {
    readonly queuedRequestsForUser: number;
    readonly queuedRequestsGlobal: number;
};

type ChatRateLimitEnqueueCheckParams = ChatRateLimitCheckParams & {
    readonly queueState: ChatRateLimitQueueState;
};

type CounterRuleParams = {
    readonly rule: ChatRateLimitRuleKey;
    readonly identity: string;
    readonly config: ChatRateLimitRuleConfig;
    readonly windowStart: Date;
    readonly windowMs: number;
    readonly block: ChatRateLimitBlockedDecision;
};

const createBlockedDecision = (
    errorCode: ChatRateLimitBlockedDecision["errorCode"],
    error: string,
    retryAfterMs?: number
): ChatRateLimitBlockedDecision => ({
    status: "blocked",
    errorCode,
    error,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
});

const noopRelease = async (): Promise<void> => undefined;

export class ChatRateLimitValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ChatRateLimitValidationError";
    }
}

export class ChatRateLimitService {
    private cachedConfig: CachedRateLimitConfig | null = null;

    constructor(private readonly repository: ChatRateLimitRepository) { }

    private readConfig = async (forceRefresh = false): Promise<ChatRateLimitConfigDocument> => {
        const nowMs = Date.now();
        if (!forceRefresh && this.cachedConfig && this.cachedConfig.expiresAtMs > nowMs) {
            return this.cachedConfig.config;
        }

        const config = await this.repository.getConfig();
        this.cachedConfig = {
            config,
            expiresAtMs: nowMs + CHAT_RATE_LIMIT_CONFIG_CACHE_MS,
        };
        return config;
    };

    private checkCounterRule = async (params: CounterRuleParams): Promise<ChatRateLimitBlockedDecision | null> => {
        const { rule, identity, config, windowStart, windowMs, block } = params;
        if (!config.enabled) {
            return null;
        }

        const windowEnd = endOfFixedWindow(windowStart, windowMs);
        const count = await this.repository.incrementCounter({
            rule,
            identity,
            windowStart,
            expiresAt: windowEnd,
        });

        return count > config.limit
            ? { ...block, retryAfterMs: millisecondsUntil(windowEnd) }
            : null;
    };

    private checkTokenBudgets = async (rules: ChatRateLimitRules, userId: string, now: Date): Promise<ChatRateLimitBlockedDecision | null> => {
        const dayStart = startOfUtcDay(now);
        const dayEnd = endOfUtcDay(now);
        if (rules.dailyTokensPerUser.enabled) {
            const userTokens = await this.repository.sumUserDailyTokens(userId, dayStart, dayEnd);
            if (userTokens >= rules.dailyTokensPerUser.limit) {
                return createBlockedDecision(
                    "CHAT_TOKEN_BUDGET_EXCEEDED",
                    "Daily chat token budget reached for this user.",
                    millisecondsUntil(dayEnd, now)
                );
            }
        }

        if (rules.dailyTokensGlobal.enabled) {
            const globalTokens = await this.repository.sumGlobalDailyTokens(dayStart, dayEnd);
            if (globalTokens >= rules.dailyTokensGlobal.limit) {
                return createBlockedDecision(
                    "CHAT_TOKEN_BUDGET_EXCEEDED",
                    "Daily global chat token budget reached.",
                    millisecondsUntil(dayEnd, now)
                );
            }
        }

        return null;
    };

    private checkQueueBudgets = async (
        rules: ChatRateLimitRules,
        queueState: ChatRateLimitQueueState
    ): Promise<ChatRateLimitBlockedDecision | null> => {
        if (rules.queuedRequestsPerUser.enabled && queueState.queuedRequestsForUser >= rules.queuedRequestsPerUser.limit) {
            return createBlockedDecision(
                "CHAT_RATE_LIMITED",
                "Too many chat messages are already queued for this user."
            );
        }

        if (rules.queuedRequestsGlobal.enabled && queueState.queuedRequestsGlobal >= rules.queuedRequestsGlobal.limit) {
            return createBlockedDecision(
                "CHAT_RATE_LIMITED",
                "The chat queue is currently full. Try again shortly."
            );
        }

        return null;
    };

    private checkMessageAndTokenBudgets = async (
        rules: ChatRateLimitRules,
        params: ChatRateLimitCheckParams,
        now: Date
    ): Promise<ChatRateLimitBlockedDecision | null> => {
        const messageLength = params.message.trim().length;

        if (rules.maxMessageCharacters.enabled && messageLength > rules.maxMessageCharacters.limit) {
            return createBlockedDecision(
                "CHAT_MESSAGE_TOO_LONG",
                `Chat message is too long. Maximum allowed length is ${rules.maxMessageCharacters.limit} characters.`
            );
        }

        return await this.checkTokenBudgets(rules, params.userId, now);
    };

    private checkSubmissionCounters = async (
        rules: ChatRateLimitRules,
        params: ChatRateLimitCheckParams,
        now: Date,
        release: () => Promise<void>
    ): Promise<ChatRateLimitBlockedDecision | null> => {
        const minuteStart = startOfUtcMinute(now);
        const dayStart = startOfUtcDay(now);
        const userMinuteDecision = await this.checkCounterRule({
            rule: "perUserPerMinute",
            identity: params.userId,
            config: rules.perUserPerMinute,
            windowStart: minuteStart,
            windowMs: CHAT_RATE_LIMIT_MINUTE_MS,
            block: createBlockedDecision("CHAT_RATE_LIMITED", "Too many chat messages for this user. Try again shortly."),
        });
        if (userMinuteDecision) {
            await release();
            return userMinuteDecision;
        }

        const ipMinuteDecision = await this.checkCounterRule({
            rule: "perIpPerMinute",
            identity: params.ipAddress,
            config: rules.perIpPerMinute,
            windowStart: minuteStart,
            windowMs: CHAT_RATE_LIMIT_MINUTE_MS,
            block: createBlockedDecision("CHAT_RATE_LIMITED", "Too many chat messages from this network. Try again shortly."),
        });
        if (ipMinuteDecision) {
            await release();
            return ipMinuteDecision;
        }

        const userDayDecision = await this.checkCounterRule({
            rule: "perUserPerDay",
            identity: params.userId,
            config: rules.perUserPerDay,
            windowStart: dayStart,
            windowMs: CHAT_RATE_LIMIT_DAY_MS,
            block: createBlockedDecision("CHAT_DAILY_LIMIT_EXCEEDED", "Daily chat message limit reached for this user."),
        });
        if (userDayDecision) {
            await release();
            return userDayDecision;
        }

        return null;
    };

    getConfig = async (): Promise<ChatRateLimitConfigResponse> =>
        toChatRateLimitConfigResponse(await this.readConfig(true));

    getWorkerConcurrency = async (): Promise<number> => {
        const { rules } = await this.readConfig();
        return rules.workerConcurrency.enabled ? rules.workerConcurrency.limit : 1;
    };

    updateConfig = async (input: unknown, updatedByAdmin: AdminSession): Promise<ChatRateLimitConfigResponse> => {
        const parsed = (() => {
            try {
                return parseChatRateLimitUpdateInput(input);
            } catch (error) {
                if (error instanceof ZodError) {
                    throw new ChatRateLimitValidationError(error.issues.map((issue) => issue.message).join("; "));
                }
                throw error;
            }
        })();
        const config = await this.repository.updateConfig(parsed.rules, updatedByAdmin);
        this.cachedConfig = {
            config,
            expiresAtMs: Date.now() + CHAT_RATE_LIMIT_CONFIG_CACHE_MS,
        };
        return toChatRateLimitConfigResponse(config);
    };

    checkAndAcquire = async (params: ChatRateLimitCheckParams): Promise<ChatRateLimitDecision> => {
        const config = await this.readConfig();
        const { rules } = config;
        const now = new Date();

        const budgetDecision = await this.checkMessageAndTokenBudgets(rules, params, now);
        if (budgetDecision) {
            return budgetDecision;
        }

        const acquiredActiveRequest = rules.activeRequestsPerUser.enabled
            ? await this.repository.acquireActiveRequest(params.userId, rules.activeRequestsPerUser.limit)
            : true;
        if (!acquiredActiveRequest) {
            return createBlockedDecision(
                "CHAT_REQUEST_IN_PROGRESS",
                "A chat response is already being generated for this user."
            );
        }

        const release = rules.activeRequestsPerUser.enabled
            ? async (): Promise<void> => {
                await this.repository.releaseActiveRequest(params.userId);
            }
            : noopRelease;

        const counterDecision = await this.checkSubmissionCounters(rules, params, now, release);
        if (counterDecision) {
            return counterDecision;
        }

        return { status: "allowed", release };
    };

    checkBeforeEnqueue = async (params: ChatRateLimitEnqueueCheckParams): Promise<ChatRateLimitDecision> => {
        const config = await this.readConfig();
        const { rules } = config;
        const now = new Date();

        const budgetDecision = await this.checkMessageAndTokenBudgets(rules, params, now);
        if (budgetDecision) {
            return budgetDecision;
        }

        const activeRequestCount = rules.activeRequestsPerUser.enabled
            ? await this.repository.countActiveRequests(params.userId)
            : 0;
        if (rules.activeRequestsPerUser.enabled && activeRequestCount >= rules.activeRequestsPerUser.limit) {
            return createBlockedDecision(
                "CHAT_REQUEST_IN_PROGRESS",
                "A chat response is already being generated for this user."
            );
        }

        const queueDecision = await this.checkQueueBudgets(rules, params.queueState);
        if (queueDecision) {
            return queueDecision;
        }

        const counterDecision = await this.checkSubmissionCounters(rules, params, now, noopRelease);
        if (counterDecision) {
            return counterDecision;
        }

        return { status: "allowed", release: noopRelease };
    };

    acquireWorkerRequest = async (userId: string): Promise<ChatRateLimitDecision> => {
        const { rules } = await this.readConfig();
        if (!rules.activeRequestsPerUser.enabled) {
            return { status: "allowed", release: noopRelease };
        }

        const acquiredActiveRequest = await this.repository.acquireActiveRequest(userId, rules.activeRequestsPerUser.limit);
        if (!acquiredActiveRequest) {
            return createBlockedDecision(
                "CHAT_REQUEST_IN_PROGRESS",
                "A chat response is already being generated for this user."
            );
        }

        return {
            status: "allowed",
            release: async (): Promise<void> => {
                await this.repository.releaseActiveRequest(userId);
            },
        };
    };
}

export type { ChatRateLimitConfigUpdateInput };
