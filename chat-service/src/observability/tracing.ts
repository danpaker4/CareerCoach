import { context, SpanStatusCode, trace, type Span, type SpanAttributes } from "@opentelemetry/api";
import {
    DEFAULT_LANGFUSE_CONTENT_MAX_CHARS,
    LANGFUSE_EXPORT_ATTRIBUTE,
    LANGFUSE_RELEASE,
} from "./langfuse-observability.consts";
import type {
    LangfuseContentAttributes,
    LangfuseObservationInput,
} from "./langfuse-observability.types";

const tracer = trace.getTracer("careercoach.chat-service");

const readErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const redactLangfuseContent = (value: string): string => value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?\d[\d().\-\s]{7,}\d)\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:Bearer\s+)?eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:sk|pk)-[a-zA-Z0-9_-]+\b/g, "[REDACTED_KEY]")
    .replace(/\b(?:password|api[_-]?key|token|secret)=([^\s&]+)/gi, "[REDACTED_SECRET]");

const getContentLimit = (): number => {
    const configured = Number(process.env.LANGFUSE_CONTENT_MAX_CHARS ?? DEFAULT_LANGFUSE_CONTENT_MAX_CHARS);
    return Number.isInteger(configured) && configured > 0
        ? Math.min(configured, DEFAULT_LANGFUSE_CONTENT_MAX_CHARS)
        : DEFAULT_LANGFUSE_CONTENT_MAX_CHARS;
};

const isContentCaptureEnabled = (): boolean => process.env.LANGFUSE_CAPTURE_CONTENT === "true";

export const createLangfuseObservationAttributes = (input: LangfuseObservationInput): SpanAttributes => ({
    [LANGFUSE_EXPORT_ATTRIBUTE]: true,
    "langfuse.trace.name": input.operation,
    "langfuse.trace.tags": [input.feature],
    "langfuse.observation.type": input.type,
    "langfuse.observation.metadata.operation": input.operation,
    "langfuse.observation.metadata.feature": input.feature,
    "langfuse.environment": process.env.OTEL_DEPLOYMENT_ENVIRONMENT ?? "local",
    "langfuse.release": LANGFUSE_RELEASE,
    "langfuse.version": LANGFUSE_RELEASE,
    ...(input.provider ? {
        "langfuse.observation.metadata.provider": input.provider,
        "gen_ai.provider.name": input.provider,
    } : {}),
    ...(input.model ? {
        "langfuse.observation.model.name": input.model,
        "gen_ai.request.model": input.model,
    } : {}),
    ...(input.userId ? { "langfuse.user.id": input.userId } : {}),
    ...(input.sessionId ? { "langfuse.session.id": input.sessionId } : {}),
});

export const createLangfuseContentAttributes = (input: string, output?: string): LangfuseContentAttributes => {
    const inputChars = input.length;
    const outputChars = output?.length ?? 0;
    if (!isContentCaptureEnabled()) {
        return {
            "langfuse.observation.metadata.input_chars": String(inputChars),
            "langfuse.observation.metadata.output_chars": String(outputChars),
        };
    }

    const limit = getContentLimit();
    const safeInput = redactLangfuseContent(input).slice(0, limit);
    const safeOutput = output === undefined ? undefined : redactLangfuseContent(output).slice(0, limit);
    return {
        "langfuse.observation.input": JSON.stringify({ text: safeInput }),
        ...(safeOutput === undefined ? {} : { "langfuse.observation.output": JSON.stringify({ text: safeOutput }) }),
        "langfuse.observation.metadata.input_chars": String(inputChars),
        "langfuse.observation.metadata.output_chars": String(outputChars),
        "langfuse.observation.metadata.content_redacted": "true",
        "langfuse.observation.metadata.content_truncated": String(safeInput.length < inputChars || safeOutput !== undefined && safeOutput.length < outputChars),
    };
};

export const createLangfuseUsageAttributes = (usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
} | null): SpanAttributes => ({
    "langfuse.observation.usage_details": JSON.stringify({
        input: usage?.promptTokens ?? 0,
        output: usage?.completionTokens ?? 0,
        total: usage?.totalTokens ?? 0,
    }),
    "gen_ai.usage.input_tokens": usage?.promptTokens ?? 0,
    "gen_ai.usage.output_tokens": usage?.completionTokens ?? 0,
});

export const withSpan = async <T>(
    name: string,
    attributes: SpanAttributes,
    handler: (span: Span) => Promise<T>
): Promise<T> => {
    const span = tracer.startSpan(name, { attributes });
    const spanContext = trace.setSpan(context.active(), span);
    const isLangfuseObservation = attributes[LANGFUSE_EXPORT_ATTRIBUTE] === true;

    return await context.with(spanContext, async () => {
        try {
            const result = await handler(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error: unknown) {
            const statusMessage = isLangfuseObservation ? "AI request failed" : readErrorMessage(error);
            span.recordException(isLangfuseObservation ? statusMessage : error instanceof Error ? error : statusMessage);
            span.setStatus({ code: SpanStatusCode.ERROR, message: statusMessage });
            throw error;
        } finally {
            span.end();
        }
    });
};
