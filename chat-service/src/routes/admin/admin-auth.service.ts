export type AdminSession = {
    readonly adminUserId: string;
    readonly adminUserName?: string;
    readonly adminUserEmail?: string;
};

export type AdminAuthFailure = {
    readonly statusCode: number;
    readonly error: string;
    readonly errorCode?: string;
};

export type AdminAuthResult =
    | { readonly status: "success"; readonly session: AdminSession }
    | { readonly status: "failure"; readonly failure: AdminAuthFailure };

const isAdminSession = (value: unknown): value is AdminSession => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return (
        typeof record.adminUserId === "string" &&
        record.adminUserId.trim().length > 0 &&
        (!("adminUserName" in record) || typeof record.adminUserName === "string") &&
        (!("adminUserEmail" in record) || typeof record.adminUserEmail === "string")
    );
};

const readAuthFailure = (payload: unknown, statusCode: number): AdminAuthFailure => {
    if (typeof payload !== "object" || payload === null) {
        return { statusCode, error: "Admin access required" };
    }

    const record = payload as Record<string, unknown>;
    return {
        statusCode,
        error: typeof record.error === "string" ? record.error : "Admin access required",
        ...(typeof record.errorCode === "string" ? { errorCode: record.errorCode } : {}),
    };
};

export class AdminAuthService {
    constructor(private readonly usersServiceBaseUrl: string) { }

    verifyAdmin = async (authorizationHeader: string | undefined): Promise<AdminAuthResult> => {
        if (!authorizationHeader) {
            return {
                status: "failure",
                failure: {
                    statusCode: 401,
                    error: "Access token missing",
                    errorCode: "ACCESS_TOKEN_MISSING",
                },
            };
        }

        const response = await fetch(`${this.usersServiceBaseUrl.replace(/\/$/, "")}/api/admin/session`, {
            method: "GET",
            headers: { Authorization: authorizationHeader },
        }).catch(() => null);

        if (!response) {
            return {
                status: "failure",
                failure: {
                    statusCode: 503,
                    error: "Unable to verify admin session",
                    errorCode: "ADMIN_SESSION_UNAVAILABLE",
                },
            };
        }

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
            return {
                status: "failure",
                failure: readAuthFailure(payload, response.status),
            };
        }

        if (!isAdminSession(payload)) {
            return {
                status: "failure",
                failure: {
                    statusCode: 403,
                    error: "Admin access required",
                    errorCode: "ADMIN_REQUIRED",
                },
            };
        }

        return { status: "success", session: payload };
    };
}
