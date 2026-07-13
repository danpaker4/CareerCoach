import type { TextCompletionPort } from "../../ports/text-completion.types";
import type { LlmTokenUsageContext, LlmTokenUsageRecorder } from "../../token-usage.types";
import { recordLlmTokenUsage, toLlmErrorMessage } from "../../token-usage.utils";
import { buildLlmAuthHeaders } from "../../llm-auth.utils";
import { withSpan } from "../../../observability/tracing";
import { readTextFromCustomLlmPayload } from "./http-custom-text-completion.utils";

export class HttpCustomTextCompletionAdapter implements TextCompletionPort {
    constructor(
        private readonly endpointUrl: string,
        private readonly tokenUsageRecorder?: LlmTokenUsageRecorder
    ) { }

    readonly complete = async (prompt: string, context?: LlmTokenUsageContext): Promise<string> =>
        await withSpan("llm.complete", {
            "llm.provider": "custom",
            "llm.model": "custom",
            "llm.operation": context?.operation ?? "chat.text_completion",
            ...(context?.userId ? { "enduser.id": context.userId } : {}),
        }, async (span) => {
            console.info(`[LLM] Sending request provider=custom endpoint=${this.endpointUrl}`);
            try {
                const response = await fetch(this.endpointUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...buildLlmAuthHeaders() },
                    body: JSON.stringify({ prompt }),
                });

                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(`Custom LLM HTTP ${response.status}: ${JSON.stringify(payload)}`);
                }

                const text = readTextFromCustomLlmPayload(payload);
                if (!text) {
                    throw new Error("Custom LLM response must include non-empty text, reply, or content string");
                }

                span.setAttribute("llm.request.status", "success");
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "custom",
                    model: "custom",
                    usage: null,
                    requestStatus: "success",
                });
                return text;
            } catch (error: unknown) {
                span.setAttribute("llm.request.status", "error");
                await recordLlmTokenUsage(this.tokenUsageRecorder, {
                    sourceService: "chat-service",
                    operation: context?.operation ?? "chat.text_completion",
                    userId: context?.userId,
                    provider: "custom",
                    model: "custom",
                    usage: null,
                    requestStatus: "error",
                    errorMessage: toLlmErrorMessage(error),
                });
                throw error;
            }
        });
}
