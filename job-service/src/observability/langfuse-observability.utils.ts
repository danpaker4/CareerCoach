import type { SpanAttributes } from "@opentelemetry/api";

const DEFAULT_LANGFUSE_CONTENT_MAX_CHARS = 8000;

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

export const createLangfuseContentAttributes = (input: string, output?: string): SpanAttributes => {
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
        "langfuse.observation.metadata.content_truncated": String(
            safeInput.length < inputChars || safeOutput !== undefined && safeOutput.length < outputChars
        ),
    };
};
