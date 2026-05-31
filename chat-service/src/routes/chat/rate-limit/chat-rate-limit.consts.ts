import type { ChatRateLimitRuleKey, ChatRateLimitRules } from "./chat-rate-limit.types";

export const CHAT_RATE_LIMIT_CONFIG_ID = "default";
export const CHAT_RATE_LIMIT_CONFIG_CACHE_MS = 10_000;
export const CHAT_RATE_LIMIT_COUNTER_TTL_SECONDS = 172_800;
export const CHAT_ACTIVE_REQUEST_TTL_MS = 5 * 60 * 1000;
export const CHAT_RATE_LIMIT_MIN_LIMIT = 1;
export const CHAT_RATE_LIMIT_MAX_LIMIT = 10_000_000;
export const CHAT_RATE_LIMIT_MINUTE_MS = 60 * 1000;
export const CHAT_RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000;
export const CHAT_RATE_LIMIT_ROUTE_PREFIX = "/api/chat/rate-limits";

export const CHAT_RATE_LIMIT_RULE_KEYS = [
    "perUserPerMinute",
    "perUserPerDay",
    "perIpPerMinute",
    "activeRequestsPerUser",
    "dailyTokensPerUser",
    "dailyTokensGlobal",
    "maxMessageCharacters",
] as const satisfies readonly ChatRateLimitRuleKey[];

export const DEFAULT_CHAT_RATE_LIMIT_RULES: ChatRateLimitRules = {
    perUserPerMinute: { enabled: true, limit: 10 },
    perUserPerDay: { enabled: true, limit: 80 },
    perIpPerMinute: { enabled: true, limit: 30 },
    activeRequestsPerUser: { enabled: true, limit: 1 },
    dailyTokensPerUser: { enabled: true, limit: 150_000 },
    dailyTokensGlobal: { enabled: true, limit: 2_000_000 },
    maxMessageCharacters: { enabled: true, limit: 4_000 },
};

