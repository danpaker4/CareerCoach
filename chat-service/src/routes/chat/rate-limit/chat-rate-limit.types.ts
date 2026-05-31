export type ChatRateLimitRuleKey =
    | "perUserPerMinute"
    | "perUserPerDay"
    | "perIpPerMinute"
    | "activeRequestsPerUser"
    | "dailyTokensPerUser"
    | "dailyTokensGlobal"
    | "maxMessageCharacters";

export type ChatRateLimitRuleConfig = {
    readonly enabled: boolean;
    readonly limit: number;
};

export type ChatRateLimitRules = Record<ChatRateLimitRuleKey, ChatRateLimitRuleConfig>;

export type ChatRateLimitConfigDocument = {
    readonly _id: "default";
    readonly rules: ChatRateLimitRules;
    readonly updatedAt: Date;
    readonly updatedByAdminUserId?: string;
    readonly updatedByAdminUserName?: string;
    readonly updatedByAdminUserEmail?: string;
};

export type ChatRateLimitConfigHistoryDocument = Omit<ChatRateLimitConfigDocument, "_id"> & {
    readonly configId: "default";
};

export type ChatRateLimitCounterDocument = {
    readonly key: string;
    readonly rule: ChatRateLimitRuleKey;
    readonly identity: string;
    readonly count: number;
    readonly windowStart: Date;
    readonly expiresAt: Date;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type ChatActiveRequestDocument = {
    readonly key: string;
    readonly userId: string;
    readonly count: number;
    readonly expiresAt: Date;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type ChatRateLimitConfigResponse = {
    readonly rules: ChatRateLimitRules;
    readonly updatedAt: string;
    readonly updatedByAdminUserId?: string;
    readonly updatedByAdminUserName?: string;
    readonly updatedByAdminUserEmail?: string;
};

export type ChatRateLimitConfigUpdateInput = {
    readonly rules: ChatRateLimitRules;
};

export type ChatRateLimitErrorCode =
    | "CHAT_RATE_LIMITED"
    | "CHAT_DAILY_LIMIT_EXCEEDED"
    | "CHAT_TOKEN_BUDGET_EXCEEDED"
    | "CHAT_REQUEST_IN_PROGRESS"
    | "CHAT_MESSAGE_TOO_LONG";

export type ChatRateLimitBlockedDecision = {
    readonly status: "blocked";
    readonly errorCode: ChatRateLimitErrorCode;
    readonly error: string;
    readonly retryAfterMs?: number;
};

export type ChatRateLimitAllowedDecision = {
    readonly status: "allowed";
    readonly release: () => Promise<void>;
};

export type ChatRateLimitDecision = ChatRateLimitAllowedDecision | ChatRateLimitBlockedDecision;
