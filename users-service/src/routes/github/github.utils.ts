export const serializeRouteError = (error: unknown) => ({
    message: "Internal server error",
    status: "ERROR",
    error: error instanceof Error ? error.message : error,
});
