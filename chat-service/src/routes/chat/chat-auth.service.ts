export type ChatAuthenticatedUser = {
    readonly userId: string;
    readonly email: string;
};

export type ChatAuthFailure = {
    readonly statusCode: number;
    readonly error: string;
    readonly errorCode?: string;
};

export type ChatAuthResult =
    | { readonly status: "success"; readonly user: ChatAuthenticatedUser }
    | { readonly status: "failure"; readonly failure: ChatAuthFailure };

const isChatAuthenticatedUser = (value: unknown): value is ChatAuthenticatedUser => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return typeof record.userId === "string" && typeof record.email === "string";
};

const readAuthFailure = (payload: unknown, statusCode: number): ChatAuthFailure => {
    if (typeof payload !== "object" || payload === null) {
        return { statusCode, error: "Unauthorized", errorCode: "UNAUTHORIZED" };
    }

    const record = payload as Record<string, unknown>;
    return {
        statusCode,
        error: typeof record.error === "string" ? record.error : "Unauthorized",
        ...(typeof record.errorCode === "string" ? { errorCode: record.errorCode } : {}),
    };
};

export class ChatAuthService {
    constructor(private readonly usersServiceBaseUrl: string) { }

    verifyUser = async (authorizationHeader: string | undefined): Promise<ChatAuthResult> => {
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

        const response = await fetch(`${this.usersServiceBaseUrl.replace(/\/$/, "")}/api/auth/session`, {
            method: "GET",
            headers: { Authorization: authorizationHeader },
        }).catch(() => null);

        if (!response) {
            return {
                status: "failure",
                failure: {
                    statusCode: 503,
                    error: "Unable to verify chat session",
                    errorCode: "AUTH_SESSION_UNAVAILABLE",
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

        if (!isChatAuthenticatedUser(payload)) {
            return {
                status: "failure",
                failure: {
                    statusCode: 401,
                    error: "Invalid access token",
                    errorCode: "ACCESS_TOKEN_INVALID",
                },
            };
        }

        return { status: "success", user: payload };
    };
}

