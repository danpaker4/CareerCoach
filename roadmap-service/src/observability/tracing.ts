import { context, SpanStatusCode, trace, type Span, type SpanAttributes } from "@opentelemetry/api";

const tracer = trace.getTracer("careercoach.roadmap-service");

const readErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const enrichLangfuseAttributes = (name: string, attributes: SpanAttributes): SpanAttributes => {
    const operation = attributes["llm.operation"];
    if (typeof operation !== "string") {
        return attributes;
    }

    const provider = attributes["llm.provider"];
    const model = attributes["llm.model"];
    const userId = attributes["enduser.id"];
    return {
        ...attributes,
        "langfuse.export": true,
        "langfuse.trace.name": operation,
        "langfuse.trace.tags": [operation.split(".")[0] ?? "ai"],
        "langfuse.observation.type": name === "llm.embedding" ? "embedding" : "generation",
        "langfuse.observation.metadata.operation": operation,
        "langfuse.observation.metadata.feature": operation.split(".")[0] ?? "ai",
        "langfuse.environment": process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? "local",
        "langfuse.release": process.env.GIT_SHA ?? process.env.npm_package_version ?? "unknown",
        ...(typeof provider === "string" ? { "langfuse.observation.metadata.provider": provider, "gen_ai.provider.name": provider } : {}),
        ...(typeof model === "string" ? { "langfuse.observation.model.name": model, "gen_ai.request.model": model } : {}),
        ...(typeof userId === "string" ? { "langfuse.user.id": userId } : {}),
    };
};

const redactLangfuseContent = (value: string): string => value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?\d[\d().\-\s]{7,}\d)\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:Bearer\s+)?eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:password|api[_-]?key|token|secret)=([^\s&]+)/gi, "[REDACTED_SECRET]");

const getContentLimit = (): number => {
    const configuredLimit = Number(process.env.LANGFUSE_CONTENT_MAX_CHARS ?? 8000);
    return Number.isInteger(configuredLimit) && configuredLimit > 0 ? Math.min(configuredLimit, 8000) : 8000;
};

export const setLangfuseGenerationResult = (
    span: Span,
    input: string,
    output: string,
    usage: { readonly promptTokens: number; readonly completionTokens: number; readonly totalTokens: number } | null
): void => {
    const limit = getContentLimit();
    const captureContent = process.env.LANGFUSE_CAPTURE_CONTENT === "true";
    const safeInput = redactLangfuseContent(input);
    const safeOutput = redactLangfuseContent(output);
    span.setAttributes({
        "langfuse.observation.usage_details": JSON.stringify({
            input: usage?.promptTokens ?? 0,
            output: usage?.completionTokens ?? 0,
            total: usage?.totalTokens ?? 0,
        }),
        "gen_ai.usage.input_tokens": usage?.promptTokens ?? 0,
        "gen_ai.usage.output_tokens": usage?.completionTokens ?? 0,
        "langfuse.observation.metadata.input_chars": String(input.length),
        "langfuse.observation.metadata.output_chars": String(output.length),
        ...(captureContent ? {
            "langfuse.observation.input": JSON.stringify({ text: safeInput.slice(0, limit) }),
            "langfuse.observation.output": JSON.stringify({ text: safeOutput.slice(0, limit) }),
            "langfuse.observation.metadata.content_redacted": "true",
            "langfuse.observation.metadata.content_truncated": String(safeInput.length > limit || safeOutput.length > limit),
        } : {}),
    });
};

export const withSpan = async <T>(
    name: string,
    attributes: SpanAttributes,
    handler: (span: Span) => Promise<T>
): Promise<T> => {
    const enrichedAttributes = enrichLangfuseAttributes(name, attributes);
    const span = tracer.startSpan(name, { attributes: enrichedAttributes });
    const spanContext = trace.setSpan(context.active(), span);
    const isLangfuseObservation = enrichedAttributes["langfuse.export"] === true;

    return await context.with(spanContext, async () => {
        try {
            const result = await handler(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error: unknown) {
            const statusMessage = isLangfuseObservation ? "AI request failed" : readErrorMessage(error);
            span.recordException(isLangfuseObservation ? statusMessage : error instanceof Error ? error : statusMessage);
            span.setAttributes({
                "langfuse.observation.level": "ERROR",
                "langfuse.observation.status_message": "AI request failed",
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: statusMessage });
            throw error;
        } finally {
            span.end();
        }
    });
};
