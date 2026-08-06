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
