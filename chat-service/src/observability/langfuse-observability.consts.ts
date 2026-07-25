export const LANGFUSE_EXPORT_ATTRIBUTE = "langfuse.export";
export const DEFAULT_LANGFUSE_CONTENT_MAX_CHARS = 8000;
export const LANGFUSE_RELEASE = process.env.GIT_SHA ?? process.env.npm_package_version ?? "unknown";
