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
