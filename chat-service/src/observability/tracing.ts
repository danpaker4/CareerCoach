import { context, SpanStatusCode, trace, type Span, type SpanAttributes } from "@opentelemetry/api";

const tracer = trace.getTracer("careercoach.chat-service");

const readErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

export const withSpan = async <T>(
    name: string,
    attributes: SpanAttributes,
    handler: (span: Span) => Promise<T>
): Promise<T> => {
    const span = tracer.startSpan(name, { attributes });
    const spanContext = trace.setSpan(context.active(), span);

    return await context.with(spanContext, async () => {
        try {
            const result = await handler(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error: unknown) {
            span.recordException(error instanceof Error ? error : readErrorMessage(error));
            span.setStatus({ code: SpanStatusCode.ERROR, message: readErrorMessage(error) });
            throw error;
        } finally {
            span.end();
        }
    });
};
