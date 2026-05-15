export const ADMIN_ROUTE_PREFIX = "/api/admin";

export const ADMIN_ROUTE_PATHS = {
    users: "/users",
    userById: "/users/:userId",
    admins: "/admins",
    adminById: "/admins/:userId",
    llmTokenUsage: "/llm-token-usage",
} as const;

export const ADMIN_USERS_DEFAULT_PAGE = 1;
export const ADMIN_USERS_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_USERS_MAX_PAGE_SIZE = 100;
export const ADMIN_TOKEN_USAGE_DEFAULT_DAYS = 30;
export const ADMIN_TOKEN_USAGE_MAX_DAYS = 365;
