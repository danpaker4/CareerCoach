import { context, SpanStatusCode, trace, type Span, type SpanAttributes } from "@opentelemetry/api";
import type { LangfuseAiObservationOptions } from "./langfuse-observability.types";

const tracer = trace.getTracer("careercoach.users-service");

const redactContent = (value: string): string => value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?\d[\d().\-\s]{7,}\d)\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:Bearer\s+)?eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:password|api[_-]?key|token|secret)=([^\s&]+)/gi, "[REDACTED_SECRET]");

const getContentLimit = (): number => {
    const configuredLimit = Number(process.env.LANGFUSE_CONTENT_MAX_CHARS ?? 8000);
    return Number.isInteger(configuredLimit) && configuredLimit > 0 ? Math.min(configuredLimit, 8000) : 8000;
};

const createAttributes = (options: LangfuseAiObservationOptions): SpanAttributes => ({
    "langfuse.export": true,
    "langfuse.trace.name": options.operation,
    "langfuse.trace.tags": [options.operation.split(".")[0] ?? "ai"],
    "langfuse.observation.type": options.type,
    "langfuse.observation.model.name": options.model,
    "langfuse.observation.metadata.operation": options.operation,
    "langfuse.observation.metadata.feature": options.operation.split(".")[0] ?? "ai",
    "langfuse.observation.metadata.provider": options.provider,
    "gen_ai.provider.name": options.provider,
    "gen_ai.request.model": options.model,
    "langfuse.environment": process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? "local",
    "langfuse.release": process.env.GIT_SHA ?? process.env.npm_package_version ?? "unknown",
    ...(options.userId ? { "langfuse.user.id": options.userId } : {}),
    "langfuse.observation.metadata.input_chars": String(options.input.length),
    ...(process.env.LANGFUSE_CAPTURE_CONTENT === "true" ? {
        "langfuse.observation.input": JSON.stringify({ text: redactContent(options.input).slice(0, getContentLimit()) }),
        "langfuse.observation.metadata.content_redacted": "true",
        "langfuse.observation.metadata.input_truncated": String(redactContent(options.input).length > getContentLimit()),
    } : {}),
});

export const setLangfuseOutput = (span: Span, output: string): void => {
    const safeOutput = redactContent(output);
    span.setAttributes({
        "langfuse.observation.metadata.output_chars": String(output.length),
        ...(process.env.LANGFUSE_CAPTURE_CONTENT === "true" ? {
            "langfuse.observation.output": JSON.stringify({ text: safeOutput.slice(0, getContentLimit()) }),
            "langfuse.observation.metadata.output_truncated": String(safeOutput.length > getContentLimit()),
        } : {}),
    });
};

export const withLangfuseAiObservation = async <T>(
    name: string,
    options: LangfuseAiObservationOptions,
    handler: (span: Span) => Promise<T>
): Promise<T> => {
    const span = tracer.startSpan(name, { attributes: createAttributes(options) });
    const spanContext = trace.setSpan(context.active(), span);
    return await context.with(spanContext, async () => {
        try {
            const result = await handler(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error: unknown) {
            const statusMessage = "AI request failed";
            span.recordException(statusMessage);
            span.setAttributes({
                "langfuse.observation.level": "ERROR",
                "langfuse.observation.status_message": statusMessage,
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: statusMessage });
            throw error;
        } finally {
            span.end();
        }
    });
};
