import { context, SpanStatusCode, trace, type SpanAttributes } from "@opentelemetry/api";
import type { ChatLlmObserver, ChatLlmParseEvent } from "../chat-flow/shared/llm/chat.llm.types";
import { createLangfuseContentAttributes, createLangfuseObservationAttributes } from "./tracing";

const tracer = trace.getTracer("careercoach.chat-service.llm-parser");

const createParseAttributes = (event: ChatLlmParseEvent): SpanAttributes => ({
    ...createLangfuseObservationAttributes({
        operation: `${event.operation}.parse`,
        type: "span",
        feature: "chat",
        userId: event.userId,
        sessionId: event.sessionId,
    }),
    ...createLangfuseContentAttributes(event.rawText, JSON.stringify({ parseStatus: event.parseStatus })),
    "langfuse.observation.metadata.parse_status": event.parseStatus,
    "langfuse.observation.level": event.parseStatus === "fallback" ? "WARNING" : "DEFAULT",
    ...(event.errorMessage
        ? { "langfuse.observation.status_message": event.errorMessage.slice(0, 500) }
        : {}),
});

const logParseEvent = (event: ChatLlmParseEvent): void => {
    const logEntry = JSON.stringify({
        event: "llm.response_parse",
        status: event.parseStatus,
        operation: event.operation,
        userId: event.userId,
        sessionId: event.sessionId,
        responseChars: event.rawText.length,
        error: event.errorMessage,
    });
    if (event.parseStatus === "fallback") {
        console.warn(logEntry);
        return;
    }
    console.info(logEntry);
};

export const createChatLlmObserver = (): ChatLlmObserver => ({
    recordParseEvent: (event) => {
        const span = tracer.startSpan(
            "llm.response.parse",
            { attributes: createParseAttributes(event) },
            context.active()
        );
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        logParseEvent(event);
    },
});
