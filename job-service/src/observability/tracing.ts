import { context, SpanStatusCode, trace, type Span, type SpanAttributes } from "@opentelemetry/api";

const tracer = trace.getTracer("careercoach.job-service");

const readErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const enrichLangfuseAttributes = (name: string, attributes: SpanAttributes): SpanAttributes => {
    const operation = attributes["llm.operation"];
    if (typeof operation !== "string") {
        return attributes;
    }

    const provider = attributes["llm.provider"];
    const model = attributes["llm.model"];
    return {
        ...attributes,
        "langfuse.export": true,
        "langfuse.trace.name": operation,
        "langfuse.trace.tags": [operation.split(".")[0] ?? "ai"],
        "langfuse.observation.type": name === "llm.embedding" ? "embedding" : name === "llm.complete" ? "generation" : "chain",
        "langfuse.observation.metadata.operation": operation,
        "langfuse.observation.metadata.feature": operation.split(".")[0] ?? "ai",
        "langfuse.environment": process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? "local",
        "langfuse.release": process.env.GIT_SHA ?? process.env.npm_package_version ?? "unknown",
        ...(typeof provider === "string" ? { "langfuse.observation.metadata.provider": provider, "gen_ai.provider.name": provider } : {}),
        ...(typeof model === "string" ? { "langfuse.observation.model.name": model, "gen_ai.request.model": model } : {}),
    };
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
