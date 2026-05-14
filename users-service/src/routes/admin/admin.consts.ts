export const ADMIN_ROUTE_PREFIX = "/api/admin";

export const ADMIN_ROUTE_PATHS = {
    users: "/users",
    userById: "/users/:userId",
    admins: "/admins",
    adminById: "/admins/:userId",
} as const;

export const ADMIN_USERS_SEARCH_LIMIT = 25;
